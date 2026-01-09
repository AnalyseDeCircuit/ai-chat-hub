/**
 * 模型探测服务 - 自动检测 API 提供商的可用模型
 */
import type { ModelProvider } from '@ai-chat-hub/shared'

interface DetectedModel {
  id: string
  name: string
  contextLength: number
  supportsVision?: boolean
  supportsFunctionCall?: boolean
}

// Claude 固定模型列表（Anthropic 没有模型列表 API）
const CLAUDE_MODELS: DetectedModel[] = [
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    contextLength: 200000,
    supportsVision: true,
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    contextLength: 200000,
    supportsVision: true,
  },
  {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    contextLength: 200000,
    supportsVision: true,
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    contextLength: 200000,
    supportsVision: true,
  },
]

// Gemini 固定模型列表
const GEMINI_MODELS: DetectedModel[] = [
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    contextLength: 1000000,
    supportsVision: true,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    contextLength: 1000000,
    supportsVision: true,
  },
]

// Moonshot (Kimi) 固定模型列表
const MOONSHOT_MODELS: DetectedModel[] = [
  // kimi-k2 系列
  {
    id: 'kimi-k2-0905-preview',
    name: 'Kimi K2 (0905)',
    contextLength: 256000,
    supportsVision: false,
    supportsFunctionCall: true,
  },
  {
    id: 'kimi-k2-0711-preview',
    name: 'Kimi K2 (0711)',
    contextLength: 128000,
    supportsVision: false,
    supportsFunctionCall: true,
  },
  {
    id: 'kimi-k2-turbo-preview',
    name: 'Kimi K2 Turbo',
    contextLength: 256000,
    supportsVision: false,
    supportsFunctionCall: true,
  },
  {
    id: 'kimi-k2-thinking',
    name: 'Kimi K2 Thinking',
    contextLength: 256000,
    supportsVision: false,
    supportsFunctionCall: true,
  },
  {
    id: 'kimi-k2-thinking-turbo',
    name: 'Kimi K2 Thinking Turbo',
    contextLength: 256000,
    supportsVision: false,
    supportsFunctionCall: true,
  },
  // moonshot-v1 系列
  {
    id: 'moonshot-v1-8k',
    name: 'Moonshot v1 8K',
    contextLength: 8000,
    supportsVision: false,
    supportsFunctionCall: true,
  },
  {
    id: 'moonshot-v1-32k',
    name: 'Moonshot v1 32K',
    contextLength: 32000,
    supportsVision: false,
    supportsFunctionCall: true,
  },
  {
    id: 'moonshot-v1-128k',
    name: 'Moonshot v1 128K',
    contextLength: 128000,
    supportsVision: false,
    supportsFunctionCall: true,
  },
  {
    id: 'moonshot-v1-8k-vision-preview',
    name: 'Moonshot v1 8K Vision',
    contextLength: 8000,
    supportsVision: true,
    supportsFunctionCall: true,
  },
  {
    id: 'moonshot-v1-32k-vision-preview',
    name: 'Moonshot v1 32K Vision',
    contextLength: 32000,
    supportsVision: true,
    supportsFunctionCall: true,
  },
  {
    id: 'moonshot-v1-128k-vision-preview',
    name: 'Moonshot v1 128K Vision',
    contextLength: 128000,
    supportsVision: true,
    supportsFunctionCall: true,
  },
  // kimi-latest
  {
    id: 'kimi-latest',
    name: 'Kimi Latest',
    contextLength: 128000,
    supportsVision: true,
    supportsFunctionCall: true,
  },
]

/**
 * 探测 OpenAI Compatible API 的模型
 */
async function detectOpenAICompatibleModels(
  apiKey: string,
  baseUrl: string = 'https://api.openai.com/v1'
): Promise<DetectedModel[]> {
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json() as { data?: Array<{ id: string; created?: number }> }
    
    // OpenAI API 返回格式: { data: [ { id, created, ... } ] }
    if (!data.data || !Array.isArray(data.data)) {
      return []
    }

    return data.data
      .filter((model) => {
        // 过滤掉非聊天模型（如 embedding, whisper 等）
        const id = model.id.toLowerCase()
        return (
          id.includes('gpt') ||
          id.includes('chat') ||
          id.includes('deepseek') ||
          id.includes('glm') ||
          id.includes('moonshot')
        )
      })
      .map((model) => {
        const modelId = model.id
        let contextLength = 4096 // 默认值

        // 根据模型名称推断上下文长度
        if (modelId.includes('gpt-4o')) {
          contextLength = 128000
        } else if (modelId.includes('gpt-4')) {
          contextLength = 128000
        } else if (modelId.includes('gpt-3.5-turbo-16k')) {
          contextLength = 16385
        } else if (modelId.includes('gpt-3.5')) {
          contextLength = 4096
        } else if (modelId.includes('deepseek')) {
          contextLength = 32000
        } else if (modelId.includes('glm-4')) {
          contextLength = 128000
        } else if (modelId.includes('moonshot-v1-128k') || modelId.includes('kimi-k2-0711')) {
          contextLength = 128000
        } else if (modelId.includes('moonshot-v1-32k')) {
          contextLength = 32000
        } else if (modelId.includes('moonshot-v1-8k') || modelId.includes('moonshot')) {
          contextLength = 8000
        } else if (modelId.includes('kimi-k2') || modelId.includes('kimi-latest')) {
          contextLength = 256000
        }

        return {
          id: modelId,
          name: model.id,
          contextLength,
          supportsVision: modelId.includes('vision') || modelId.includes('gpt-4o'),
          supportsFunctionCall: modelId.includes('gpt-4') || modelId.includes('gpt-3.5'),
        }
      })
  } catch (error) {
    console.error('Failed to detect OpenAI compatible models:', error)
    return []
  }
}

/**
 * 主探测函数
 */
export async function detectModels(
  provider: ModelProvider,
  apiKey: string,
  baseUrl?: string
): Promise<DetectedModel[]> {
  switch (provider) {
    case 'openai':
      return detectOpenAICompatibleModels(apiKey, 'https://api.openai.com/v1')

    case 'anthropic':
      // Claude 使用固定列表
      return CLAUDE_MODELS

    case 'google':
      // Gemini 使用固定列表
      return GEMINI_MODELS

    case 'deepseek':
      return detectOpenAICompatibleModels(apiKey, baseUrl || 'https://api.deepseek.com/v1')

    case 'zhipu':
      return detectOpenAICompatibleModels(apiKey, baseUrl || 'https://open.bigmodel.cn/api/paas/v4')

    case 'moonshot':
      // Moonshot 使用固定列表，因为 API 返回的模型信息不完整
      return MOONSHOT_MODELS

    case 'azure':
    case 'custom':
      if (!baseUrl) {
        return []
      }
      return detectOpenAICompatibleModels(apiKey, baseUrl)

    default:
      return []
  }
}

/**
 * 验证 API key 是否有效（通过尝试获取模型列表）
 */
export async function validateApiKey(
  provider: ModelProvider,
  apiKey: string,
  baseUrl?: string
): Promise<boolean> {
  try {
    const models = await detectModels(provider, apiKey, baseUrl)
    return models.length > 0
  } catch {
    return false
  }
}
