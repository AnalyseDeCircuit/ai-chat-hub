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

  /**
   * 取消归档
   */
  unarchive: async (id: string): Promise<Session> => {
    const response = await apiClient.post<ApiResponse<Session>>(`/sessions/${id}/unarchive`)
    return response.data.data!
  },

  /**
   * 分享会话
   */
  share: async (id: string): Promise<{ shareCode: string; shareUrl: string }> => {
    const response = await apiClient.post<ApiResponse<{ shareCode: string; shareUrl: string }>>(
      `/sessions/${id}/share`
    )
    return response.data.data!
  },

  /**
   * 取消分享
   */
  unshare: async (id: string): Promise<void> => {
    await apiClient.post(`/sessions/${id}/unshare`)
  },

  /**
   * 通过分享码获取会话
   */
  getByShareCode: async (shareCode: string): Promise<Session> => {
    const response = await apiClient.get<ApiResponse<Session>>(`/sessions/shared/${shareCode}`)
    return response.data.data!
  },

  /**
   * 导出会话为 Markdown
   */
  exportMarkdown: async (sessionId: string): Promise<Blob> => {
    const response = await apiClient.get(`/sessions/${sessionId}/export/markdown`, {
      responseType: 'blob',
    })
    return response.data as Blob
  },

  /**
   * 导出会话为 JSON
   */
  exportJson: async (sessionId: string): Promise<Blob> => {
    const response = await apiClient.get(`/sessions/${sessionId}/export/json`, {
      responseType: 'blob',
    })
    return response.data as Blob
  },

  /**
   * 导出会话为纯文本
   */
  exportText: async (sessionId: string): Promise<Blob> => {
    const response = await apiClient.get(`/sessions/${sessionId}/export/text`, {
      responseType: 'blob',
    })
    return response.data as Blob
  },
}
