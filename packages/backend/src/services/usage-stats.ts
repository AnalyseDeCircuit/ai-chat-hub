import { PrismaClient } from '@prisma/client'

/**
 * 使用统计服务
 * 记录 Token 使用量、请求次数和成本
 */
export class UsageStatsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 记录使用情况
   */
  async recordUsage(
    userId: string,
    modelId: string,
    tokensInput: number,
    tokensOutput: number,
    inputPrice: number,
    outputPrice: number
  ): Promise<void> {
    const statDate = this.getStatDate()

    // 计算成本（价格是每百万 token 的美元价格）
    const inputCost = (tokensInput / 1_000_000) * inputPrice
    const outputCost = (tokensOutput / 1_000_000) * outputPrice
    const totalCost = inputCost + outputCost

    // 使用 upsert 更新或创建统计记录
    await this.prisma.usageStats.upsert({
      where: {
        userId_modelId_statDate: {
          userId,
          modelId,
          statDate,
        },
      },
      create: {
        userId,
        modelId,
        statDate,
        tokensInput: BigInt(tokensInput),
        tokensOutput: BigInt(tokensOutput),
        requestCount: 1,
        costUsd: totalCost,
      },
      update: {
        tokensInput: {
          increment: BigInt(tokensInput),
        },
        tokensOutput: {
          increment: BigInt(tokensOutput),
        },
        requestCount: {
          increment: 1,
        },
        costUsd: {
          increment: totalCost,
        },
      },
    })
  }

  /**
   * 获取用户的统计概览
   */
  async getOverview(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalTokens: bigint
    totalRequests: number
    totalCost: number
    modelUsage: Array<{
      modelId: string
      modelName: string
      tokensInput: bigint
      tokensOutput: bigint
      requestCount: number
      costUsd: number
      percentage: number
    }>
  }> {
    const where: any = { userId }

    if (startDate || endDate) {
      where.statDate = {}
      if (startDate) where.statDate.gte = this.getStatDate(startDate)
      if (endDate) where.statDate.lte = this.getStatDate(endDate)
    }

    const stats = await this.prisma.usageStats.findMany({
      where,
      include: {
        model: {
          select: {
            name: true,
            displayName: true,
          },
        },
      },
    })

    // 聚合数据
    let totalTokens = BigInt(0)
    let totalRequests = 0
    let totalCost = 0

    const modelUsageMap = new Map<
      string,
      {
        modelId: string
        modelName: string
        tokensInput: bigint
        tokensOutput: bigint
        requestCount: number
        costUsd: number
      }
    >()

    for (const stat of stats) {
      totalTokens += stat.tokensInput + stat.tokensOutput
      totalRequests += stat.requestCount
      totalCost += Number(stat.costUsd)

      const existing = modelUsageMap.get(stat.modelId)
      if (existing) {
        existing.tokensInput += stat.tokensInput
        existing.tokensOutput += stat.tokensOutput
        existing.requestCount += stat.requestCount
        existing.costUsd += Number(stat.costUsd)
      } else {
        modelUsageMap.set(stat.modelId, {
          modelId: stat.modelId,
          modelName: stat.model.displayName,
          tokensInput: stat.tokensInput,
          tokensOutput: stat.tokensOutput,
          requestCount: stat.requestCount,
          costUsd: Number(stat.costUsd),
        })
      }
    }

    // 计算百分比
    const modelUsage = Array.from(modelUsageMap.values()).map((item) => ({
      ...item,
      percentage: totalCost > 0 ? (item.costUsd / totalCost) * 100 : 0,
    }))

    // 按成本排序
    modelUsage.sort((a, b) => b.costUsd - a.costUsd)

    return {
      totalTokens,
      totalRequests,
      totalCost,
      modelUsage,
    }
  }

  /**
   * 获取每日统计趋势
   */
  async getDailyTrend(
    userId: string,
    days: number = 30
  ): Promise<
    Array<{
      date: string
      tokensInput: bigint
      tokensOutput: bigint
      requestCount: number
      costUsd: number
    }>
  > {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const stats = await this.prisma.usageStats.findMany({
      where: {
        userId,
        statDate: {
          gte: this.getStatDate(startDate),
          lte: this.getStatDate(endDate),
        },
      },
      orderBy: {
        statDate: 'asc',
      },
    })

    // 按日期聚合
    const dailyMap = new Map<
      string,
      {
        tokensInput: bigint
        tokensOutput: bigint
        requestCount: number
        costUsd: number
      }
    >()

    for (const stat of stats) {
      const dateKey = stat.statDate.toISOString().split('T')[0]
      const existing = dailyMap.get(dateKey)

      if (existing) {
        existing.tokensInput += stat.tokensInput
        existing.tokensOutput += stat.tokensOutput
        existing.requestCount += stat.requestCount
        existing.costUsd += Number(stat.costUsd)
      } else {
        dailyMap.set(dateKey, {
          tokensInput: stat.tokensInput,
          tokensOutput: stat.tokensOutput,
          requestCount: stat.requestCount,
          costUsd: Number(stat.costUsd),
        })
      }
    }

    return Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }))
  }

  /**
   * 获取模型使用排名
   */
  async getModelRanking(
    userId: string,
    limit: number = 10
  ): Promise<
    Array<{
      modelId: string
      modelName: string
      displayName: string
      totalTokens: bigint
      requestCount: number
      costUsd: number
    }>
  > {
    const stats = await this.prisma.usageStats.groupBy({
      by: ['modelId', 'userId'],
      where: {
        userId,
      },
      _sum: {
        tokensInput: true,
        tokensOutput: true,
        requestCount: true,
        costUsd: true,
      },
      orderBy: {
        _sum: {
          costUsd: 'desc',
        },
      },
      take: limit,
    })

    // 获取模型信息
    const modelIds = stats.map((s) => s.modelId)
    const models = await this.prisma.model.findMany({
      where: {
        id: {
          in: modelIds,
        },
      },
    })

    const modelMap = new Map(models.map((m) => [m.id, m]))

    return stats.map((stat) => {
      const model = modelMap.get(stat.modelId)
      return {
        modelId: stat.modelId,
        modelName: model?.name || 'Unknown',
        displayName: model?.displayName || 'Unknown Model',
        totalTokens: (stat._sum.tokensInput || BigInt(0)) + (stat._sum.tokensOutput || BigInt(0)),
        requestCount: stat._sum.requestCount || 0,
        costUsd: Number(stat._sum.costUsd) || 0,
      }
    })
  }

  /**
   * 获取统计日期（UTC 日期，不包含时间）
   */
  private getStatDate(date: Date = new Date()): Date {
    const d = new Date(date)
    d.setUTCHours(0, 0, 0, 0)
    return d
  }
}

/**
 * 创建统计服务实例
 */
export function createUsageStatsService(prisma: PrismaClient): UsageStatsService {
  return new UsageStatsService(prisma)
}
