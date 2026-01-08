import { useEffect, useRef, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot } from 'lucide-react'
import { Sidebar, MessageList, ChatInput, ModelSelector } from '@/components/chat'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { sessionApi, chatApi, authApi } from '@/api'
import { getApiKeys } from '@/api/key'
import type { Session, Message, Model, ApiKey } from '@ai-chat-hub/shared'

export default function ChatPage() {
  const navigate = useNavigate()
  const abortControllerRef = useRef<AbortController | null>(null)
  const [userKeys, setUserKeys] = useState<ApiKey[]>([])
  
  const { user, logout: authLogout, refreshToken } = useAuthStore()
  const {
    sessions,
    setSessions,
    currentSession,
    setCurrentSession,
    addSession,
    removeSession,
    messages,
    setMessages,
    addMessage,
    updateMessage,
    appendToMessage,
    finishStreamingMessage,
    models,
    setModels,
    currentModelId,
    setCurrentModelId,
    isLoading,
    setLoading,
    isSending,
    setSending,
    sidebarOpen,
    toggleSidebar,
  } = useChatStore()

  // 加载用户的 API keys
  useEffect(() => {
    getApiKeys()
      .then(setUserKeys)
      .catch(console.error)
  }, [])

  // 加载模型列表
  useEffect(() => {
    chatApi.getModels().then((data) => {
      setModels(data)
      if (data.length > 0 && !currentModelId) {
        // 默认选择第一个模型
        setCurrentModelId(data[0].id)
      }
    }).catch(console.error)
  }, [])

  // 过滤出用户已配置 API key 的模型
  const availableModels = models.filter((model) => {
    return userKeys.some((key) => key.provider === model.provider)
  })

  // 当可用模型列表变化时，确保选择了有效模型
  useEffect(() => {
    if (availableModels.length > 0) {
      // 如果当前模型不在可用列表中，选择第一个可用模型
      if (!currentModelId || !availableModels.find(m => m.id === currentModelId)) {
        setCurrentModelId(availableModels[0].id)
      }
    }
  }, [availableModels.length, userKeys.length])

  // 加载会话列表
  useEffect(() => {
    sessionApi.list().then(({ sessions }) => {
      setSessions(sessions)
    }).catch(console.error)
  }, [])

  // 选择会话时加载消息
  useEffect(() => {
    if (currentSession) {
      setLoading(true)
      chatApi.getMessages(currentSession.id)
        .then(setMessages)
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      setMessages([])
    }
  }, [currentSession?.id])

  // 创建新会话
  const handleNewChat = useCallback(async () => {
    try {
      const session = await sessionApi.create()
      addSession(session)
      setCurrentSession(session)
    } catch (error) {
      console.error('创建会话失败:', error)
    }
  }, [])

  // 选择会话
  const handleSelectSession = useCallback((session: Session) => {
    setCurrentSession(session)
  }, [])

  // 删除会话
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      await sessionApi.delete(sessionId)
      removeSession(sessionId)
      if (currentSession?.id === sessionId) {
        setCurrentSession(null)
      }
    } catch (error) {
      console.error('删除会话失败:', error)
    }
  }, [currentSession])

  // 发送消息
  const handleSendMessage = useCallback(async (content: string) => {
    if (!currentModelId) {
      alert('请先选择模型')
      return
    }

    let sessionId = currentSession?.id

    // 如果没有当前会话，先创建
    if (!sessionId) {
      try {
        const session = await sessionApi.create({ title: content.slice(0, 50) })
        addSession(session)
        setCurrentSession(session)
        sessionId = session.id
      } catch (error) {
        console.error('创建会话失败:', error)
        return
      }
    }

    // 添加用户消息
    const userMessage: Message = {
      id: `temp-user-${Date.now()}`,
      sessionId,
      parentId: null,
      role: 'user',
      content,
      modelId: null,
      tokensInput: 0,
      tokensOutput: 0,
      version: 1,
      createdAt: new Date(),
      metadata: {},
    }
    addMessage(userMessage)

    // 创建助手消息占位
    const assistantMessageId = `temp-assistant-${Date.now()}`
    const assistantMessage: Message & { isStreaming: boolean; streamContent: string } = {
      id: assistantMessageId,
      sessionId,
      parentId: null,
      role: 'assistant',
      content: '',
      modelId: currentModelId,
      tokensInput: 0,
      tokensOutput: 0,
      version: 1,
      createdAt: new Date(),
      metadata: {},
      isStreaming: true,
      streamContent: '',
    }
    addMessage(assistantMessage)
    setSending(true)

    // 发送请求
    abortControllerRef.current = chatApi.sendMessage(
      sessionId,
      content,
      currentModelId,
      // onChunk
      (chunk) => {
        appendToMessage(assistantMessageId, chunk)
      },
      // onDone
      (messageId, usage) => {
        finishStreamingMessage(assistantMessageId, messageId, usage)
        setSending(false)
        abortControllerRef.current = null
      },
      // onError
      (error) => {
        updateMessage(assistantMessageId, {
          isStreaming: false,
          content: `错误: ${error}`,
        } as any)
        setSending(false)
        abortControllerRef.current = null
      }
    )
  }, [currentSession, currentModelId, messages])

  // 停止生成
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setSending(false)
    }
  }, [])

  // 模型切换
  const handleModelChange = useCallback((modelId: string) => {
    setCurrentModelId(modelId)
  }, [])

  // 退出登录
  const handleLogout = useCallback(async () => {
    try {
      await authApi.logout(refreshToken || undefined)
    } catch {
      // 忽略错误
    }
    authLogout()
    navigate('/login')
  }, [refreshToken])

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-background">
        {/* Decorative Background Gradient */}
        <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

        {/* Header */}
        <header className="h-16 border-b border-border/40 flex items-center px-6 justify-between bg-background/60 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <Button variant="ghost" size="icon" onClick={toggleSidebar} className="rounded-full">
                <Bot className="w-5 h-5 text-primary" />
              </Button>
            )}
            <h2 className="font-bold text-lg tracking-tight">
              {currentSession?.title || '新的智能对话'}
            </h2>
          </div>
          <ModelSelector
            models={availableModels}
            selectedModelId={currentModelId}
            onModelChange={handleModelChange}
            disabled={isSending}
          />
        </header>

        {/* Messages */}
        <MessageList
          messages={messages as any}
          isLoading={isLoading || isSending}
        />

        {/* Input */}
        <ChatInput
          onSend={handleSendMessage}
          onStop={handleStop}
          isSending={isSending}
        />
      </div>
    </div>
  )
}
