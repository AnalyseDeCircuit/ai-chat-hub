import { FastifyPluginAsync } from 'fastify'
import { sendSuccess, sendError } from '../../utils/response.js'
import { HttpStatus, ErrorCodes } from '@ai-chat-hub/shared'
import { authMiddleware, requireUserId } from '../../middleware/auth.js'

const modelController: FastifyPluginAsync = async (fastify) => {
  /**
   * GET / - 获取可用模型列表
   */
  fastify.get('/', async (request, reply) => {
    const query = request.query as { provider?: string }

    const where: any = { isActive: true }
    if (query.provider) {
      where.provider = query.provider
    }

    const models = await fastify.prisma.model.findMany({
      where,
      orderBy: [{ provider: 'asc' }, { displayName: 'asc' }],
    })

    return sendSuccess(reply, models)
  })

  /**
   * GET /providers - 获取支持的提供商
   */
  fastify.get('/providers', async (_request, reply) => {
    const providers = await fastify.prisma.model.groupBy({
      by: ['provider'],
      where: { isActive: true },
      _count: { provider: true },
    })

    return sendSuccess(
      reply,
      providers.map((p) => ({
        name: p.provider,
        count: p._count.provider,
      }))
    )
  })

  /**
   * GET /:id - 获取模型详情
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const model = await fastify.prisma.model.findUnique({
      where: { id },
    })

    if (!model) {
      return sendError(reply, ErrorCodes.MODEL_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    return sendSuccess(reply, model)
  })

  // 以下路由需要认证
  fastify.register(async (authenticatedRoutes) => {
    authenticatedRoutes.addHook('preHandler', authMiddleware)

    /**
     * GET /:id/config - 获取用户对模型的配置
     */
    authenticatedRoutes.get('/:id/config', async (request, reply) => {
      const userId = requireUserId(request)
      const { id } = request.params as { id: string }

      let config = await fastify.prisma.modelConfig.findUnique({
        where: {
          userId_modelId: { userId, modelId: id },
        },
      })

      if (!config) {
        // 返回默认配置
        config = {
          id: '',
          userId,
          modelId: id,
          temperature: 0.7 as any,
          maxTokens: 2048,
          topP: 1.0 as any,
          systemPrompt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      }

      return sendSuccess(reply, config)
    })

    /**
     * PUT /:id/config - 更新模型配置
     */
    authenticatedRoutes.put('/:id/config', async (request, reply) => {
      const userId = requireUserId(request)
      const { id } = request.params as { id: string }
      const body = request.body as {
        temperature?: number
        maxTokens?: number
        topP?: number
        systemPrompt?: string
      }

      const config = await fastify.prisma.modelConfig.upsert({
        where: {
          userId_modelId: { userId, modelId: id },
        },
        create: {
          userId,
          modelId: id,
          temperature: body.temperature ?? 0.7,
          maxTokens: body.maxTokens ?? 2048,
          topP: body.topP ?? 1.0,
          systemPrompt: body.systemPrompt,
        },
        update: {
          ...(body.temperature !== undefined && { temperature: body.temperature }),
          ...(body.maxTokens !== undefined && { maxTokens: body.maxTokens }),
          ...(body.topP !== undefined && { topP: body.topP }),
          ...(body.systemPrompt !== undefined && { systemPrompt: body.systemPrompt }),
        },
      })

      return sendSuccess(reply, config)
    })
  })
}

export default modelController
