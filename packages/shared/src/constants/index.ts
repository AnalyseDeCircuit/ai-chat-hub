// ==================== 错误码 ====================

export const ErrorCodes = {
  // 认证相关
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_REFRESH_TOKEN_INVALID',

  // 用户相关
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_EMAIL_EXISTS: 'USER_EMAIL_EXISTS',
  USER_SUSPENDED: 'USER_SUSPENDED',

  // 会话相关
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_ACCESS_DENIED: 'SESSION_ACCESS_DENIED',

  // 消息相关
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  MESSAGE_TOO_LONG: 'MESSAGE_TOO_LONG',

  // 模型相关
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  MODEL_NOT_AVAILABLE: 'MODEL_NOT_AVAILABLE',
  MODEL_API_ERROR: 'MODEL_API_ERROR',
  MODEL_CONTEXT_OVERFLOW: 'MODEL_CONTEXT_OVERFLOW',

  // 密钥相关
  KEY_NOT_FOUND: 'KEY_NOT_FOUND',
  KEY_INVALID: 'KEY_INVALID',
  KEY_QUOTA_EXCEEDED: 'KEY_QUOTA_EXCEEDED',
  KEY_PROVIDER_REQUIRED: 'KEY_PROVIDER_REQUIRED',

  // 通用
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

// ==================== 错误消息 ====================

export const ErrorMessages: Record<ErrorCode, string> = {
  // 认证相关
  AUTH_INVALID_CREDENTIALS: '邮箱或密码错误',
  AUTH_TOKEN_EXPIRED: '登录已过期，请重新登录',
  AUTH_TOKEN_INVALID: '无效的认证令牌',
  AUTH_UNAUTHORIZED: '未授权访问',
  AUTH_REFRESH_TOKEN_INVALID: '刷新令牌无效',

  // 用户相关
  USER_NOT_FOUND: '用户不存在',
  USER_EMAIL_EXISTS: '该邮箱已被注册',
  USER_SUSPENDED: '账号已被暂停使用',

  // 会话相关
  SESSION_NOT_FOUND: '会话不存在',
  SESSION_ACCESS_DENIED: '无权访问此会话',

  // 消息相关
  MESSAGE_NOT_FOUND: '消息不存在',
  MESSAGE_TOO_LONG: '消息内容超出长度限制',

  // 模型相关
  MODEL_NOT_FOUND: '模型不存在',
  MODEL_NOT_AVAILABLE: '模型暂不可用',
  MODEL_API_ERROR: '模型 API 调用失败',
  MODEL_CONTEXT_OVERFLOW: '上下文超出模型限制',

  // 密钥相关
  KEY_NOT_FOUND: 'API 密钥不存在',
  KEY_INVALID: 'API 密钥无效',
  KEY_QUOTA_EXCEEDED: 'API 配额已用尽',
  KEY_PROVIDER_REQUIRED: '该模型需要配置 API 密钥',

  // 通用
  VALIDATION_ERROR: '请求参数验证失败',
  RATE_LIMIT_EXCEEDED: '请求过于频繁，请稍后再试',
  INTERNAL_ERROR: '服务器内部错误',
  NOT_FOUND: '资源不存在',
  BAD_REQUEST: '请求参数错误',
}

// ==================== 模型配置 ====================

export const MODEL_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'zhipu',
  'moonshot',
  'azure',
  'custom',
] as const

export const DEFAULT_MODEL_CONFIG = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1.0,
} as const

export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // OpenAI
  'gpt-4': 8192,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-3.5-turbo': 16385,

  // Anthropic
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-3-5-sonnet': 200000,

  // Google
  'gemini-pro': 32000,
  'gemini-1.5-pro': 1000000,
  'gemini-1.5-flash': 1000000,
}

// ==================== 分页默认值 ====================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const

// ==================== 消息限制 ====================

export const MESSAGE_LIMITS = {
  MAX_CONTENT_LENGTH: 100000,
  MAX_SYSTEM_PROMPT_LENGTH: 10000,
} as const

// ==================== 认证配置 ====================

export const AUTH_CONFIG = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  EMAIL_MAX_LENGTH: 255,
  NICKNAME_MAX_LENGTH: 100,
} as const

// ==================== HTTP 状态码 ====================

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const
