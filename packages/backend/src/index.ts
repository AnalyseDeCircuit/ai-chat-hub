import { buildApp } from './app.js'
import { env } from './config/env.js'

async function main() {
  const app = await buildApp()

  try {
    await app.listen({
      port: env.PORT,
      host: '0.0.0.0',
    })

    console.log(`
🚀 AI-Chat-Hub 后端服务启动成功！

   环境: ${env.NODE_ENV}
   地址: http://localhost:${env.PORT}
   API:  http://localhost:${env.PORT}${env.API_PREFIX}
   健康检查: http://localhost:${env.PORT}/health
    `)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }

  // 优雅关闭
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`\n收到 ${signal} 信号，正在关闭服务...`)
      await app.close()
      console.log('服务已关闭')
      process.exit(0)
    })
  })
}

main()
