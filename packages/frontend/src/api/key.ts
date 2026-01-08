import { apiClient } from './client'
import type { ApiKey, CreateApiKeyInput, ModelProvider, ApiResponse } from '@ai-chat-hub/shared'

/**
 * 获取所有 API 密钥
 */
export async function getApiKeys(): Promise<ApiKey[]> {
  const response = await apiClient.get<ApiResponse<ApiKey[]>>('/keys')
  return response.data.data!
}

/**
 * 添加或更新 API 密钥
 */
export async function upsertApiKey(input: CreateApiKeyInput): Promise<ApiKey> {
  const response = await apiClient.post<ApiResponse<ApiKey>>('/keys', input)
  return response.data.data!
}

/**
 * 删除 API 密钥
 */
export async function deleteApiKey(provider: ModelProvider): Promise<void> {
  await apiClient.delete(`/keys/${provider}`)
}

/**
 * 验证 API 密钥
 */
export async function validateApiKey(provider: ModelProvider): Promise<boolean> {
  const response = await apiClient.post<ApiResponse<{ isValid: boolean }>>(`/keys/${provider}/validate`)
  return response.data.data!.isValid
}
