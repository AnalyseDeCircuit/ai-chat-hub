import { FastifyPluginAsync } from 'fastify'
import { UserService, UserError } from './user.service.js'
import {
  UpdateUserSchema,
  UpdateSettingsSchema,
  ChangePasswordSchema,
  DeleteAccountSchema,
} from './user.schema.js'
import { sendSuccess, sendError } from '../../utils/response.js'
import { HttpStatus, ErrorCodes } from '@ai-chat-hub/shared'
import { authMiddleware, requireUserId } from '../../middleware/auth.js'

const userController: FastifyPluginAsync = async (fastify) => {
  const userService = new UserService(fastify.prisma)

  // 所有用户路由都需要认证
  fastify.addHook('preHandler', authMiddleware)

  /**
   * GET /me - 获取当前用户信息
   */
  fastify.get('/me', async (request, reply) => {
    try {
      const userId = requireUserId(request)
      const user = await userService.getById(userId)
      return sendSuccess(reply, user)
    } catch (error) {
      if (error instanceof UserError) {
        return sendError(reply, error.code, HttpStatus.NOT_FOUND, error.message)
      }
      throw error
    }
  })

  /**
   * PUT /me - 更新当前用户信息
   */
  fastify.put('/me', async (request, reply) => {
    try {
      const userId = requireUserId(request)
      const input = UpdateUserSchema.parse(request.body)
      const user = await userService.update(userId, input)

      // 记录审计日志
      await fastify.prisma.auditLog.create({
        data: {
          userId,
          action: 'update_profile',
          resourceType: 'user',
          resourceId: userId,
          details: { fields: Object.keys(input) },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      })

      return sendSuccess(reply, user)
    } catch (error) {
      if (error instanceof UserError) {
        return sendError(reply, error.code, HttpStatus.BAD_REQUEST, error.message)
      }
      if (error instanceof Error && error.name === 'ZodError') {
        return sendError(reply, ErrorCodes.VALIDATION_ERROR, HttpStatus.UNPROCESSABLE_ENTITY, '参数验证失败', error)
      }
      throw error
    }
  })

  /**
   * GET /me/settings - 获取用户设置
   */
  fastify.get('/me/settings', async (request, reply) => {
    try {
      const userId = requireUserId(request)
      const settings = await userService.getSettings(userId)
      return sendSuccess(reply, settings)
    } catch (error) {
      if (error instanceof UserError) {
        return sendError(reply, error.code, HttpStatus.NOT_FOUND, error.message)
      }
      throw error
    }
  })

  /**
   * PUT /me/settings - 更新用户设置
   */
  fastify.put('/me/settings', async (request, reply) => {
    try {
      const userId = requireUserId(request)
      const input = UpdateSettingsSchema.parse(request.body)
      const settings = await userService.updateSettings(userId, input)

      // 记录审计日志
      await fastify.prisma.auditLog.create({
        data: {
          userId,
          action: 'update_settings',
          resourceType: 'user',
          resourceId: userId,
          details: { fields: Object.keys(input) },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      })

      return sendSuccess(reply, settings)
    } catch (error) {
      if (error instanceof UserError) {
        return sendError(reply, error.code, HttpStatus.BAD_REQUEST, error.message)
      }
      if (error instanceof Error && error.name === 'ZodError') {
        return sendError(reply, ErrorCodes.VALIDATION_ERROR, HttpStatus.UNPROCESSABLE_ENTITY, '参数验证失败', error)
      }
      throw error
    }
  })

  /**
   * PUT /me/password - 修改密码
   */
  fastify.put('/me/password', async (request, reply) => {
    try {
      const userId = requireUserId(request)
      const input = ChangePasswordSchema.parse(request.body)
      await userService.changePassword(userId, input)

      // 记录审计日志
      await fastify.prisma.auditLog.create({
        data: {
          userId,
          action: 'change_password',
          resourceType: 'user',
          resourceId: userId,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      })

      return sendSuccess(reply, { message: '密码修改成功，请重新登录' })
    } catch (error) {
      if (error instanceof UserError) {
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
   * DELETE /me - 注销账号
   */
  fastify.delete('/me', async (request, reply) => {
    try {
      const userId = requireUserId(request)
      const { password } = DeleteAccountSchema.parse(request.body)
      await userService.deleteAccount(userId, password)

      // 记录审计日志
      await fastify.prisma.auditLog.create({
        data: {
          userId,
          action: 'delete_account',
          resourceType: 'user',
          resourceId: userId,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      })

      return sendSuccess(reply, { message: '账号已注销' }, HttpStatus.OK)
    } catch (error) {
      if (error instanceof UserError) {
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
}

export default userController
