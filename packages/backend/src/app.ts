import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { env } from './config/env.js'
import configPlugin from './plugins/config.js'
import prismaPlugin from './plugins/prisma.js'
import jwtPlugin from './plugins/jwt.js'
import { authController } from './modules/auth/index.js'
import { userController } from './modules/user/index.js'
import { sessionController } from './modules/session/index.js'
import { messageController } from './modules/message/index.js'
import { modelController } from './modules/model/index.js'
import { keyController } from './modules/key/index.js'
import { chatController } from './modules/chat/index.js'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
                colorize: true,
              },
            }
          : undefined,
    },
  })

  // 注册配置插件
  await app.register(configPlugin)

  // 注册安全相关插件
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  })

  // 注册 CORS
  await app.register(cors, {
    origin:
      env.NODE_ENV === 'development'
        ? /^http:\/\/localhost:\d+$/
        : env.CORS_ORIGIN.split(','),
    credentials: true,
    methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,Accept,X-Requested-With',
  })

  // 注册限流
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  })

  // 注册数据库插件
  await app.register(prismaPlugin)

  // 注册 JWT 插件
  await app.register(jwtPlugin)

  // 健康检查路由
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }
  })

  // API 路由前缀
  app.register(
    async (api) => {
      // 注册各模块路由
      await api.register(authController, { prefix: '/auth' })
      await api.register(userController, { prefix: '/users' })
      await api.register(sessionController, { prefix: '/sessions' })
      await api.register(messageController, { prefix: '/messages' })
      await api.register(modelController, { prefix: '/models' })
      await api.register(keyController, { prefix: '/keys' })
      await api.register(chatController, { prefix: '/chat' })
      
      // 导出功能路由
      const exportController = await import('./modules/session/export.controller.js')
      await api.register(exportController.default, { prefix: '/sessions' })
      
      // 统计功能路由
      const statsController = await import('./modules/stats/stats.controller.js')
      await api.register(statsController.default, { prefix: '/stats' })
      // await api.register(statsRoutes, { prefix: '/stats' })

      // 测试路由
      api.get('/ping', async () => {
        return { message: 'pong', timestamp: new Date().toISOString() }
      })
    },
    { prefix: env.API_PREFIX }
  )

  // 全局错误处理
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error)

    // Zod 验证错误
    if (error.name === 'ZodError') {
      return reply.code(422).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '请求参数验证失败',
          details: error,
        },
      })
    }

    // JWT 错误
    if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'AUTH_UNAUTHORIZED',
          message: '未提供认证令牌',
        },
      })
    }

    // 限流错误
    if (error.statusCode === 429) {
      return reply.code(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: '请求过于频繁，请稍后再试',
        },
      })
    }

    // 其他错误
    const statusCode = error.statusCode || 500
    return reply.code(statusCode).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: env.NODE_ENV === 'production' ? '服务器内部错误' : error.message,
        ...(env.NODE_ENV !== 'production' && { details: error.stack }),
      },
    })
  })

  // 404 处理
  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `路由 ${request.method} ${request.url} 不存在`,
      },
    })
  })

  return app
}
