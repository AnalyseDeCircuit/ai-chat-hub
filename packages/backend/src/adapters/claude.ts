import { BaseAdapter, type CompletionOptions } from './base.js'
import type { ChatMessage, StreamChunk } from '@ai-chat-hub/shared'

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ClaudeStreamEvent {
  type: string
  index?: number
  delta?: {
    type: string
    text?: string
  }
  message?: {
    id: string
    type: string
    role: string
    content: any[]
    model: string
    stop_reason: string | null
    stop_sequence: string | null
    usage: {
      input_tokens: number
      output_tokens: number
    }
  }
  usage?: {
    input_tokens: number
    output_tokens: number
  }
}

export class ClaudeAdapter extends BaseAdapter {
  readonly provider = 'anthropic'
  readonly models = [
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ]

  private readonly baseUrl = 'https://api.anthropic.com/v1'
  private readonly apiVersion = '2023-06-01'

  /**
   * 验证 API 密钥
   */
  async validateKey(apiKey: string): Promise<boolean> {
    try {
      // Claude 没有专门的验证端点，我们尝试发送一个最小的请求
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      })
      return response.ok || response.status === 400 // 400 也说明密钥有效
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
    const claudeMessages: ClaudeMessage[] = []
    let systemPrompt = options.systemPrompt

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Claude 的 system 不在 messages 中，而是单独的参数
        systemPrompt = (systemPrompt ? systemPrompt + '\n\n' : '') + msg.content
      } else {
        claudeMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })
      }
    }

    // 确保消息以 user 开头
    if (claudeMessages.length > 0 && claudeMessages[0].role !== 'user') {
      claudeMessages.unshift({
        role: 'user',
        content: 'Continue the conversation.',
      })
    }

    const requestBody: any = {
      model,
      messages: claudeMessages,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
    }

    if (systemPrompt) {
      requestBody.system = systemPrompt
    }

    if (options.temperature !== undefined) {
      requestBody.temperature = options.temperature
    }

    if (options.topP !== undefined) {
      requestBody.top_p = options.topP
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': this.apiVersion,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(
        error.error?.message || `Claude API 错误: ${response.status}`
      )
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let inputTokens = 0
    let outputTokens = 0

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
          if (data === '[DONE]') continue

          try {
            const event: ClaudeStreamEvent = JSON.parse(data)

            if (event.type === 'message_start' && event.message?.usage) {
              inputTokens = event.message.usage.input_tokens
            } else if (event.type === 'content_block_delta' && event.delta?.text) {
              onChunk({
                type: 'content',
                content: event.delta.text,
              })
            } else if (event.type === 'message_delta' && event.usage) {
              outputTokens = event.usage.output_tokens
            } else if (event.type === 'message_stop') {
              onChunk({
                type: 'done',
                usage: {
                  promptTokens: inputTokens,
                  completionTokens: outputTokens,
                  totalTokens: inputTokens + outputTokens,
                },
              })
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Token 计算（Claude 和 OpenAI 类似）
   */
  countTokens(messages: ChatMessage[]): number {
    let count = 0
    for (const msg of messages) {
      count += 4 // 基础开销
      const content = msg.content
      const chineseChars = content.match(/[\u4e00-\u9fff]/g)?.length || 0
      const otherChars = content.length - chineseChars
      count += Math.ceil(chineseChars / 1.5) + Math.ceil(otherChars / 4)
    }
    count += 3 // 消息格式开销
    return count
  }
}
