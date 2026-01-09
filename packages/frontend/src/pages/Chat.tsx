import { useEffect, useRef, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Menu } from 'lucide-react'
import { Sidebar, MessageList, ChatInput, ModelSelector, ModelConfigDialog, ShareDialog, type UploadedImage } from '@/components/chat'
import { type UploadedFile } from '@/components/chat/FileUpload'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { sessionApi, chatApi, authApi } from '@/api'
import { getApiKeys } from '@/api/key'
import { buildSessionTitle } from '@/lib/utils'
import type { Session, Message, ApiKey } from '@ai-chat-hub/shared'

export default function ChatPage() {
  const navigate = useNavigate()
  const abortControllerRef = useRef<AbortController | null>(null)
  const [userKeys, setUserKeys] = useState<ApiKey[]>([])
  const [shareDialogUrl, setShareDialogUrl] = useState<string | null>(null)
  
  const { logout: authLogout, refreshToken } = useAuthStore()
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
        setCurrentModelId(data[0].id)
      }
    }).catch(console.error)
  }, [])

  // 过滤出用户已配置 API key 的模型
  const availableModels = models.filter((model) => {
    return userKeys.some((key) => key.provider === model.provider)
  })

  // 获取当前模型的 Vision 能力
  const currentModel = availableModels.find(m => m.id === currentModelId)
  const visionCapabilities = currentModel?.capabilities as any

  // 当可用模型列表变化时，确保选择了有效模型
  useEffect(() => {
    if (availableModels.length > 0) {
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

  // 归档会话
  const handleArchiveSession = useCallback(async (sessionId: string) => {
    try {
      const updatedSession = await sessionApi.archive(sessionId)
      setSessions(sessions.map(s => s.id === sessionId ? updatedSession : s))
      if (currentSession?.id === sessionId) {
        setCurrentSession(null)
      }
    } catch (error) {
      console.error('归档会话失败:', error)
    }
  }, [sessions, currentSession])

  // 取消归档
  const handleUnarchiveSession = useCallback(async (sessionId: string) => {
    try {
      const updatedSession = await sessionApi.unarchive(sessionId)
      setSessions(sessions.map(s => s.id === sessionId ? updatedSession : s))
    } catch (error) {
      console.error('取消归档失败:', error)
    }
  }, [sessions])

  // 分享会话
  const handleShareSession = useCallback(async (sessionId: string) => {
    try {
      const { shareUrl } = await sessionApi.share(sessionId)
      setShareDialogUrl(shareUrl)
    } catch (error) {
      console.error('分享失败:', error)
    }
  }, [])

  // 发送消息
  const handleSendMessage = useCallback(async (content: string, images?: UploadedImage[], files?: UploadedFile[]) => {
    if (!currentModelId) {
      alert('请先选择模型')
      return
    }

    let sessionId = currentSession?.id

    // 如果没有当前会话，先创建
    if (!sessionId) {
      try {
        const session = await sessionApi.create({ title: buildSessionTitle(content) })
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

    // 转换图片格式
    const imageData = images?.map(img => ({
      base64: img.base64,
      mimeType: img.mimeType,
    }))

    // 转换文件格式
    const fileData = files?.map(file => ({
      fileName: file.fileName,
      fileType: file.fileType,
      mimeType: file.mimeType,
      base64Data: '',
      fileSize: file.file.size,
    }))

    // 如果有文件，需要读取 base64
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const reader = new FileReader()
        await new Promise<void>((resolve) => {
          reader.onload = (e) => {
            const result = e.target?.result as string
            const base64 = result.split(',')[1]
            if (fileData && fileData[i]) {
              fileData[i].base64Data = base64
            }
            resolve()
          }
          reader.readAsDataURL(file.file)
        })
      }
    }

    // 发送请求
    abortControllerRef.current = chatApi.sendMessage(
      sessionId,
      content,
      currentModelId,
      (chunk) => {
        appendToMessage(assistantMessageId, chunk)
      },
      (messageId, usage) => {
        finishStreamingMessage(assistantMessageId, messageId, usage)
        setSending(false)
        abortControllerRef.current = null
      },
      (error) => {
        updateMessage(assistantMessageId, {
          isStreaming: false,
          content: `错误: ${error}`,
        } as any)
        setSending(false)
        abortControllerRef.current = null
      },
      imageData,
      fileData
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

  // 重新生成消息
  const handleRegenerate = useCallback(async (messageId: string) => {
    if (!currentModelId || isSending) return

    // 创建新的助手消息占位
    const newMessageId = `temp-regenerate-${Date.now()}`
    const newMessage: Message & { isStreaming: boolean; streamContent: string } = {
      id: newMessageId,
      sessionId: currentSession?.id || '',
      parentId: messageId,
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
    addMessage(newMessage)
    setSending(true)

    // 发送重新生成请求
    abortControllerRef.current = chatApi.regenerateMessage(
      messageId,
      currentModelId,
      (chunk) => {
        appendToMessage(newMessageId, chunk)
      },
      (finalMessageId, usage) => {
        finishStreamingMessage(newMessageId, finalMessageId, usage)
        setSending(false)
        abortControllerRef.current = null
      },
      (error) => {
        updateMessage(newMessageId, {
          isStreaming: false,
          content: `错误: ${error}`,
        } as any)
        setSending(false)
        abortControllerRef.current = null
      }
    )
  }, [currentSession, currentModelId, isSending])

  // 消息反馈
  const handleFeedback = useCallback(async (messageId: string, rating: -1 | 1) => {
    try {
      await chatApi.submitFeedback(messageId, rating)
    } catch (error) {
      console.error('提交反馈失败:', error)
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
    <div className="h-screen w-screen overflow-hidden bg-background flex">
      {/* Sidebar */}
      <Sidebar
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onArchiveSession={handleArchiveSession}
        onUnarchiveSession={handleUnarchiveSession}
        onShareSession={handleShareSession}
        onLogout={handleLogout}
      />

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-primary/5 to-transparent" />
          <div 
            className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] animate-pulse" 
            style={{ animationDuration: '8s' }} 
          />
          <div 
            className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[80px] animate-pulse" 
            style={{ animationDuration: '12s', animationDelay: '2s' }} 
          />
        </div>

        {/* Header */}
        <header className="h-14 flex-shrink-0 flex items-center px-4 border-b border-border/40 bg-background/80 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {!sidebarOpen && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleSidebar}
                className="flex-shrink-0 rounded-lg hover:bg-accent"
              >
                <Menu className="w-5 h-5" />
              </Button>
            )}
            <div className="flex items-center gap-2 min-w-0">
              <Bot className="w-5 h-5 text-primary flex-shrink-0" />
              <h1 className="font-semibold truncate">
                {currentSession?.title || '新对话'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModelSelector
              models={availableModels}
              selectedModelId={currentModelId}
              onModelChange={handleModelChange}
              disabled={isSending}
            />
            <ModelConfigDialog
              modelId={currentModelId}
              modelName={currentModel?.displayName}
              disabled={isSending}
            />
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <MessageList
            messages={messages as any}
            isLoading={isLoading || isSending}
            models={models}
            onRegenerate={handleRegenerate}
            onFeedback={handleFeedback}
          />
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t border-border/40 bg-background/80 backdrop-blur-xl relative z-10">
          <ChatInput
            onSend={handleSendMessage}
            onStop={handleStop}
            isSending={isSending}
            visionCapabilities={visionCapabilities}
          />
        </div>
      </main>

      {/* Share Dialog */}
      {shareDialogUrl && (
        <ShareDialog shareUrl={shareDialogUrl} onClose={() => setShareDialogUrl(null)} />
      )}
    </div>
  )
}
