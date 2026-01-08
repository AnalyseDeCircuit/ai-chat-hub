import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { env, type Env } from '../config/env.js'

// 扩展 Fastify 实例类型
declare module 'fastify' {
  interface FastifyInstance {
    config: Env
  }
}

const configPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('config', env)
}

export default fp(configPlugin, {
  name: 'config',
})
