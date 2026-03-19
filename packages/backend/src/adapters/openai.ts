import { BaseAdapter, type CompletionOptions } from './base.js'
import type { ChatMessage, StreamChunk, ToolCall, ToolDefinition } from '@ai-chat-hub/shared'

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null | Array<{
    type: 'text' | 'image_url'
    text?: string
    image_url?: {
      url: string
      detail?: 'low' | 'high' | 'auto'
    }
  }>
  tool_calls?: OpenAIToolCall[]
  tool_call_id?: string
  name?: string
}

interface OpenAIToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: object
  }
}

interface OpenAIStreamChoice {
  delta: {
    content?: string
    role?: string
    tool_calls?: Array<{
      index: number
      id?: string
      type?: 'function'
      function?: {
        name?: string
        arguments?: string
      }
    }>
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
    'o1',
    'o1-mini',
    'o1-preview',
    'o3-mini',
  ]

  // 支持 Function Calling 的模型
  private readonly toolSupportedModels = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
  ]

  private readonly baseUrl = 'https://api.openai.com/v1'

  /**
   * 检查模型是否支持 Function Calling
   */
  supportsTools(model: string): boolean {
    return this.toolSupportedModels.some(m => model.includes(m))
  }

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
      if (msg.role === 'tool') {
        // 工具结果消息
        openaiMessages.push({
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.toolCallId!,
          name: msg.name,
        })
      } else if (msg.toolCalls && msg.toolCalls.length > 0) {
        // 助手消息带有工具调用
        openaiMessages.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
        })
      } else if (msg.images && msg.images.length > 0) {
        // 检查是否有图片（多模态）
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

    // 构建请求体
    const requestBody: Record<string, unknown> = {
      model,
      messages: openaiMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      top_p: options.topP ?? 1,
      stream: true,
      stream_options: { include_usage: true },
    }

    // 添加工具定义（如果有且模型支持）
    if (options.tools && options.tools.length > 0 && this.supportsTools(model)) {
      requestBody.tools = this.convertTools(options.tools)
      
      // 工具选择策略
      if (options.toolChoice) {
        if (typeof options.toolChoice === 'string') {
          requestBody.tool_choice = options.toolChoice
        } else {
          requestBody.tool_choice = {
            type: 'function',
            function: { name: options.toolChoice.name },
          }
        }
      }
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
      const error = await response.json() as { error?: { message?: string } }
      throw new Error(error.error?.message || `OpenAI API 错误: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined

    // 用于收集流式 tool_calls
    const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>()

    try {
      while (true) {
        if (signal?.aborted) {
          break
        }
        
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

              const choice = data.choices[0]
              
              // 处理内容
              if (choice?.delta?.content) {
                onChunk({
                  type: 'content',
                  content: choice.delta.content,
                })
              }

              // 处理流式 tool_calls
              if (choice?.delta?.tool_calls) {
                for (const tc of choice.delta.tool_calls) {
                  const existing = toolCallsMap.get(tc.index)
                  if (!existing) {
                    // 新的 tool_call
                    toolCallsMap.set(tc.index, {
                      id: tc.id || '',
                      name: tc.function?.name || '',
                      arguments: tc.function?.arguments || '',
                    })
                  } else {
                    // 追加到现有 tool_call
                    if (tc.id) existing.id = tc.id
                    if (tc.function?.name) existing.name += tc.function.name
                    if (tc.function?.arguments) existing.arguments += tc.function.arguments
                  }
                }
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
              } else if (choice?.finish_reason === 'tool_calls') {
                // 发送所有收集到的 tool_calls
                for (const [, tc] of toolCallsMap) {
                  const toolCall: ToolCall = {
                    id: tc.id,
                    name: tc.name,
                    arguments: tc.arguments,
                  }
                  onChunk({
                    type: 'tool_call',
                    toolCall,
                  })
                }
                // 发送完成信号
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
   * 转换工具定义为 OpenAI 格式
   */
  private convertTools(tools: ToolDefinition[]): OpenAITool[] {
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }))
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

      // 工具调用也计算 token
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          count += Math.ceil(tc.name.length / 4) + Math.ceil(tc.arguments.length / 4)
        }
      }
    }

    // 消息格式开销
    count += 3

    return count
  }
}
