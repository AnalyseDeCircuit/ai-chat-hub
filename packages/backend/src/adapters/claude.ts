import { BaseAdapter, type CompletionOptions } from './base.js'
import type { ChatMessage, StreamChunk, ToolCall, ToolDefinition } from '@ai-chat-hub/shared'

type ClaudeContentBlock = 
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

interface ClaudeTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
}

interface ClaudeStreamEvent {
  type: string
  index?: number
  delta?: {
    type: string
    text?: string
    partial_json?: string
  }
  content_block?: {
    type: string
    id?: string
    name?: string
    text?: string
    input?: Record<string, unknown>
  }
  message?: {
    id: string
    type: string
    role: string
    content: ClaudeContentBlock[]
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
    'claude-sonnet-4-20250514',
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ]

  // 支持 Function Calling 的模型（所有 Claude 3+ 都支持）
  private readonly toolSupportedModels = [
    'claude-sonnet-4',
    'claude-3-7-sonnet',
    'claude-3-5-sonnet',
    'claude-3-opus',
    'claude-3-sonnet',
    'claude-3-haiku',
  ]

  private readonly baseUrl = 'https://api.anthropic.com/v1'
  private readonly apiVersion = '2023-06-01'

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
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void> {
    // 转换消息格式
    const claudeMessages: ClaudeMessage[] = []
    let systemPrompt = options.systemPrompt

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Claude 的 system 不在 messages 中，而是单独的参数
        systemPrompt = (systemPrompt ? systemPrompt + '\n\n' : '') + msg.content
      } else if (msg.role === 'tool') {
        // 工具结果消息 - Claude 使用 user 角色 + tool_result content block
        // 需要合并到前一个 user 消息或创建新的 user 消息
        const toolResultBlock: ClaudeContentBlock = {
          type: 'tool_result',
          tool_use_id: msg.toolCallId!,
          content: msg.content,
        }
        
        // 查找最后一个 user 消息并添加到其中，或创建新的
        const lastMsg = claudeMessages[claudeMessages.length - 1]
        if (lastMsg && lastMsg.role === 'user') {
          if (typeof lastMsg.content === 'string') {
            lastMsg.content = [{ type: 'text', text: lastMsg.content }, toolResultBlock]
          } else {
            (lastMsg.content as ClaudeContentBlock[]).push(toolResultBlock)
          }
        } else {
          claudeMessages.push({
            role: 'user',
            content: [toolResultBlock],
          })
        }
      } else if (msg.toolCalls && msg.toolCalls.length > 0) {
        // 助手消息带有工具调用
        const contentBlocks: ClaudeContentBlock[] = []
        
        if (msg.content) {
          contentBlocks.push({ type: 'text', text: msg.content })
        }
        
        for (const tc of msg.toolCalls) {
          contentBlocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: JSON.parse(tc.arguments),
          })
        }
        
        claudeMessages.push({
          role: 'assistant',
          content: contentBlocks,
        })
      } else if (msg.images && msg.images.length > 0) {
        // 检查是否有图片（多模态）
        const contentParts: ClaudeContentBlock[] = []
        
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
            type: 'image',
            source: {
              type: 'base64',
              media_type: img.mimeType,
              data: img.base64Data,
            },
          })
        }
        
        claudeMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: contentParts,
        })
      } else {
        // 纯文本消息
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

    const requestBody: Record<string, unknown> = {
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

    // 添加工具定义（如果有且模型支持）
    if (options.tools && options.tools.length > 0 && this.supportsTools(model)) {
      requestBody.tools = this.convertTools(options.tools)
      
      // 工具选择策略
      if (options.toolChoice) {
        if (options.toolChoice === 'auto') {
          requestBody.tool_choice = { type: 'auto' }
        } else if (options.toolChoice === 'required') {
          requestBody.tool_choice = { type: 'any' }
        } else if (options.toolChoice === 'none') {
          // Claude 没有 none，不传 tool_choice
        } else if (typeof options.toolChoice === 'object') {
          requestBody.tool_choice = { type: 'tool', name: options.toolChoice.name }
        }
      }
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': this.apiVersion,
      },
      body: JSON.stringify(requestBody),
      signal,
    })

    if (!response.ok) {
      const error = await response.json() as { error?: { message?: string } }
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
    
    // 用于收集流式 tool_use
    const toolUseBlocks: { id: string; name: string; input: string }[] = []

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
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          if (data === '[DONE]') continue

          try {
            const event: ClaudeStreamEvent = JSON.parse(data)

            if (event.type === 'message_start' && event.message?.usage) {
              inputTokens = event.message.usage.input_tokens
            } else if (event.type === 'content_block_start') {
              // 开始一个新的内容块
              if (event.content_block?.type === 'tool_use') {
                // 新的工具调用开始
                toolUseBlocks.push({
                  id: event.content_block.id || '',
                  name: event.content_block.name || '',
                  input: '',
                })
              }
            } else if (event.type === 'content_block_delta') {
              if (event.delta?.type === 'text_delta' && event.delta.text) {
                onChunk({
                  type: 'content',
                  content: event.delta.text,
                })
              } else if (event.delta?.type === 'input_json_delta' && event.delta.partial_json) {
                // 追加 tool input 的 JSON 片段
                const currentBlock = toolUseBlocks[toolUseBlocks.length - 1]
                if (currentBlock) {
                  currentBlock.input += event.delta.partial_json
                }
              }
            } else if (event.type === 'message_delta' && event.usage) {
              outputTokens = event.usage.output_tokens
            } else if (event.type === 'message_stop') {
              // 如果有工具调用，先发送它们
              for (const tu of toolUseBlocks) {
                const toolCall: ToolCall = {
                  id: tu.id,
                  name: tu.name,
                  arguments: tu.input,
                }
                onChunk({
                  type: 'tool_call',
                  toolCall,
                })
              }
              
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
   * 转换工具定义为 Claude 格式
   */
  private convertTools(tools: ToolDefinition[]): ClaudeTool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: tool.parameters.properties,
        required: tool.parameters.required,
      },
    }))
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
      
      // 工具调用也计算 token
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          count += Math.ceil(tc.name.length / 4) + Math.ceil(tc.arguments.length / 4)
        }
      }
    }
    count += 3 // 消息格式开销
    return count
  }
}
