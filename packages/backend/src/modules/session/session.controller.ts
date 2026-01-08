import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { SessionService, SessionError } from './session.service.js'
import { sendSuccess, sendError } from '../../utils/response.js'
import { HttpStatus, ErrorCodes, PAGINATION } from '@ai-chat-hub/shared'
import { authMiddleware, requireUserId } from '../../middleware/auth.js'

const CreateSessionSchema = z.object({
  title: z.string().max(200).optional(),
})

const UpdateSessionSchema = z.object({
  title: z.string().max(200).optional(),
})

const sessionController: FastifyPluginAsync = async (fastify) => {
  const sessionService = new SessionService(fastify.prisma)

  // 所有路由需要认证
  fastify.addHook('preHandler', authMiddleware)

  /**
   * GET / - 获取会话列表（支持搜索）
   */
  fastify.get('/', async (request, reply) => {
    const userId = requireUserId(request)
    const query = request.query as { 
      page?: string
      limit?: string
      archived?: string
      search?: string
    }

    const page = parseInt(query.page || '1', 10)
    const limit = Math.min(parseInt(query.limit || '20', 10), PAGINATION.MAX_LIMIT)
    const archived = query.archived === 'true'
    const search = query.search?.trim()

    const result = await sessionService.list(userId, page, limit, archived, search)
    return sendSuccess(reply, result.sessions, HttpStatus.OK, result.meta)
  })

  /**
   * POST / - 创建会话
   */
  fastify.post('/', async (request, reply) => {
    try {
      const userId = requireUserId(request)
      const input = CreateSessionSchema.parse(request.body || {})

      const session = await sessionService.create(userId, input.title)
      return sendSuccess(reply, session, HttpStatus.CREATED)
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return sendError(reply, ErrorCodes.VALIDATION_ERROR, HttpStatus.UNPROCESSABLE_ENTITY)
      }
      throw error
    }
  })

  /**
   * GET /:id - 获取会话详情
   */
  fastify.get('/:id', async (request, reply) => {
    try {
      const userId = requireUserId(request)
      const { id } = request.params as { id: string }

      const session = await sessionService.getById(id, userId)
      return sendSuccess(reply, session)
    } catch (error) {
      if (error instanceof SessionError) {
        const statusCode =
          error.code === ErrorCodes.SESSION_NOT_FOUND
            ? HttpStatus.NOT_FOUND
            : HttpStatus.FORBIDDEN
        return sendError(reply, error.code, statusCode, error.message)
      }
      throw error
    }
  })

  /**
   * PUT /:id - 更新会话
   */
  fastify.put('/:id', async (request, reply) => {
    try {
      const userId = requireUserId(request)
      const { id } = request.params as { id: string }
      const input = UpdateSessionSchema.parse(request.body)

      const session = await sessionService.update(id, userId, input)
      return sendSuccess(reply, session)
    } catch (error) {
      if (error instanceof SessionError) {
        return sendError(reply, error.code, HttpStatus.FORBIDDEN, error.message)
      }
      throw error
    }
  })

  /**
   * DELETE /:id - 删除会话
   */
  fastify.delete('/:id', async (request, reply) => {
    try {
      const userId = requireUserId(request)
      const { id } = request.params as { id: string }

      await sessionService.delete(id, userId)
      return sendSuccess(reply, null, HttpStatus.NO_CONTENT)
    } catch (error) {
      if (error instanceof SessionError) {
        return sendError(reply, error.code, HttpStatus.FORBIDDEN, error.message)
      }
      throw error
    }
  })

  /**
   * POST /:id/archive - 归档会话
   */
  fastify.post('/:id/archive', async (request, reply) => {
    try {
      const userId = requireUserId(request)
      const { id } = request.params as { id: string }

      const session = await sessionService.archive(id, userId)
      return sendSuccess(reply, session)
    } catch (error) {
      if (error instanceof SessionError) {
        return sendError(reply, error.code, HttpStatus.FORBIDDEN, error.message)
      }
      throw error
    }
  })

  /**
   * POST /:id/unarchive - 取消归档
   */
  fastify.post('/:id/unarchive', async (request, reply) => {
    try {
      const userId = requireUserId(request)
      const { id } = request.params as { id: string }

      const session = await sessionService.unarchive(id, userId)
      return sendSuccess(reply, session)
    } catch (error) {
      if (error instanceof SessionError) {
        return sendError(reply, error.code, HttpStatus.FORBIDDEN, error.message)
      }
      throw error
    }
  })

  /**
   * POST /:id/share - 分享会话
   */
  fastify.post('/:id/share', async (request, reply) => {
    try {
      const userId = requireUserId(request)
      const { id } = request.params as { id: string }

      const session = await sessionService.share(id, userId)
      return sendSuccess(reply, {
        shareCode: session.shareCode,
        shareUrl: `/shared/${session.shareCode}`,
      })
    } catch (error) {
      if (error instanceof SessionError) {
        return sendError(reply, error.code, HttpStatus.FORBIDDEN, error.message)
      }
      throw error
    }
  })

  /**
   * POST /:id/unshare - 取消分享
   */
  fastify.post('/:id/unshare', async (request, reply) => {
    try {
      const userId = requireUserId(request)
      const { id } = request.params as { id: string }

      await sessionService.unshare(id, userId)
      return sendSuccess(reply, null, HttpStatus.NO_CONTENT)
    } catch (error) {
      if (error instanceof SessionError) {
        return sendError(reply, error.code, HttpStatus.FORBIDDEN, error.message)
      }
      throw error
    }
  })

  /**
   * GET /shared/:shareCode - 查看分享的会话（无需认证）
   */
  fastify.get(
    '/shared/:shareCode',
    {
      preHandler: [], // 跳过认证
    },
    async (request, reply) => {
      try {
        const { shareCode } = request.params as { shareCode: string }
        const session = await sessionService.getByShareCode(shareCode)
        return sendSuccess(reply, session)
      } catch (error) {
        if (error instanceof SessionError) {
          return sendError(reply, error.code, HttpStatus.NOT_FOUND, error.message)
        }
        throw error
      }
    }
  )
}

export default sessionController
