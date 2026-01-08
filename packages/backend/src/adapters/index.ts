import type { ModelAdapter } from './base.js'
import { OpenAIAdapter } from './openai.js'
import { ClaudeAdapter } from './claude.js'
import { GeminiAdapter } from './gemini.js'
import {
  OpenAICompatibleAdapter,
  createOpenAICompatibleAdapter,
  OPENAI_COMPATIBLE_PROVIDERS,
} from './openai-compatible.js'

export * from './base.js'
export { OpenAIAdapter } from './openai.js'
export { ClaudeAdapter } from './claude.js'
export { GeminiAdapter } from './gemini.js'
export { OpenAICompatibleAdapter, OPENAI_COMPATIBLE_PROVIDERS } from './openai-compatible.js'

// 适配器注册表
const adapters: Map<string, ModelAdapter> = new Map()

// 注册默认适配器
adapters.set('openai', new OpenAIAdapter())
adapters.set('anthropic', new ClaudeAdapter())
adapters.set('google', new GeminiAdapter())

// 注册 OpenAI 兼容适配器
for (const provider of Object.keys(OPENAI_COMPATIBLE_PROVIDERS)) {
  if (provider !== 'custom' && provider !== 'azure') {
    const config = OPENAI_COMPATIBLE_PROVIDERS[provider as keyof typeof OPENAI_COMPATIBLE_PROVIDERS]
    if (config.baseUrl) {
      adapters.set(provider, new OpenAICompatibleAdapter(provider, config.baseUrl, config.models))
    }
  }
}

/**
 * 获取适配器
 * @param provider Provider 名称
 * @param customBaseUrl 自定义 Base URL（用于 azure 和 custom）
 */
export function getAdapter(provider: string, customBaseUrl?: string): ModelAdapter | undefined {
  // 对于需要自定义端点的 provider，动态创建适配器
  if ((provider === 'azure' || provider === 'custom') && customBaseUrl) {
    return createOpenAICompatibleAdapter(provider, customBaseUrl)
  }

  return adapters.get(provider)
}

/**
 * 注册适配器
 */
export function registerAdapter(provider: string, adapter: ModelAdapter): void {
  adapters.set(provider, adapter)
}

/**
 * 获取所有已注册的提供商
 */
export function getProviders(): string[] {
  return Array.from(adapters.keys())
}

/**
 * 获取所有适配器
 */
export function getAllAdapters(): ModelAdapter[] {
  return Array.from(adapters.values())
}
