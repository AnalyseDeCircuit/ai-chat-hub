import { z } from 'zod'
import dotenv from 'dotenv'

// 加载环境变量
dotenv.config()

// 环境变量 Schema
const envSchema = z.object({
  // 应用配置
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  API_PREFIX: z.string().default('/api/v1'),

  // 数据库
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),

  // JWT 认证
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  // 加密
  ENCRYPTION_KEY: z.string().min(32),

  // 限流
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),

  // 日志
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
})

// 解析环境变量
const parseEnv = () => {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    console.error('❌ 环境变量验证失败:')
    console.error(parsed.error.format())
    process.exit(1)
  }

  return parsed.data
}

export const env = parseEnv()

// 类型导出
export type Env = z.infer<typeof envSchema>
