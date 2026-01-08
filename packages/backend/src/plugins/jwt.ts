import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'

// 扩展 FastifyRequest 类型
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string
      email: string
    }
    user: {
      userId: string
      email: string
    }
  }
}

const jwtPlugin: FastifyPluginAsync = async (fastify) => {
  // 注册 JWT 插件
  await fastify.register(jwt, {
    secret: fastify.config.JWT_SECRET,
    sign: {
      expiresIn: fastify.config.JWT_EXPIRES_IN,
    },
  })

  // 添加认证装饰器
  fastify.decorate('authenticate', async function (request: FastifyRequest) {
    try {
      await request.jwtVerify()
    } catch (err) {
      throw err
    }
  })
}

// 扩展 Fastify 实例类型
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>
  }
}

export default fp(jwtPlugin, {
  name: 'jwt',
  dependencies: ['config'],
})
