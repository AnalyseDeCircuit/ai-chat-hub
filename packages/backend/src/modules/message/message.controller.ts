import { FastifyPluginAsync } from 'fastify'
import { sendSuccess, sendError } from '../../utils/response.js'
import { HttpStatus, ErrorCodes, PAGINATION } from '@ai-chat-hub/shared'
import { authMiddleware, requireUserId } from '../../middleware/auth.js'

const messageController: FastifyPluginAsync = async (fastify) => {
  // 所有路由需要认证
  fastify.addHook('preHandler', authMiddleware)

  /**
   * GET /session/:sessionId - 获取会话消息
   */
  fastify.get('/session/:sessionId', async (request, reply) => {
    const userId = requireUserId(request)
    const { sessionId } = request.params as { sessionId: string }
    const query = request.query as { before?: string; limit?: string }

    // 验证会话所有权
    const session = await fastify.prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true, isShared: true },
    })

    if (!session) {
      return sendError(reply, ErrorCodes.SESSION_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    if (session.userId !== userId && !session.isShared) {
      return sendError(reply, ErrorCodes.SESSION_ACCESS_DENIED, HttpStatus.FORBIDDEN)
    }

    const limit = Math.min(parseInt(query.limit || '50', 10), PAGINATION.MAX_LIMIT)

    const where: any = { sessionId }
    if (query.before) {
      const beforeMessage = await fastify.prisma.message.findUnique({
        where: { id: query.before },
        select: { createdAt: true },
      })
      if (beforeMessage) {
        where.createdAt = { lt: beforeMessage.createdAt }
      }
    }

    const messages = await fastify.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit,
    })

    return sendSuccess(reply, messages)
  })

  /**
   * GET /:id - 获取单条消息
   */
  fastify.get('/:id', async (request, reply) => {
    const userId = requireUserId(request)
    const { id } = request.params as { id: string }

    const message = await fastify.prisma.message.findUnique({
      where: { id },
      include: {
        session: {
          select: { userId: true, isShared: true },
        },
      },
    })

    if (!message) {
      return sendError(reply, ErrorCodes.MESSAGE_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    if (message.session.userId !== userId && !message.session.isShared) {
      return sendError(reply, ErrorCodes.SESSION_ACCESS_DENIED, HttpStatus.FORBIDDEN)
    }

    return sendSuccess(reply, message)
  })

  /**
   * DELETE /:id - 删除消息
   */
  fastify.delete('/:id', async (request, reply) => {
    const userId = requireUserId(request)
    const { id } = request.params as { id: string }

    const message = await fastify.prisma.message.findUnique({
      where: { id },
      include: {
        session: {
          select: { userId: true },
        },
      },
    })

    if (!message) {
      return sendError(reply, ErrorCodes.MESSAGE_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    if (message.session.userId !== userId) {
      return sendError(reply, ErrorCodes.SESSION_ACCESS_DENIED, HttpStatus.FORBIDDEN)
    }

    await fastify.prisma.message.delete({
      where: { id },
    })

    return sendSuccess(reply, null, HttpStatus.NO_CONTENT)
  })

  /**
   * POST /:id/regenerate - 重新生成消息
   */
  fastify.post('/:id/regenerate', async (request, reply) => {
    const userId = requireUserId(request)
    const { id } = request.params as { id: string }

    const message = await fastify.prisma.message.findUnique({
      where: { id },
      include: {
        session: {
          select: { userId: true },
        },
      },
    })

    if (!message) {
      return sendError(reply, ErrorCodes.MESSAGE_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    if (message.session.userId !== userId) {
      return sendError(reply, ErrorCodes.SESSION_ACCESS_DENIED, HttpStatus.FORBIDDEN)
    }

    if (message.role !== 'assistant') {
      return sendError(
        reply,
        ErrorCodes.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
        '只能重新生成助手消息'
      )
    }

    // 创建新版本（作为子消息）
    const newVersion = await fastify.prisma.message.create({
      data: {
        sessionId: message.sessionId,
        parentId: message.parentId || id, // 指向原始父消息或当前消息
        role: message.role,
        content: '', // 将通过流式更新
        modelId: message.modelId,
        version: message.version + 1,
        tokensInput: 0,
        tokensOutput: 0,
      },
    })

    return sendSuccess(reply, {
      messageId: newVersion.id,
      message: '请通过 chat API 重新生成内容',
    })
  })

  /**
   * GET /:id/versions - 获取消息的所有版本
   */
  fastify.get('/:id/versions', async (request, reply) => {
    const userId = requireUserId(request)
    const { id } = request.params as { id: string }

    const message = await fastify.prisma.message.findUnique({
      where: { id },
      include: {
        session: {
          select: { userId: true, isShared: true },
        },
      },
    })

    if (!message) {
      return sendError(reply, ErrorCodes.MESSAGE_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    if (message.session.userId !== userId && !message.session.isShared) {
      return sendError(reply, ErrorCodes.SESSION_ACCESS_DENIED, HttpStatus.FORBIDDEN)
    }

    // 获取所有版本（包括自己和兄弟节点）
    const parentId = message.parentId || id
    const versions = await fastify.prisma.message.findMany({
      where: {
        OR: [{ id: parentId }, { parentId }],
      },
      orderBy: { version: 'asc' },
    })

    return sendSuccess(reply, versions)
  })

  /**
   * POST /:id/feedback - 提交反馈
   */
  fastify.post('/:id/feedback', async (request, reply) => {
    const userId = requireUserId(request)
    const { id } = request.params as { id: string }
    const body = request.body as { rating: -1 | 1; comment?: string }

    if (![-1, 1].includes(body.rating)) {
      return sendError(reply, ErrorCodes.VALIDATION_ERROR, HttpStatus.UNPROCESSABLE_ENTITY)
    }

    const message = await fastify.prisma.message.findUnique({
      where: { id },
      include: {
        session: {
          select: { userId: true },
        },
      },
    })

    if (!message) {
      return sendError(reply, ErrorCodes.MESSAGE_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    if (message.session.userId !== userId) {
      return sendError(reply, ErrorCodes.SESSION_ACCESS_DENIED, HttpStatus.FORBIDDEN)
    }

    // 创建或更新反馈
    const feedback = await fastify.prisma.feedback.upsert({
      where: {
        messageId_userId: {
          messageId: id,
          userId,
        },
      },
      create: {
        messageId: id,
        userId,
        rating: body.rating,
        comment: body.comment || null,
      },
      update: {
        rating: body.rating,
        comment: body.comment || null,
      },
    })

    return sendSuccess(reply, feedback)
  })
}

export default messageController
