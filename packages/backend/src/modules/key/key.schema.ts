import { z } from 'zod'
import { MODEL_PROVIDERS } from '@ai-chat-hub/shared'

export const UpsertKeySchema = z.object({
  provider: z.enum(MODEL_PROVIDERS as any),
  apiKey: z.string().min(1, 'API 密钥不能为空'),
  baseUrl: z.string().url('请输入有效的 URL').optional().or(z.literal('')),
})

export type UpsertKeyInput = z.infer<typeof UpsertKeySchema>
