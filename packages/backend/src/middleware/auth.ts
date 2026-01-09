import { FastifyRequest, FastifyReply } from 'fastify'
import { sendUnauthorized } from '../utils/response.js'

/**
 * 认证中间件 - 用于保护需要登录的路由
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify()
  } catch (err) {
    return sendUnauthorized(reply, '请先登录')
  }
}

/**
 * 可选认证中间件 - 如果有 Token 则验证，没有则继续
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  try {
    await request.jwtVerify()
  } catch {
    // 忽略错误，允许未认证访问
  }
}

/**
 * 获取当前用户 ID
 */
export function getCurrentUserId(request: FastifyRequest): string | null {
  const user = request.user as { userId: string } | undefined
  return user?.userId || null
}

/**
 * 获取当前用户 ID（必须已认证）
 */
export function requireUserId(request: FastifyRequest): string {
  const userId = getCurrentUserId(request)
  if (!userId) {
    throw new Error('用户未认证')
  }
  return userId
}
