import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { PrismaClient } from '@prisma/client'

// 扩展 Fastify 实例类型
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  const prisma = new PrismaClient({
    log:
      fastify.config.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
  })

  // 连接数据库
  await prisma.$connect()
  fastify.log.info('📦 数据库连接成功')

  // 挂载到 fastify 实例
  fastify.decorate('prisma', prisma)

  // 关闭时断开连接
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect()
    fastify.log.info('📦 数据库连接已断开')
  })
}

export default fp(prismaPlugin, {
  name: 'prisma',
})
