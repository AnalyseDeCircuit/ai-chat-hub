import { FastifyPluginAsync } from 'fastify'
import { sendSuccess, sendError } from '../../utils/response.js'
import { HttpStatus, ErrorCodes } from '@ai-chat-hub/shared'
import { authMiddleware, requireUserId } from '../../middleware/auth.js'

const exportController: FastifyPluginAsync = async (fastify) => {
  // 所有路由需要认证
  fastify.addHook('preHandler', authMiddleware)

  /**
   * GET /:id/export/markdown - 导出为 Markdown
   */
  fastify.get('/:id/export/markdown', async (request, reply) => {
    const userId = requireUserId(request)
    const { id } = request.params as { id: string }

    // 验证会话权限
    const session = await fastify.prisma.session.findUnique({
      where: { id },
      select: { userId: true, title: true },
    })

    if (!session) {
      return sendError(reply, ErrorCodes.SESSION_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    if (session.userId !== userId) {
      return sendError(reply, ErrorCodes.SESSION_ACCESS_DENIED, HttpStatus.FORBIDDEN)
    }

    // 获取所有消息
    const messages = await fastify.prisma.message.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        model: {
          select: { displayName: true },
        },
      },
    })

    // 生成 Markdown
    let markdown = `# ${session.title || '对话'}\n\n`
    markdown += `导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`
    markdown += `---\n\n`

    for (const message of messages) {
      if (message.role === 'user') {
        markdown += `## 👤 用户\n\n`
      } else if (message.role === 'assistant') {
        const modelName = message.model?.displayName || '助手'
        markdown += `## 🤖 ${modelName}\n\n`
      }

      markdown += `${message.content}\n\n`
    }

    // 设置下载响应头
    reply.header(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(session.title || 'chat')}.md"`
    )
    reply.header('Content-Type', 'text/markdown; charset=utf-8')

    return reply.send(markdown)
  })

  /**
   * GET /:id/export/json - 导出为 JSON
   */
  fastify.get('/:id/export/json', async (request, reply) => {
    const userId = requireUserId(request)
    const { id } = request.params as { id: string }

    // 验证会话权限
    const session = await fastify.prisma.session.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            model: {
              select: {
                name: true,
                displayName: true,
                provider: true,
              },
            },
          },
        },
      },
    })

    if (!session) {
      return sendError(reply, ErrorCodes.SESSION_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    if (session.userId !== userId) {
      return sendError(reply, ErrorCodes.SESSION_ACCESS_DENIED, HttpStatus.FORBIDDEN)
    }

    // 生成 JSON
    const exportData = {
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      exportedAt: new Date().toISOString(),
      messages: session.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        model: msg.model
          ? {
              name: msg.model.name,
              displayName: msg.model.displayName,
              provider: msg.model.provider,
            }
          : null,
        tokensInput: msg.tokensInput,
        tokensOutput: msg.tokensOutput,
        createdAt: msg.createdAt,
      })),
    }

    // 设置下载响应头
    reply.header(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(session.title || 'chat')}.json"`
    )
    reply.header('Content-Type', 'application/json; charset=utf-8')

    return reply.send(JSON.stringify(exportData, null, 2))
  })

  /**
   * GET /:id/export/text - 导出为纯文本
   */
  fastify.get('/:id/export/text', async (request, reply) => {
    const userId = requireUserId(request)
    const { id } = request.params as { id: string }

    // 验证会话权限
    const session = await fastify.prisma.session.findUnique({
      where: { id },
      select: { userId: true, title: true },
    })

    if (!session) {
      return sendError(reply, ErrorCodes.SESSION_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    if (session.userId !== userId) {
      return sendError(reply, ErrorCodes.SESSION_ACCESS_DENIED, HttpStatus.FORBIDDEN)
    }

    // 获取所有消息
    const messages = await fastify.prisma.message.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        model: {
          select: { displayName: true },
        },
      },
    })

    // 生成纯文本
    let text = `${session.title || '对话'}\n`
    text += `导出时间: ${new Date().toLocaleString('zh-CN')}\n`
    text += `${'='.repeat(50)}\n\n`

    for (const message of messages) {
      if (message.role === 'user') {
        text += `[用户]\n`
      } else if (message.role === 'assistant') {
        const modelName = message.model?.displayName || '助手'
        text += `[${modelName}]\n`
      }

      text += `${message.content}\n\n`
      text += `${'-'.repeat(50)}\n\n`
    }

    // 设置下载响应头
    reply.header(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(session.title || 'chat')}.txt"`
    )
    reply.header('Content-Type', 'text/plain; charset=utf-8')

    return reply.send(text)
  })
}

export default exportController
