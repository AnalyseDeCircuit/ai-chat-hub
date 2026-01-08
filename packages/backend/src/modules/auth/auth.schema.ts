import { z } from 'zod'
import { AUTH_CONFIG } from '@ai-chat-hub/shared'

// 注册请求 Schema
export const RegisterSchema = z.object({
  email: z
    .string()
    .email('请输入有效的邮箱地址')
    .max(AUTH_CONFIG.EMAIL_MAX_LENGTH, `邮箱长度不能超过 ${AUTH_CONFIG.EMAIL_MAX_LENGTH} 个字符`),
  password: z
    .string()
    .min(AUTH_CONFIG.PASSWORD_MIN_LENGTH, `密码至少 ${AUTH_CONFIG.PASSWORD_MIN_LENGTH} 个字符`)
    .max(AUTH_CONFIG.PASSWORD_MAX_LENGTH, `密码不能超过 ${AUTH_CONFIG.PASSWORD_MAX_LENGTH} 个字符`),
  nickname: z
    .string()
    .max(AUTH_CONFIG.NICKNAME_MAX_LENGTH, `昵称不能超过 ${AUTH_CONFIG.NICKNAME_MAX_LENGTH} 个字符`)
    .optional(),
})

// 登录请求 Schema
export const LoginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
})

// 刷新 Token Schema
export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, '请提供刷新令牌'),
})

// 类型导出
export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>
