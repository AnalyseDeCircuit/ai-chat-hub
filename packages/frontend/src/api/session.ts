import apiClient from './client'
import type { ApiResponse, Session, CreateSessionInput, UpdateSessionInput, PaginationMeta } from '@ai-chat-hub/shared'

interface SessionListResponse {
  sessions: Session[]
  meta: PaginationMeta
}

export const sessionApi = {
  /**
   * 获取会话列表
   */
  list: async (page = 1, limit = 20, archived = false): Promise<SessionListResponse> => {
    const response = await apiClient.get<ApiResponse<Session[]>>('/sessions', {
      params: { page, limit, archived },
    })
    return {
      sessions: response.data.data!,
      meta: response.data.meta!,
    }
  },

  /**
   * 创建会话
   */
  create: async (data?: CreateSessionInput): Promise<Session> => {
    const response = await apiClient.post<ApiResponse<Session>>('/sessions', data || {})
    return response.data.data!
  },

  /**
   * 获取会话详情
   */
  get: async (id: string): Promise<Session> => {
    const response = await apiClient.get<ApiResponse<Session>>(`/sessions/${id}`)
    return response.data.data!
  },

  /**
   * 更新会话
   */
  update: async (id: string, data: UpdateSessionInput): Promise<Session> => {
    const response = await apiClient.put<ApiResponse<Session>>(`/sessions/${id}`, data)
    return response.data.data!
  },

  /**
   * 删除会话
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/sessions/${id}`)
  },

  /**
   * 归档会话
   */
  archive: async (id: string): Promise<Session> => {
    const response = await apiClient.post<ApiResponse<Session>>(`/sessions/${id}/archive`)
    return response.data.data!
  },
}
