import type { ChatMessage, StreamChunk, ToolDefinition } from '@ai-chat-hub/shared'

export interface CompletionOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
  systemPrompt?: string
  tools?: ToolDefinition[] // Function Calling 工具列表
  toolChoice?: 'auto' | 'none' | 'required' | { name: string } // 工具选择策略
}

export interface ModelAdapter {
  readonly provider: string
  readonly models: string[]

  /**
   * 验证 API 密钥
   */
  validateKey(apiKey: string): Promise<boolean>

  /**
   * 发送消息（流式响应）
   * @param signal - AbortSignal 用于取消请求
   */
  streamCompletion(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    options: CompletionOptions,
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void>

  /**
   * 计算 Token 数量（估算）
   */
  countTokens(messages: ChatMessage[]): number

  /**
   * 检查模型是否支持 Function Calling
   */
  supportsTools?(model: string): boolean
}

/**
 * 基础适配器抽象类
 */
export abstract class BaseAdapter implements ModelAdapter {
  abstract readonly provider: string
  abstract readonly models: string[]

  abstract validateKey(apiKey: string): Promise<boolean>

  abstract streamCompletion(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    options: CompletionOptions,
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void>

  /**
   * 简单的 Token 估算（约 4 字符 = 1 token）
   */
  countTokens(messages: ChatMessage[]): number {
    let totalChars = 0
    for (const msg of messages) {
      totalChars += msg.content.length
      totalChars += msg.role.length
    }
    return Math.ceil(totalChars / 4)
  }

  /**
   * 检查是否接近上下文限制
   */
  isNearContextLimit(tokens: number, contextLimit: number, threshold = 0.9): boolean {
    return tokens >= contextLimit * threshold
  }

  /**
   * 默认不支持 Function Calling，子类可覆盖
   */
  supportsTools(_model: string): boolean {
    return false
  }
}
