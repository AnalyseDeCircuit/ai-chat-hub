// ==================== 用户相关类型 ====================

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED'

export interface User {
  id: string
  email: string
  nickname: string | null
  avatarUrl: string | null
  status: UserStatus
  settings: UserSettings
  createdAt: Date
  updatedAt: Date
  lastLoginAt: Date | null
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  language: string
  defaultModelId?: string
}

export interface CreateUserInput {
  email: string
  password: string
  nickname?: string
}

export interface UpdateUserInput {
  nickname?: string
  avatarUrl?: string
  settings?: Partial<UserSettings>
}

// ==================== 认证相关类型 ====================

export interface LoginInput {
  email: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface JwtPayload {
  userId: string
  email: string
  iat: number
  exp: number
}

// ==================== 会话相关类型 ====================

export interface Session {
  id: string
  userId: string
  title: string | null
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
  isShared: boolean
  shareCode: string | null
  metadata: SessionMetadata
}

export interface SessionMetadata {
  messageCount?: number
  lastModelId?: string
  totalTokens?: number
}

export interface CreateSessionInput {
  title?: string
  modelId?: string
}

export interface UpdateSessionInput {
  title?: string
}

// ==================== 消息相关类型 ====================

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  sessionId: string
  parentId: string | null
  role: MessageRole
  content: string
  modelId: string | null
  tokensInput: number
  tokensOutput: number
  version: number
  createdAt: Date
  metadata: MessageMetadata
}

export interface MessageMetadata {
  finishReason?: string
  latencyMs?: number
  error?: string
}

export interface CreateMessageInput {
  sessionId: string
  content: string
  modelId: string
}

// ==================== 模型相关类型 ====================

export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'zhipu' | 'moonshot' | 'azure' | 'custom'

export type ModelCapability = 'chat' | 'vision' | 'function_call' | 'code'

export interface Model {
  id: string
  provider: ModelProvider
  name: string
  displayName: string
  contextLength: number
  inputPrice: number
  outputPrice: number
  capabilities: ModelCapability[]
  isActive: boolean
  mcpConfig: McpConfig
  createdAt: Date
}

export interface McpConfig {
  endpoint?: string
  version?: string
  options?: Record<string, unknown>
}

export interface ModelConfig {
  id: string
  userId: string
  modelId: string
  temperature: number
  maxTokens: number
  topP: number
  systemPrompt: string | null
  createdAt: Date
  updatedAt: Date
}

// ==================== API 密钥相关类型 ====================

export interface ApiKey {
  id: string
  userId: string
  provider: ModelProvider
  keyHint: string
  baseUrl?: string | null
  isValid: boolean
  lastValidated: Date | null
  lastUsedAt: Date | null
  createdAt: Date
}

export interface CreateApiKeyInput {
  provider: ModelProvider
  apiKey: string
  baseUrl?: string // 自定义端点 URL（可选，用于 Azure、自定义等）
}

// ==================== 统计相关类型 ====================

export interface UsageStats {
  id: string
  userId: string
  modelId: string
  statDate: Date
  tokensInput: number
  tokensOutput: number
  requestCount: number
  costUsd: number
}

export interface UsageOverview {
  totalTokens: number
  totalRequests: number
  totalCost: number
  modelUsage: ModelUsage[]
}

export interface ModelUsage {
  modelId: string
  modelName: string
  tokensInput: number
  tokensOutput: number
  requestCount: number
  costUsd: number
  percentage: number
}

// ==================== 反馈相关类型 ====================

export type FeedbackRating = -1 | 1

export interface Feedback {
  id: string
  messageId: string
  userId: string
  rating: FeedbackRating
  comment: string | null
  createdAt: Date
}

// ==================== API 响应类型 ====================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
  meta?: PaginationMeta
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export interface PaginationQuery {
  page?: number
  limit?: number
}

// ==================== 聊天相关类型 ====================

export interface ChatCompletionInput {
  sessionId: string
  content: string
  modelId: string
}

export interface ChatMessage {
  role: MessageRole
  content: string
}

export interface StreamChunk {
  type: 'content' | 'done' | 'error'
  content?: string
  messageId?: string
  error?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}
