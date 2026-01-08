import { FastifyPluginAsync } from 'fastify'
import { AuthService, AuthError } from './auth.service.js'
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from './auth.schema.js'
import { sendSuccess, sendError } from '../../utils/response.js'
import { HttpStatus, ErrorCodes } from '@ai-chat-hub/shared'

const authController: FastifyPluginAsync = async (fastify) => {
  const authService = new AuthService(fastify.prisma, fastify.config)

  /**
   * POST /register - 用户注册
   */
  fastify.post('/register', async (request, reply) => {
    try {
      const input = RegisterSchema.parse(request.body)
      const result = await authService.register(input)

      // 记录审计日志
      await fastify.prisma.auditLog.create({
        data: {
          userId: result.user.id,
          action: 'register',
          resourceType: 'user',
          resourceId: result.user.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      })

      return sendSuccess(reply, result, HttpStatus.CREATED)
    } catch (error) {
      if (error instanceof AuthError) {
        return sendError(reply, error.code, HttpStatus.BAD_REQUEST, error.message)
      }
      if (error instanceof Error && error.name === 'ZodError') {
        return sendError(reply, ErrorCodes.VALIDATION_ERROR, HttpStatus.UNPROCESSABLE_ENTITY, '参数验证失败', error)
      }
      throw error
    }
  })

  /**
   * POST /login - 用户登录
   */
  fastify.post('/login', async (request, reply) => {
    try {
      const input = LoginSchema.parse(request.body)
      const result = await authService.login(input)

      // 记录审计日志
      await fastify.prisma.auditLog.create({
        data: {
          userId: result.user.id,
          action: 'login',
          resourceType: 'user',
          resourceId: result.user.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      })

      return sendSuccess(reply, result)
    } catch (error) {
      if (error instanceof AuthError) {
        const statusCode =
          error.code === ErrorCodes.AUTH_INVALID_CREDENTIALS
            ? HttpStatus.UNAUTHORIZED
            : HttpStatus.BAD_REQUEST
        return sendError(reply, error.code, statusCode, error.message)
      }
      if (error instanceof Error && error.name === 'ZodError') {
        return sendError(reply, ErrorCodes.VALIDATION_ERROR, HttpStatus.UNPROCESSABLE_ENTITY, '参数验证失败', error)
      }
      throw error
    }
  })

  /**
   * POST /logout - 退出登录
   */
  fastify.post('/logout', async (request, reply) => {
    try {
      // 从请求体获取刷新令牌
      const body = request.body as { refreshToken?: string } | undefined
      const refreshToken = body?.refreshToken

      // 尝试从 JWT 获取用户 ID（如果已认证）
      let userId: string | undefined

      try {
        await request.jwtVerify()
        userId = (request.user as { userId: string }).userId
      } catch {
        // 未认证时，仅依赖 refreshToken
      }

      if (userId) {
        await authService.logout(userId, refreshToken)

        // 记录审计日志
        await fastify.prisma.auditLog.create({
          data: {
            userId,
            action: 'logout',
            resourceType: 'user',
            resourceId: userId,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          },
        })
      }

      return sendSuccess(reply, { message: '已退出登录' })
    } catch (error) {
      throw error
    }
  })

  /**
   * POST /refresh - 刷新 Token
   */
  fastify.post('/refresh', async (request, reply) => {
    try {
      const { refreshToken } = RefreshTokenSchema.parse(request.body)
      const tokens = await authService.refreshToken(refreshToken)

      return sendSuccess(reply, tokens)
    } catch (error) {
      if (error instanceof AuthError) {
        return sendError(reply, error.code, HttpStatus.UNAUTHORIZED, error.message)
      }
      if (error instanceof Error && error.name === 'ZodError') {
        return sendError(reply, ErrorCodes.VALIDATION_ERROR, HttpStatus.UNPROCESSABLE_ENTITY, '参数验证失败', error)
      }
      throw error
    }
  })
}

export default authController
