import type { ChatMessage } from '@ai-chat-hub/shared'
import { tokenCounterService } from './token-counter.js'
import { MODEL_CONTEXT_LIMITS } from '@ai-chat-hub/shared'

export interface ContextWindow {
  messages: ChatMessage[]
  totalTokens: number
  truncated: boolean
  removedCount: number
}

/**
 * 上下文管理服务
 * 负责智能截断和管理对话历史
 */
export class ContextManagerService {
  /**
   * 获取优化后的消息列表（智能截断）
   */
  getOptimizedMessages(
    messages: ChatMessage[],
    model: string,
    systemPrompt?: string,
    maxTokens?: number
  ): ContextWindow {
    const contextLimit = this.getContextLimit(model)
    const reservedTokens = maxTokens || 2048 // 为回复预留的 token
    const availableTokens = contextLimit - reservedTokens

    // 计算当前 token 数
    const currentTokens = tokenCounterService.countTokens(messages, model, systemPrompt)

    // 如果没有超限，直接返回
    if (currentTokens <= availableTokens) {
      return {
        messages,
        totalTokens: currentTokens,
        truncated: false,
        removedCount: 0,
      }
    }

    // 需要截断，使用滑动窗口策略
    return this.truncateMessages(messages, model, availableTokens, systemPrompt)
  }

  /**
   * 智能截断消息
   * 性能优化的策略：保留第一条用户消息（主要问题）+ 最近的消息
   * 这样既节省 token，又不会丢失对话背景
   */
  private truncateMessages(
    messages: ChatMessage[],
    model: string,
    availableTokens: number,
    systemPrompt?: string
  ): ContextWindow {
    if (messages.length === 0) {
      return {
        messages: [],
        totalTokens: 0,
        truncated: false,
        removedCount: 0,
      }
    }

    // 只有1-2条消息，不需要截断
    if (messages.length <= 2) {
      const totalTokens = tokenCounterService.countTokens(messages, model, systemPrompt)
      return {
        messages,
        totalTokens,
        truncated: false,
        removedCount: 0,
      }
    }

    const result: ChatMessage[] = []
    let currentTokens = systemPrompt
      ? tokenCounterService.countTokens([], model, systemPrompt)
      : 0

    // 策略1：找到并保留第一条用户消息（通常包含主要问题/背景）
    let firstUserMsgIdx = -1
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === 'user') {
        firstUserMsgIdx = i
        break
      }
    }

    // 如果找到第一条用户消息，尝试保留它
    if (firstUserMsgIdx >= 0) {
      const firstMsg = messages[firstUserMsgIdx]
      const firstMsgTokens = tokenCounterService.countTokens([firstMsg], model)
      
      // 只有在不超过预算时才保留
      if (currentTokens + firstMsgTokens <= availableTokens) {
        result.push(firstMsg)
        currentTokens += firstMsgTokens
      }
    }

    // 策略2：保留最近的消息（从后往前）
    for (let i = messages.length - 1; i >= 0; i--) {
      // 跳过已经添加的第一条用户消息
      if (firstUserMsgIdx >= 0 && i <= firstUserMsgIdx) {
        break
      }

      const message = messages[i]
      const messageTokens = tokenCounterService.countTokens([message], model)

      if (currentTokens + messageTokens <= availableTokens) {
        result.splice(firstUserMsgIdx >= 0 ? 1 : 0, 0, message) // 插入到第一条消息之后
        currentTokens += messageTokens
      } else {
        break
      }
    }

    const removedCount = messages.length - result.length

    return {
      messages: result,
      totalTokens: currentTokens,
      truncated: removedCount > 0,
      removedCount,
    }
  }

  /**
   * 智能截断 - 高级版本
   * 保留重要的早期消息（如用户的初始问题）
   */
  smartTruncate(
    messages: ChatMessage[],
    model: string,
    availableTokens: number,
    systemPrompt?: string,
    preserveFirstN: number = 2
  ): ContextWindow {
    if (messages.length === 0) {
      return {
        messages: [],
        totalTokens: 0,
        truncated: false,
        removedCount: 0,
      }
    }

    // 保留前 N 条消息（通常是初始问题）
    const preserved: ChatMessage[] = messages.slice(0, Math.min(preserveFirstN, messages.length))
    const remaining: ChatMessage[] = messages.slice(preserveFirstN)

    let currentTokens = systemPrompt
      ? tokenCounterService.countTokens([], model, systemPrompt)
      : 0

    // 计算保留消息的 token
    const preservedTokens = tokenCounterService.countTokens(preserved, model)
    currentTokens += preservedTokens

    // 从剩余消息的末尾开始添加
    const result: ChatMessage[] = [...preserved]
    for (let i = remaining.length - 1; i >= 0; i--) {
      const message = remaining[i]
      const messageTokens = tokenCounterService.countTokens([message], model)

      if (currentTokens + messageTokens <= availableTokens) {
        result.splice(preserved.length, 0, message) // 插入到保留消息之后
        currentTokens += messageTokens
      } else {
        break
      }
    }

    const removedCount = messages.length - result.length

    return {
      messages: result,
      totalTokens: currentTokens,
      truncated: removedCount > 0,
      removedCount,
    }
  }

  /**
   * 获取模型的上下文限制
   */
  private getContextLimit(model: string): number {
    // 从常量中查找
    const limit = MODEL_CONTEXT_LIMITS[model]
    if (limit) return limit

    // 根据模型名称推断
    if (model.includes('gpt-4o')) return 128000
    if (model.includes('gpt-4-turbo')) return 128000
    if (model.includes('gpt-4')) return 8192
    if (model.includes('gpt-3.5')) return 16385
    if (model.includes('claude-3')) return 200000
    if (model.includes('gemini-1.5')) return 1000000
    if (model.includes('gemini-pro')) return 32000
    if (model.includes('deepseek')) return 32000
    if (model.includes('glm-4')) return 128000
    if (model.includes('moonshot')) {
      if (model.includes('128k')) return 128000
      if (model.includes('32k')) return 32000
      if (model.includes('8k')) return 8000
    }

    // 默认值
    return 4096
  }

  /**
   * 检查上下文是否即将溢出
   */
  checkContextStatus(
    messages: ChatMessage[],
    model: string,
    systemPrompt?: string,
    maxTokens?: number
  ): {
    currentTokens: number
    contextLimit: number
    availableTokens: number
    isNearLimit: boolean
    isOverLimit: boolean
    utilizationPercent: number
  } {
    const contextLimit = this.getContextLimit(model)
    const reservedTokens = maxTokens || 2048
    const availableTokens = contextLimit - reservedTokens

    const currentTokens = tokenCounterService.countTokens(messages, model, systemPrompt)
    const utilizationPercent = (currentTokens / availableTokens) * 100

    return {
      currentTokens,
      contextLimit,
      availableTokens,
      isNearLimit: tokenCounterService.isNearContextLimit(currentTokens, availableTokens, 0.8),
      isOverLimit: tokenCounterService.isOverContextLimit(currentTokens, availableTokens),
      utilizationPercent: Math.round(utilizationPercent),
    }
  }
}

/**
 * 单例实例
 */
export const contextManagerService = new ContextManagerService()
