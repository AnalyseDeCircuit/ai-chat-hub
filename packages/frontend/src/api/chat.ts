import apiClient from './client'
import type { ApiResponse, Message, Model } from '@ai-chat-hub/shared'
import { useAuthStore } from '@/stores/auth'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

export const chatApi = {
  /**
   * 获取可用模型列表
   */
  getModels: async (): Promise<Model[]> => {
    const response = await apiClient.get<ApiResponse<Model[]>>('/models')
    return response.data.data!
  },

  /**
   * 获取会话消息
   */
  getMessages: async (sessionId: string, before?: string, limit = 50): Promise<Message[]> => {
    const response = await apiClient.get<ApiResponse<Message[]>>(`/messages/session/${sessionId}`, {
      params: { before, limit },
    })
    return response.data.data!
  },

  /**
   * 发送消息（流式响应）
   */
  sendMessage: (
    sessionId: string,
    content: string,
    modelId: string,
    onChunk: (chunk: string) => void,
    onDone: (messageId: string, usage?: { promptTokens: number; completionTokens: number }) => void,
    onError: (error: string) => void,
    images?: Array<{ base64: string; mimeType: string }>,
    files?: Array<{ fileName: string; fileType: string; mimeType: string; base64Data: string; fileSize: number }>
  ): AbortController => {
    const controller = new AbortController()
    const { accessToken } = useAuthStore.getState()

    fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ sessionId, content, modelId, images, files }),
      signal: controller.signal,
      mode: 'cors',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error?.message || '请求失败')
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('无法读取响应流')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                if (parsed.type === 'content' && parsed.content) {
                  onChunk(parsed.content)
                } else if (parsed.type === 'done') {
                  onDone(parsed.messageId, parsed.usage)
                } else if (parsed.type === 'error') {
                  onError(parsed.error || '生成出错')
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          onError(error.message || '请求失败')
        }
      })

    return controller
  },

  /**
   * 停止生成
   */
  stopGeneration: async (sessionId: string): Promise<void> => {
    await apiClient.post('/chat/stop', { sessionId })
  },
}
