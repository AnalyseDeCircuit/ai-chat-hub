import apiClient from './client'
import type { ApiResponse } from '@ai-chat-hub/shared'

export interface UsageOverview {
  totalTokens: string
  totalRequests: number
  totalCost: number
  modelUsage: Array<{
    modelId: string
    modelName: string
    tokensInput: string
    tokensOutput: string
    requestCount: number
    costUsd: number
    percentage: number
  }>
}

export interface DailyTrend {
  date: string
  tokensInput: string
  tokensOutput: string
  requestCount: number
  costUsd: number
}

export interface ModelRanking {
  modelId: string
  modelName: string
  displayName: string
  totalTokens: string
  requestCount: number
  costUsd: number
}

export const statsApi = {
  /**
   * 获取使用统计概览
   */
  getOverview: async (startDate?: string, endDate?: string): Promise<UsageOverview> => {
    const params: any = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate

    const response = await apiClient.get<ApiResponse<UsageOverview>>('/stats/overview', { params })
    return response.data.data!
  },

  /**
   * 获取每日趋势
   */
  getDailyTrend: async (days: number = 30): Promise<DailyTrend[]> => {
    const response = await apiClient.get<ApiResponse<DailyTrend[]>>('/stats/daily', {
      params: { days },
    })
    return response.data.data!
  },

  /**
   * 获取模型使用排名
   */
  getModelRanking: async (limit: number = 10): Promise<ModelRanking[]> => {
    const response = await apiClient.get<ApiResponse<ModelRanking[]>>('/stats/models', {
      params: { limit },
    })
    return response.data.data!
  },
}
