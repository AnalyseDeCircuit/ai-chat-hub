import { FastifyPluginAsync } from 'fastify'
import { sendSuccess } from '../../utils/response.js'
import { authMiddleware, requireUserId } from '../../middleware/auth.js'
import { createUsageStatsService } from '../../services/index.js'

const statsController: FastifyPluginAsync = async (fastify) => {
  const usageStatsService = createUsageStatsService(fastify.prisma)

  // 所有路由需要认证
  fastify.addHook('preHandler', authMiddleware)

  /**
   * GET /overview - 获取使用统计概览
   */
  fastify.get('/overview', async (request, reply) => {
    const userId = requireUserId(request)
    const query = request.query as { startDate?: string; endDate?: string }

    const startDate = query.startDate ? new Date(query.startDate) : undefined
    const endDate = query.endDate ? new Date(query.endDate) : undefined

    const overview = await usageStatsService.getOverview(userId, startDate, endDate)

    // 转换 BigInt 为字符串（JSON 不支持 BigInt）
    return sendSuccess(reply, {
      ...overview,
      totalTokens: overview.totalTokens.toString(),
      modelUsage: overview.modelUsage.map((item) => ({
        ...item,
        tokensInput: item.tokensInput.toString(),
        tokensOutput: item.tokensOutput.toString(),
      })),
    })
  })

  /**
   * GET /daily - 获取每日趋势
   */
  fastify.get('/daily', async (request, reply) => {
    const userId = requireUserId(request)
    const query = request.query as { days?: string }

    const days = parseInt(query.days || '30', 10)
    const trend = await usageStatsService.getDailyTrend(userId, days)

    return sendSuccess(
      reply,
      trend.map((item) => ({
        ...item,
        tokensInput: item.tokensInput.toString(),
        tokensOutput: item.tokensOutput.toString(),
      }))
    )
  })

  /**
   * GET /models - 获取模型使用排名
   */
  fastify.get('/models', async (request, reply) => {
    const userId = requireUserId(request)
    const query = request.query as { limit?: string }

    const limit = parseInt(query.limit || '10', 10)
    const ranking = await usageStatsService.getModelRanking(userId, limit)

    return sendSuccess(
      reply,
      ranking.map((item) => ({
        ...item,
        totalTokens: item.totalTokens.toString(),
      }))
    )
  })
}

export default statsController
