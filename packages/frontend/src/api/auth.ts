import apiClient from './client'
import type { ApiResponse, User, AuthTokens, CreateUserInput, LoginInput } from '@ai-chat-hub/shared'

interface AuthResponse {
  user: Omit<User, 'settings'>
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export const authApi = {
  /**
   * 用户注册
   */
  register: async (data: CreateUserInput): Promise<AuthResponse> => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>('/auth/register', data)
    return response.data.data!
  },

  /**
   * 用户登录
   */
  login: async (data: LoginInput): Promise<AuthResponse> => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>('/auth/login', data)
    return response.data.data!
  },

  /**
   * 退出登录
   */
  logout: async (refreshToken?: string): Promise<void> => {
    await apiClient.post('/auth/logout', { refreshToken })
  },

  /**
   * 刷新 Token
   */
  refresh: async (refreshToken: string): Promise<AuthTokens> => {
    const response = await apiClient.post<ApiResponse<AuthTokens>>('/auth/refresh', {
      refreshToken,
    })
    return response.data.data!
  },
}
