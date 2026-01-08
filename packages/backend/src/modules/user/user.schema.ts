import { z } from 'zod'
import { AUTH_CONFIG } from '@ai-chat-hub/shared'

// 更新用户信息 Schema
export const UpdateUserSchema = z.object({
  nickname: z
    .string()
    .max(AUTH_CONFIG.NICKNAME_MAX_LENGTH, `昵称不能超过 ${AUTH_CONFIG.NICKNAME_MAX_LENGTH} 个字符`)
    .optional(),
  avatarUrl: z.string().url('请输入有效的头像 URL').optional(),
})

// 更新用户设置 Schema
export const UpdateSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().optional(),
  defaultModelId: z.string().uuid().optional().nullable(),
})

// 修改密码 Schema
export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1, '请输入旧密码'),
  newPassword: z
    .string()
    .min(AUTH_CONFIG.PASSWORD_MIN_LENGTH, `新密码至少 ${AUTH_CONFIG.PASSWORD_MIN_LENGTH} 个字符`)
    .max(AUTH_CONFIG.PASSWORD_MAX_LENGTH, `新密码不能超过 ${AUTH_CONFIG.PASSWORD_MAX_LENGTH} 个字符`),
})

// 注销账号 Schema
export const DeleteAccountSchema = z.object({
  password: z.string().min(1, '请输入密码确认'),
})

// 类型导出
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>
export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>
