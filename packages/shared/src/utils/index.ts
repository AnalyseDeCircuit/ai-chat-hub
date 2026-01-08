/**
 * 生成 API 密钥的显示提示（例如：sk-...xxxx）
 */
export function generateKeyHint(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '****'
  }
  const prefix = apiKey.slice(0, 3)
  const suffix = apiKey.slice(-4)
  return `${prefix}...${suffix}`
}

/**
 * 格式化日期为 ISO 字符串
 */
export function formatDate(date: Date): string {
  return date.toISOString()
}

/**
 * 解析日期字符串
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString)
}

/**
 * 安全地解析 JSON
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

/**
 * 延迟执行
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 生成随机字符串
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 截断字符串
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) {
    return str
  }
  return str.slice(0, maxLength - suffix.length) + suffix
}

/**
 * 计算费用（美元）
 */
export function calculateCost(
  tokensInput: number,
  tokensOutput: number,
  inputPrice: number,
  outputPrice: number
): number {
  const inputCost = (tokensInput / 1000) * inputPrice
  const outputCost = (tokensOutput / 1000) * outputPrice
  return Math.round((inputCost + outputCost) * 10000) / 10000
}

/**
 * 格式化 Token 数量
 */
export function formatTokenCount(count: number): string {
  if (count < 1000) {
    return count.toString()
  }
  if (count < 1000000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return `${(count / 1000000).toFixed(2)}M`
}

/**
 * 格式化费用
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`
  }
  return `$${cost.toFixed(2)}`
}

/**
 * 判断是否为有效的邮箱格式
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 判断是否为有效的 UUID
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * 移除对象中的 undefined 值
 */
export function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>
}

/**
 * 深拷贝对象
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}
