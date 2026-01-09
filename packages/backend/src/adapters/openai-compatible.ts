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

/**
 * OpenAI 兼容适配器
 * 支持所有使用 OpenAI API 格式的服务商
 */
export class OpenAICompatibleAdapter extends BaseAdapter {
  readonly provider: string
  readonly models: string[]
  private readonly baseUrl: string

  constructor(provider: string, baseUrl: string, models: string[] = []) {
    super()
    this.provider = provider
    this.baseUrl = baseUrl.replace(/\/$/, '') // 移除末尾的斜杠
    this.models = models
  }

  /**
   * 验证 API 密钥
   */
  async validateKey(apiKey: string): Promise<boolean> {
    try {
      // 尝试获取模型列表
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })

      // 如果模型列表接口不存在，尝试发送最小请求
      if (response.status === 404) {
        const testResponse = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: this.models[0] || 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 1,
            stream: false,
          }),
        })
        return testResponse.ok || testResponse.status === 400 // 400 也说明认证成功
      }

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
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal
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

    const requestBody: any = {
      model,
      messages: openaiMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      top_p: options.topP ?? 1,
      stream: true,
    }

    // 某些服务商可能不支持 stream_options
    if (this.provider === 'openai' || this.provider === 'azure') {
      requestBody.stream_options = { include_usage: true }
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: { message?: string }; message?: string }
      throw new Error(
        error.error?.message || error.message || `API 错误: ${response.status}`
      )
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
        if (signal?.aborted) break
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
              if (choice?.finish_reason === 'stop' || choice?.finish_reason === 'length') {
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

      // 如果没有收到完成信号，手动发送
      if (!usage) {
        onChunk({
          type: 'done',
        })
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Token 计算（通用估算）
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

/**
 * 预定义的 OpenAI 兼容服务商配置
 */
export const OPENAI_COMPATIBLE_PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder'],
  },
  zhipu: {
    name: '智谱 AI (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4', 'glm-3-turbo'],
  },
  moonshot: {
    name: 'Moonshot AI (Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  },
  azure: {
    name: 'Azure OpenAI',
    baseUrl: '', // 用户需要自定义
    models: ['gpt-4', 'gpt-35-turbo'],
  },
  custom: {
    name: '自定义端点',
    baseUrl: '', // 用户完全自定义
    models: [],
  },
} as const

/**
 * 创建 OpenAI 兼容适配器
 */
export function createOpenAICompatibleAdapter(
  provider: string,
  customBaseUrl?: string
): OpenAICompatibleAdapter {
  const config = OPENAI_COMPATIBLE_PROVIDERS[provider as keyof typeof OPENAI_COMPATIBLE_PROVIDERS]

  if (!config) {
    throw new Error(`Unknown OpenAI-compatible provider: ${provider}`)
  }

  const baseUrl = customBaseUrl || config.baseUrl
  if (!baseUrl) {
    throw new Error(`Base URL is required for provider: ${provider}`)
  }

  return new OpenAICompatibleAdapter(provider, baseUrl, [...config.models])
}
