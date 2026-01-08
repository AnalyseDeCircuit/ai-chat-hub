import { BaseAdapter, type CompletionOptions } from './base.js'
import type { ChatMessage, StreamChunk } from '@ai-chat-hub/shared'

interface GeminiContent {
  role: string
  parts: Array<{ text: string }>
}

interface GeminiStreamResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text?: string }>
      role: string
    }
    finishReason?: string
  }>
  usageMetadata?: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
}

export class GeminiAdapter extends BaseAdapter {
  readonly provider = 'google'
  readonly models = ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro']

  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta'

  /**
   * 验证 API 密钥
   */
  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models?key=${apiKey}`)
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * 流式对话完成
   */
  async streamCompletion(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    options: CompletionOptions,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    // 转换消息格式
    const contents: GeminiContent[] = []
    let systemInstruction = options.systemPrompt

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = (systemInstruction ? systemInstruction + '\n\n' : '') + msg.content
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })
      }
    }

    const requestBody: any = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
        topP: options.topP ?? 1,
      },
    }

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }],
      }
    }

    const response = await fetch(
      `${this.baseUrl}/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `Gemini API 错误: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let totalInputTokens = 0
    let totalOutputTokens = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)

          try {
            const response: GeminiStreamResponse = JSON.parse(data)

            if (response.candidates && response.candidates[0]) {
              const candidate = response.candidates[0]
              const text = candidate.content.parts[0]?.text

              if (text) {
                onChunk({
                  type: 'content',
                  content: text,
                })
              }

              if (candidate.finishReason && candidate.finishReason !== 'STOP') {
                // 处理非正常结束
                if (candidate.finishReason === 'SAFETY') {
                  onChunk({
                    type: 'error',
                    error: '内容被安全过滤器拦截',
                  })
                }
              }
            }

            if (response.usageMetadata) {
              totalInputTokens = response.usageMetadata.promptTokenCount
              totalOutputTokens = response.usageMetadata.candidatesTokenCount
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      // 发送完成消息
      onChunk({
        type: 'done',
        usage: {
          promptTokens: totalInputTokens,
          completionTokens: totalOutputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
        },
      })
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Token 计算
   */
  countTokens(messages: ChatMessage[]): number {
    let count = 0
    for (const msg of messages) {
      count += 4
      const content = msg.content
      const chineseChars = content.match(/[\u4e00-\u9fff]/g)?.length || 0
      const otherChars = content.length - chineseChars
      count += Math.ceil(chineseChars / 1.5) + Math.ceil(otherChars / 4)
    }
    count += 3
    return count
  }
}
