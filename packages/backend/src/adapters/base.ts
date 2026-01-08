import type { ChatMessage, StreamChunk } from '@ai-chat-hub/shared'

export interface CompletionOptions {
  temperature?: number
  maxTokens?: number
  topP?: number
  systemPrompt?: string
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
   */
  streamCompletion(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    options: CompletionOptions,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void>

  /**
   * 计算 Token 数量（估算）
   */
  countTokens(messages: ChatMessage[]): number
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
    onChunk: (chunk: StreamChunk) => void
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
}
