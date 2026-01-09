import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sendSuccess, sendError } from '../../utils/response.js'
import { HttpStatus, ErrorCodes } from '@ai-chat-hub/shared'
import type { ChatMessage } from '@ai-chat-hub/shared'
import { authMiddleware, requireUserId } from '../../middleware/auth.js'
import { getAdapter } from '../../adapters/index.js'
import { contextManagerService, tokenCounterService, createUsageStatsService, createFileParserService } from '../../services/index.js'

const ChatCompletionSchema = z.object({
  sessionId: z.string().uuid(),
  content: z.string().min(1).max(100000),
  modelId: z.string().uuid(),
  images: z.array(z.object({
    base64: z.string(),
    mimeType: z.string(),
  })).optional(),
  files: z.array(z.object({
    fileName: z.string(),
    fileType: z.string(),
    mimeType: z.string(),
    base64Data: z.string(),
    fileSize: z.number(),
  })).optional(),
})

const chatController: FastifyPluginAsync = async (fastify) => {
  const usageStatsService = createUsageStatsService(fastify.prisma)
  const fileParserService = createFileParserService()
  
  // 所有路由需要认证
  fastify.addHook('preHandler', authMiddleware)

  /**
   * POST /completions - 发送消息（流式响应）
   */
  fastify.post('/completions', async (request, reply) => {
    const userId = requireUserId(request)

    let input: z.infer<typeof ChatCompletionSchema>
    try {
      input = ChatCompletionSchema.parse(request.body)
    } catch (error) {
      return sendError(reply, ErrorCodes.VALIDATION_ERROR, HttpStatus.UNPROCESSABLE_ENTITY)
    }

    const { sessionId, content, modelId, images, files } = input

    // 验证会话
    const session = await fastify.prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    })

    if (!session) {
      return sendError(reply, ErrorCodes.SESSION_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    if (session.userId !== userId) {
      return sendError(reply, ErrorCodes.SESSION_ACCESS_DENIED, HttpStatus.FORBIDDEN)
    }

    // 获取模型信息
    const model = await fastify.prisma.model.findUnique({
      where: { id: modelId },
    })

    if (!model || !model.isActive) {
      return sendError(reply, ErrorCodes.MODEL_NOT_AVAILABLE, HttpStatus.BAD_REQUEST)
    }

    // 获取用户的 API 密钥
    const apiKeyRecord = await fastify.prisma.apiKey.findUnique({
      where: {
        userId_provider: { userId, provider: model.provider },
      },
    })

    if (!apiKeyRecord || !apiKeyRecord.isValid) {
      const errorMsg = `请先配置 ${model.provider} 的 API 密钥`
      fastify.log.error(`API 密钥缺失: userId=${userId}, provider=${model.provider}`)
      return sendError(
        reply,
        ErrorCodes.KEY_PROVIDER_REQUIRED,
        HttpStatus.BAD_REQUEST,
        errorMsg
      )
    }

    // 解密 API 密钥
    const { createEncryptionService } = await import('../../services/encryption.js')
    const encryption = createEncryptionService(fastify.config.ENCRYPTION_KEY)
    const apiKey = encryption.decrypt(apiKeyRecord.encryptedKey)

    // 获取适配器
    const adapter = getAdapter(model.provider)
    if (!adapter) {
      return sendError(reply, ErrorCodes.MODEL_NOT_AVAILABLE, HttpStatus.BAD_REQUEST)
    }

    // 保存用户消息
    const userMessage = await fastify.prisma.message.create({
      data: {
        sessionId,
        role: 'user',
        content,
        modelId: null,
        tokensInput: 0,
        tokensOutput: 0,
      },
    })

    // 保存图片附件
    if (images && images.length > 0) {
      await fastify.prisma.messageAttachment.createMany({
        data: images.map((img, index) => ({
          messageId: userMessage.id,
          type: 'image',
          fileName: `image_${Date.now()}_${index}.jpg`,
          mimeType: img.mimeType,
          size: Buffer.from(img.base64, 'base64').length,
          base64Data: img.base64,
          metadata: {},
        }))
      })
    }

    // 保存文件附件并解析内容
    let fileContext = ''
    if (files && files.length > 0) {
      for (const file of files) {
        const buffer = Buffer.from(file.base64Data, 'base64')
        
        // 保存文件附件
        await fastify.prisma.messageAttachment.create({
          data: {
            messageId: userMessage.id,
            type: 'file',
            fileName: file.fileName,
            mimeType: file.mimeType,
            size: file.fileSize,
            base64Data: file.base64Data,
            metadata: { fileType: file.fileType },
          },
        })

        // 解析文件内容并添加到消息
        try {
          const parsed = await fileParserService.parseFile(
            buffer,
            file.fileName,
            file.mimeType
          )
          fileContext += `\n\n【文件: ${parsed.fileName}】\n${parsed.content}`
        } catch (error) {
          console.error(`文件解析失败: ${file.fileName}`, error)
          fileContext += `\n\n【文件: ${file.fileName}】\n[解析失败]`
        }
      }

      // 更新消息内容，添加文件内容摘要
      if (fileContext) {
        await fastify.prisma.message.update({
          where: { id: userMessage.id },
          data: {
            content: content + fileContext,
          },
        })
      }
    }

    // 获取历史消息构建上下文（包含附件）
    const historyMessages = await fastify.prisma.message.findMany({
      where: { sessionId },
      include: { attachments: true },
      orderBy: { createdAt: 'asc' },
    })

    const chatMessages: ChatMessage[] = historyMessages.map((msg) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
      images: msg.attachments && msg.attachments.length > 0
        ? msg.attachments.filter(a => a.type === 'image').map(a => ({
            base64Data: a.base64Data || '',
            mimeType: a.mimeType,
          }))
        : undefined,
      files: msg.attachments && msg.attachments.length > 0
        ? msg.attachments.filter(a => a.type === 'file').map(a => ({
            fileName: a.fileName,
            fileType: (a.metadata as any)?.fileType || 'file',
            mimeType: a.mimeType,
            base64Data: a.base64Data || '',
            fileSize: a.size,
          }))
        : undefined,
    }))

    // 获取用户的模型配置
    const modelConfig = await fastify.prisma.modelConfig.findUnique({
      where: {
        userId_modelId: { userId, modelId },
      },
    })

    // 使用上下文管理器优化消息列表（智能截断）
    const systemPrompt = modelConfig?.systemPrompt || undefined
    const maxTokens = modelConfig?.maxTokens || 2048
    const contextWindow = contextManagerService.getOptimizedMessages(
      chatMessages,
      model.name,
      systemPrompt,
      maxTokens
    )

    // 记录上下文状态（用于调试和监控）
    if (contextWindow.truncated) {
      fastify.log.info(
        `Context truncated for session ${sessionId}: removed ${contextWindow.removedCount} messages, using ${contextWindow.totalTokens} tokens`
      )
    }

    // 创建助手消息占位
    const assistantMessage = await fastify.prisma.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content: '',
        modelId,
        tokensInput: 0,
        tokensOutput: 0,
      },
    })

    // 设置 SSE 响应头（手动添加 CORS 头，因为 raw 响应绕过了 Fastify 中间件）
    const origin = request.headers.origin || ''
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    })

    let fullContent = ''
    let promptTokens = 0
    let completionTokens = 0

    try {
      await adapter.streamCompletion(
        apiKey,
        model.name,
        contextWindow.messages, // 使用优化后的消息
        {
          temperature: modelConfig?.temperature ? Number(modelConfig.temperature) : 0.7,
          maxTokens,
          topP: modelConfig?.topP ? Number(modelConfig.topP) : 1,
          systemPrompt,
        },
        (chunk) => {
          if (chunk.type === 'content' && chunk.content) {
            fullContent += chunk.content
            reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`)
          } else if (chunk.type === 'done') {
            promptTokens = chunk.usage?.promptTokens || 0
            completionTokens = chunk.usage?.completionTokens || 0
          } else if (chunk.type === 'error') {
            reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`)
          }
        }
      )

      // 更新助手消息
      await fastify.prisma.message.update({
        where: { id: assistantMessage.id },
        data: {
          content: fullContent,
          tokensInput: promptTokens,
          tokensOutput: completionTokens,
        },
      })

      // 更新会话标题（如果是首次消息）
      if (historyMessages.length <= 1) {
        await fastify.prisma.session.update({
          where: { id: sessionId },
          data: {
            title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
          },
        })
      }

      // 更新 API 密钥最后使用时间
      await fastify.prisma.apiKey.update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: new Date() },
      })

      // 记录使用统计
      try {
        await usageStatsService.recordUsage(
          userId,
          modelId,
          promptTokens,
          completionTokens,
          Number(model.inputPrice),
          Number(model.outputPrice)
        )
      } catch (error) {
        // 统计记录失败不影响主流程
        fastify.log.error('Failed to record usage stats:', error)
      }

      // 发送完成消息
      reply.raw.write(
        `data: ${JSON.stringify({
          type: 'done',
          messageId: assistantMessage.id,
          usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
        })}\n\n`
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '生成失败'
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`)

      // 删除空的助手消息
      await fastify.prisma.message.delete({
        where: { id: assistantMessage.id },
      })
    }

    reply.raw.end()
  })

  /**
   * POST /stop - 停止生成
   */
  fastify.post('/stop', async (request, reply) => {
    // TODO: 实现停止生成逻辑（需要维护请求映射）
    return sendSuccess(reply, { message: 'ok' })
  })
}

export default chatController
