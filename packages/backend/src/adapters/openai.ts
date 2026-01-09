import { BaseAdapter, type CompletionOptions } from './base.js'
import type { ChatMessage, StreamChunk } from '@ai-chat-hub/shared'

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{
    type: 'text' | 'image_url'
    text?: string
    image_url?: {
      url: string
      detail?: 'low' | 'high' | 'auto'
    }
  }>
}

interface OpenAIStreamChoice {
  delta: {
    content?: string
    role?: string
  }
  finish_reason: string | null
  index: number
}

interface OpenAIStreamResponse {
  id: string
  object: string
  created: number
  model: string
  choices: OpenAIStreamChoice[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export class OpenAIAdapter extends BaseAdapter {
  readonly provider = 'openai'
  readonly models = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
  ]

  private readonly baseUrl = 'https://api.openai.com/v1'

  /**
   * 验证 API 密钥
   */
  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })
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
    // 构建消息
    const openaiMessages: OpenAIMessage[] = []

    // 添加系统提示
    if (options.systemPrompt) {
      openaiMessages.push({
        role: 'system',
        content: options.systemPrompt,
      })
    }

    // 转换消息格式
    for (const msg of messages) {
      // 检查是否有图片（多模态）
      if (msg.images && msg.images.length > 0) {
        const contentParts: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> = []
        
        // 添加文本内容
        if (msg.content) {
          contentParts.push({
            type: 'text',
            text: msg.content,
          })
        }
        
        // 添加图片
        for (const img of msg.images) {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: `data:${img.mimeType};base64,${img.base64Data}`,
            },
          })
        }
        
        openaiMessages.push({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: contentParts,
        })
      } else {
        // 纯文本消息
        openaiMessages.push({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })
      }
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: openaiMessages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        top_p: options.topP ?? 1,
        stream: true,
        stream_options: { include_usage: true },
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `OpenAI API 错误: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue

          if (trimmed.startsWith('data: ')) {
            try {
              const data: OpenAIStreamResponse = JSON.parse(trimmed.slice(6))

              // 处理内容
              const choice = data.choices[0]
              if (choice?.delta?.content) {
                onChunk({
                  type: 'content',
                  content: choice.delta.content,
                })
              }

              // 处理用量统计
              if (data.usage) {
                usage = {
                  promptTokens: data.usage.prompt_tokens,
                  completionTokens: data.usage.completion_tokens,
                  totalTokens: data.usage.total_tokens,
                }
              }

              // 处理完成
              if (choice?.finish_reason === 'stop') {
                onChunk({
                  type: 'done',
                  usage,
                })
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Token 计算（使用 tiktoken 估算）
   * 简化版：英文约 4 字符/token，中文约 2 字符/token
   */
  countTokens(messages: ChatMessage[]): number {
    let count = 0
    for (const msg of messages) {
      // 基础 token（role 等）
      count += 4

      // 内容 token
      const content = msg.content
      // 检测中文字符比例
      const chineseChars = content.match(/[\u4e00-\u9fff]/g)?.length || 0
      const otherChars = content.length - chineseChars

      count += Math.ceil(chineseChars / 1.5) + Math.ceil(otherChars / 4)
    }

    // 消息格式开销
    count += 3

    return count
  }
}
