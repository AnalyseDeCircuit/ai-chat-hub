import apiClient from './client'
import type { ApiResponse, User, UserSettings, UpdateUserInput } from '@ai-chat-hub/shared'

export const userApi = {
  /**
   * 获取当前用户信息
   */
  getMe: async (): Promise<User> => {
    const response = await apiClient.get<ApiResponse<User>>('/users/me')
    return response.data.data!
  },

  /**
   * 更新用户信息
   */
  updateMe: async (data: UpdateUserInput): Promise<User> => {
    const response = await apiClient.put<ApiResponse<User>>('/users/me', data)
    return response.data.data!
  },

  /**
   * 获取用户设置
   */
  getSettings: async (): Promise<UserSettings> => {
    const response = await apiClient.get<ApiResponse<UserSettings>>('/users/me/settings')
    return response.data.data!
  },

  /**
   * 更新用户设置
   */
  updateSettings: async (data: Partial<UserSettings>): Promise<UserSettings> => {
    const response = await apiClient.put<ApiResponse<UserSettings>>('/users/me/settings', data)
    return response.data.data!
  },

  /**
   * 修改密码
   */
  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    await apiClient.put('/users/me/password', { oldPassword, newPassword })
  },
}
