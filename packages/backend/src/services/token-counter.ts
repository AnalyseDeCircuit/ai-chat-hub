import type { ChatMessage } from '@ai-chat-hub/shared'

/**
 * Token 计数服务
 * 支持多种模型的 Token 计算
 */
export class TokenCounterService {
  /**
   * 计算消息的 Token 数量
   * @param messages 消息列表
   * @param model 模型名称
   * @param systemPrompt 系统提示（可选）
   */
  countTokens(messages: ChatMessage[], model: string, systemPrompt?: string): number {
    const provider = this.getProviderFromModel(model)

    switch (provider) {
      case 'openai':
        return this.countOpenAITokens(messages, model, systemPrompt)
      case 'anthropic':
        return this.countClaudeTokens(messages, systemPrompt)
      case 'google':
        return this.countGeminiTokens(messages, systemPrompt)
      default:
        return this.countGenericTokens(messages, systemPrompt)
    }
  }

  /**
   * 从模型名称推断 Provider
   */
  private getProviderFromModel(model: string): string {
    if (model.startsWith('gpt-')) return 'openai'
    if (model.startsWith('claude-')) return 'anthropic'
    if (model.startsWith('gemini-')) return 'google'
    if (model.startsWith('deepseek-')) return 'openai' // OpenAI 兼容
    if (model.startsWith('glm-')) return 'openai' // OpenAI 兼容
    if (model.startsWith('moonshot-')) return 'openai' // OpenAI 兼容
    return 'generic'
  }

  /**
   * OpenAI 模型的 Token 计算
   * 参考 tiktoken 的计算方式
   */
  private countOpenAITokens(
    messages: ChatMessage[],
    model: string,
    systemPrompt?: string
  ): number {
    let tokensPerMessage = 3

    // 不同模型的开销不同
    if (model.includes('gpt-3.5-turbo')) {
      tokensPerMessage = 4
    } else if (model.includes('gpt-4')) {
      tokensPerMessage = 3
    }

    let numTokens = 0

    // 计算系统提示
    if (systemPrompt) {
      numTokens += tokensPerMessage
      numTokens += this.estimateTokenCount(systemPrompt)
    }

    // 计算每条消息
    for (const message of messages) {
      numTokens += tokensPerMessage
      numTokens += this.estimateTokenCount(message.content)
      numTokens += this.estimateTokenCount(message.role)
    }

    // 每次回复的固定开销
    numTokens += 3

    return numTokens
  }

  /**
   * Claude 模型的 Token 计算
   * Anthropic 的 tokenizer 与 OpenAI 略有不同
   */
  private countClaudeTokens(messages: ChatMessage[], systemPrompt?: string): number {
    let numTokens = 0

    // 系统提示
    if (systemPrompt) {
      numTokens += this.estimateTokenCount(systemPrompt)
      numTokens += 5 // Claude 的系统提示开销
    }

    // 消息
    for (const message of messages) {
      numTokens += 4 // 每条消息的基础开销
      numTokens += this.estimateTokenCount(message.content)
    }

    numTokens += 3 // 回复开销

    return numTokens
  }

  /**
   * Gemini 模型的 Token 计算
   */
  private countGeminiTokens(messages: ChatMessage[], systemPrompt?: string): number {
    let numTokens = 0

    if (systemPrompt) {
      numTokens += this.estimateTokenCount(systemPrompt)
      numTokens += 3
    }

    for (const message of messages) {
      numTokens += 2 // Gemini 的开销较小
      numTokens += this.estimateTokenCount(message.content)
    }

    numTokens += 2

    return numTokens
  }

  /**
   * 通用 Token 计算（用于未知模型）
   */
  private countGenericTokens(messages: ChatMessage[], systemPrompt?: string): number {
    let numTokens = 0

    if (systemPrompt) {
      numTokens += this.estimateTokenCount(systemPrompt) + 4
    }

    for (const message of messages) {
      numTokens += this.estimateTokenCount(message.content) + 4
    }

    numTokens += 3

    return numTokens
  }

  /**
   * 估算文本的 Token 数量
   * 使用改进的启发式算法
   */
  private estimateTokenCount(text: string): number {
    if (!text) return 0

    // 统计不同类型的字符
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const japaneseChars = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length
    const koreanChars = (text.match(/[\uac00-\ud7af]/g) || []).length
    const emojiChars = (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length
    const otherChars = text.length - chineseChars - japaneseChars - koreanChars - emojiChars

    // 不同语言的 token 比例
    let tokens = 0
    tokens += Math.ceil(chineseChars / 1.5) // 中文约 1.5 字符 = 1 token
    tokens += Math.ceil(japaneseChars / 1.8) // 日文约 1.8 字符 = 1 token
    tokens += Math.ceil(koreanChars / 2) // 韩文约 2 字符 = 1 token
    tokens += emojiChars * 2 // Emoji 通常占 2 个 token
    tokens += Math.ceil(otherChars / 4) // 英文约 4 字符 = 1 token

    return tokens
  }

  /**
   * 估算生成回复所需的 Token 数量
   */
  estimateResponseTokens(maxTokens?: number): number {
    return maxTokens || 1000
  }

  /**
   * 计算总 Token 数（输入 + 预期输出）
   */
  calculateTotalTokens(
    messages: ChatMessage[],
    model: string,
    systemPrompt?: string,
    maxTokens?: number
  ): {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  } {
    const inputTokens = this.countTokens(messages, model, systemPrompt)
    const outputTokens = this.estimateResponseTokens(maxTokens)
    const totalTokens = inputTokens + outputTokens

    return {
      inputTokens,
      outputTokens,
      totalTokens,
    }
  }

  /**
   * 检查是否超过模型的上下文限制
   */
  isOverContextLimit(tokenCount: number, contextLimit: number): boolean {
    return tokenCount > contextLimit
  }

  /**
   * 检查是否接近上下文限制
   */
  isNearContextLimit(tokenCount: number, contextLimit: number, threshold = 0.9): boolean {
    return tokenCount >= contextLimit * threshold
  }
}

/**
 * 单例实例
 */
export const tokenCounterService = new TokenCounterService()
