/**
 * useStreamingChat - 增强的流式聊天 Hook
 * 支持推理过程、工具调用等结构化流式数据
 */
import { useCallback, useRef } from 'react'
import { useChatStore, type ChatMessage } from '../stores/chat'
import type { StreamChunk } from '../stores/slices/stream.slice'

interface StreamingOptions {
  onStart?: (messageId: string) => void
  onContent?: (content: string, total: string) => void
  onReasoning?: (reasoning: string, total: string) => void
  onToolCall?: (toolCall: StreamChunk['toolCall']) => void
  onComplete?: (message: ChatMessage) => void
  onError?: (error: string) => void
}

export function useStreamingChat() {
  const abortControllerRef = useRef<AbortController | null>(null)
  
  const {
    startStream,
    appendContent,
    appendReasoning,
    addToolCall,
    finishStream,
    abortStream,
    addMessage,
  } = useChatStore()

  /**
   * 处理 SSE 流式响应
   */
  const handleSSEStream = useCallback(async (
    response: Response,
    messageId: string,
    options?: StreamingOptions
  ) => {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法获取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          try {
            const chunk = JSON.parse(data) as StreamChunk
            
            switch (chunk.type) {
              case 'content':
                if (chunk.content) {
                  appendContent(messageId, chunk.content)
                  const stream = useChatStore.getState().activeStreams.get(messageId)
                  options?.onContent?.(chunk.content, stream?.content || '')
                }
                break
                
              case 'reasoning':
                if (chunk.content) {
                  appendReasoning(messageId, chunk.content)
                  const stream = useChatStore.getState().activeStreams.get(messageId)
                  options?.onReasoning?.(chunk.content, stream?.reasoning || '')
                }
                break
                
              case 'tool_call':
                if (chunk.toolCall) {
                  addToolCall(messageId, chunk.toolCall)
                  options?.onToolCall?.(chunk.toolCall)
                }
                break
                
              case 'done':
                finishStream(messageId, chunk.usage)
                const message = useChatStore.getState().messages.find(m => m.id === messageId)
                if (message) {
                  options?.onComplete?.(message)
                }
                break
                
              case 'error':
                if (chunk.error) {
                  options?.onError?.(chunk.error)
                }
                break
            }
          } catch (e) {
            console.warn('解析流式数据失败:', data)
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }, [appendContent, appendReasoning, addToolCall, finishStream])

  /**
   * 发送聊天消息并处理流式响应
   */
  const sendMessage = useCallback(async (
    url: string,
    body: Record<string, unknown>,
    options?: StreamingOptions
  ) => {
    // 创建中止控制器
    abortControllerRef.current = new AbortController()
    
    // 生成临时消息 ID
    const tempMessageId = `temp-${Date.now()}`
    
    // 添加助手消息占位符
    const assistantMessage: ChatMessage = {
      id: tempMessageId,
      sessionId: body.sessionId as string,
      parentId: null,
      role: 'assistant',
      content: '',
      modelId: body.modelId as string || null,
      tokensInput: 0,
      tokensOutput: 0,
      version: 1,
      createdAt: new Date(),
      isStreaming: true,
      metadata: {},
    }
    
    addMessage(assistantMessage)
    startStream(tempMessageId)
    options?.onStart?.(tempMessageId)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      await handleSSEStream(response, tempMessageId, options)
      
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        abortStream(tempMessageId)
      } else {
        const errorMsg = (error as Error).message || '请求失败'
        options?.onError?.(errorMsg)
        abortStream(tempMessageId)
      }
      throw error
    }
  }, [addMessage, startStream, handleSSEStream, abortStream])

  /**
   * 停止当前生成
   */
  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }, [])

  return {
    sendMessage,
    stopGeneration,
  }
}
