import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sendSuccess, sendError } from '../../utils/response.js'
import { HttpStatus, ErrorCodes } from '@ai-chat-hub/shared'
import type { ChatMessage } from '@ai-chat-hub/shared'
import { authMiddleware, requireUserId } from '../../middleware/auth.js'
import { getAdapter } from '../../adapters/index.js'
import { contextManagerService, createUsageStatsService, createFileParserService, tokenCounterService } from '../../services/index.js'
import { StreamBuffer } from '../../utils/stream-buffer.js'
import { webSearch, formatSearchResultsForAI } from '../../services/web-search.js'

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
  webSearch: z.boolean().optional().default(false), // 是否启用联网搜索
})

const StopGenerationSchema = z.object({
  sessionId: z.string().uuid(),
})

// 活跃的生成请求映射：sessionId -> AbortController
const activeGenerations = new Map<string, AbortController>()

/**
 * 验证 CORS origin 是否在允许列表中
 */
function isAllowedOrigin(origin: string, config: { NODE_ENV: string; CORS_ORIGIN: string }): boolean {
  if (!origin) return false
  
  // 开发环境允许 localhost
  if (config.NODE_ENV === 'development') {
    return /^http:\/\/localhost:\d+$/.test(origin)
  }
  
  // 生产环境验证白名单
  const allowedOrigins = config.CORS_ORIGIN.split(',').map(o => o.trim())
  return allowedOrigins.includes(origin)
}

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

    // 如果启用联网搜索，获取搜索结果
    let searchContext = ''
    if (input.webSearch) {
      try {
        fastify.log.info(`Performing web search for: ${content.slice(0, 100)}...`)
        const searchResponse = await webSearch(content, 5)
        searchContext = formatSearchResultsForAI(searchResponse)
        fastify.log.info(`Web search completed: ${searchResponse.results.length} results in ${searchResponse.searchTime}ms`)
      } catch (error) {
        fastify.log.warn(`Web search failed: ${error}`)
        // 搜索失败不阻断请求，继续使用普通上下文
      }
    }

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

    // 构建系统提示词（含搜索上下文）
    let systemPrompt = modelConfig?.systemPrompt || ''
    if (searchContext) {
      systemPrompt = (systemPrompt ? systemPrompt + '\n\n' : '') + searchContext
    }

    // 使用上下文管理器优化消息列表（智能截断）
    const maxTokens = modelConfig?.maxTokens || 2048
    const contextWindow = contextManagerService.getOptimizedMessages(
      chatMessages,
      model.name,
      systemPrompt || undefined,
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
    
    // 验证 origin 是否在允许列表中
    const allowedOrigin = isAllowedOrigin(origin, fastify.config) ? origin : ''
    
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...(allowedOrigin && {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Credentials': 'true',
      }),
    })

    // 创建 AbortController 用于停止生成
    const abortController = new AbortController()
    activeGenerations.set(sessionId, abortController)

    // 性能优化：使用数组存储内容块，避免频繁的字符串连接
    const contentChunks: string[] = []
    let promptTokens = 0
    let completionTokens = 0

    // 性能优化：创建流式缓冲器，合并小数据块
    // 参数：50字符或100ms后刷新，减少网络消息数量80-90%
    const streamBuffer = new StreamBuffer(50, 100)

    // 监听客户端断开连接
    request.raw.on('close', () => {
      streamBuffer.dispose() // 清理缓冲器资源
      if (activeGenerations.has(sessionId)) {
        activeGenerations.get(sessionId)?.abort()
        activeGenerations.delete(sessionId)
      }
    })

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
          // 检查是否被中止
          if (abortController.signal.aborted) {
            return
          }
          
          if (chunk.type === 'content' && chunk.content) {
            // 性能优化：存入数组而非字符串拼接，O(n) vs O(n²)
            contentChunks.push(chunk.content)
            
            // 性能优化：通过缓冲器发送，合并小数据块
            streamBuffer.push(chunk.content, (bufferedContent) => {
              reply.raw.write(`data: ${JSON.stringify({
                type: 'content',
                content: bufferedContent
              })}\n\n`)
            })
          } else if (chunk.type === 'done') {
            // 确保所有缓冲内容都已发送
            streamBuffer.flush((bufferedContent) => {
              if (bufferedContent) {
                reply.raw.write(`data: ${JSON.stringify({
                  type: 'content',
                  content: bufferedContent
                })}\n\n`)
              }
            })
            promptTokens = chunk.usage?.promptTokens || 0
            completionTokens = chunk.usage?.completionTokens || 0
          } else if (chunk.type === 'error') {
            streamBuffer.dispose() // 错误时清理缓冲器
            reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`)
          }
        },
        abortController.signal // 传递 signal 给适配器
      )

      // 性能优化：使用 join 合并内容，避免 O(n²) 的字符串连接
      const fullContent = contentChunks.join('')
      
      // 更新助手消息
      await fastify.prisma.message.update({
        where: { id: assistantMessage.id },
        data: {
          content: fullContent,
          tokensInput: promptTokens,
          tokensOutput: completionTokens,
        },
      })

      // 如果 API 没有返回 token 使用量，使用 tokenCounterService 估算
      if (promptTokens === 0 && completionTokens === 0) {
        promptTokens = tokenCounterService.countTokens(contextWindow.messages, model.name)
        completionTokens = tokenCounterService.countTokens([{ role: 'assistant', content: fullContent }], model.name)
      }

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
      } catch (err) {
        // 统计记录失败不影响主流程
        fastify.log.error({ err }, 'Failed to record usage stats')
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
    } finally {
      // 清理活跃生成映射
      activeGenerations.delete(sessionId)
    }

    reply.raw.end()
  })

  /**
   * POST /stop - 停止生成
   */
  fastify.post('/stop', async (request, reply) => {
    const userId = requireUserId(request)

    let input: z.infer<typeof StopGenerationSchema>
    try {
      input = StopGenerationSchema.parse(request.body)
    } catch (error) {
      return sendError(reply, ErrorCodes.VALIDATION_ERROR, HttpStatus.UNPROCESSABLE_ENTITY)
    }

    const { sessionId } = input

    // 验证会话所有权
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

    // 停止生成
    const controller = activeGenerations.get(sessionId)
    if (controller) {
      controller.abort()
      activeGenerations.delete(sessionId)
      fastify.log.info(`Generation stopped for session ${sessionId}`)
      return sendSuccess(reply, { message: '已停止生成', stopped: true })
    }

    return sendSuccess(reply, { message: '没有正在进行的生成', stopped: false })
  })

  /**
   * POST /regenerate - 重新生成消息（流式响应）
   */
  fastify.post('/regenerate', async (request, reply) => {
    const userId = requireUserId(request)

    const RegenerateSchema = z.object({
      messageId: z.string().uuid(),
      modelId: z.string().uuid().optional(),
    })

    let input: z.infer<typeof RegenerateSchema>
    try {
      input = RegenerateSchema.parse(request.body)
    } catch (error) {
      return sendError(reply, ErrorCodes.VALIDATION_ERROR, HttpStatus.UNPROCESSABLE_ENTITY)
    }

    const { messageId, modelId: newModelId } = input

    // 获取原始消息
    const originalMessage = await fastify.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        session: { select: { id: true, userId: true } },
      },
    })

    if (!originalMessage) {
      return sendError(reply, ErrorCodes.MESSAGE_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    if (originalMessage.session.userId !== userId) {
      return sendError(reply, ErrorCodes.SESSION_ACCESS_DENIED, HttpStatus.FORBIDDEN)
    }

    if (originalMessage.role !== 'assistant') {
      return sendError(reply, ErrorCodes.BAD_REQUEST, HttpStatus.BAD_REQUEST, '只能重新生成助手消息')
    }

    const sessionId = originalMessage.session.id
    const modelId = newModelId || originalMessage.modelId

    if (!modelId) {
      return sendError(reply, ErrorCodes.BAD_REQUEST, HttpStatus.BAD_REQUEST, '未指定模型')
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
      where: { userId_provider: { userId, provider: model.provider } },
    })

    if (!apiKeyRecord || !apiKeyRecord.isValid) {
      return sendError(reply, ErrorCodes.KEY_PROVIDER_REQUIRED, HttpStatus.BAD_REQUEST, `请先配置 ${model.provider} 的 API 密钥`)
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

    // 获取原始消息之前的历史消息（不包含原始助手消息）
    const historyMessages = await fastify.prisma.message.findMany({
      where: {
        sessionId,
        createdAt: { lt: originalMessage.createdAt },
      },
      include: { attachments: true },
      orderBy: { createdAt: 'asc' },
    })

    const chatMessages: ChatMessage[] = historyMessages.map((msg) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
      images: msg.attachments?.filter(a => a.type === 'image').map(a => ({
        base64Data: a.base64Data || '',
        mimeType: a.mimeType,
      })),
      files: msg.attachments?.filter(a => a.type === 'file').map(a => ({
        fileName: a.fileName,
        fileType: (a.metadata as any)?.fileType || 'file',
        mimeType: a.mimeType,
        base64Data: a.base64Data || '',
        fileSize: a.size,
      })),
    }))

    // 获取用户的模型配置
    const modelConfig = await fastify.prisma.modelConfig.findUnique({
      where: { userId_modelId: { userId, modelId } },
    })

    const systemPrompt = modelConfig?.systemPrompt || undefined
    const maxTokens = modelConfig?.maxTokens || 2048

    // 上下文优化
    const contextWindow = contextManagerService.getOptimizedMessages(
      chatMessages,
      model.name,
      systemPrompt,
      maxTokens
    )

    // 创建新版本消息
    const newMessage = await fastify.prisma.message.create({
      data: {
        sessionId,
        parentId: originalMessage.parentId || messageId,
        role: 'assistant',
        content: '',
        modelId,
        version: originalMessage.version + 1,
        tokensInput: 0,
        tokensOutput: 0,
      },
    })

    // 设置 SSE 响应头
    const origin = request.headers.origin || ''
    const allowedOrigin = isAllowedOrigin(origin, fastify.config) ? origin : ''

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...(allowedOrigin && {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Credentials': 'true',
      }),
    })

    const abortController = new AbortController()
    activeGenerations.set(sessionId, abortController)

    // 性能优化：使用数组存储内容块
    const contentChunks: string[] = []
    let promptTokens = 0
    let completionTokens = 0

    // 性能优化：创建流式缓冲器
    const streamBuffer = new StreamBuffer(50, 100)

    request.raw.on('close', () => {
      streamBuffer.dispose()
      if (activeGenerations.has(sessionId)) {
        activeGenerations.get(sessionId)?.abort()
        activeGenerations.delete(sessionId)
      }
    })

    try {
      await adapter.streamCompletion(
        apiKey,
        model.name,
        contextWindow.messages,
        {
          temperature: modelConfig?.temperature ? Number(modelConfig.temperature) : 0.7,
          maxTokens,
          topP: modelConfig?.topP ? Number(modelConfig.topP) : 1,
          systemPrompt,
        },
        (chunk) => {
          if (abortController.signal.aborted) return

          if (chunk.type === 'content' && chunk.content) {
            contentChunks.push(chunk.content)
            streamBuffer.push(chunk.content, (bufferedContent) => {
              reply.raw.write(`data: ${JSON.stringify({
                type: 'content',
                content: bufferedContent
              })}\n\n`)
            })
          } else if (chunk.type === 'done') {
            streamBuffer.flush((bufferedContent) => {
              if (bufferedContent) {
                reply.raw.write(`data: ${JSON.stringify({
                  type: 'content',
                  content: bufferedContent
                })}\n\n`)
              }
            })
            promptTokens = chunk.usage?.promptTokens || 0
            completionTokens = chunk.usage?.completionTokens || 0
          } else if (chunk.type === 'error') {
            streamBuffer.dispose()
            reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`)
          }
        },
        abortController.signal
      )

      // 性能优化：使用 join 合并内容
      const fullContent = contentChunks.join('')
      
      // 更新新消息
      await fastify.prisma.message.update({
        where: { id: newMessage.id },
        data: {
          content: fullContent,
          tokensInput: promptTokens,
          tokensOutput: completionTokens,
        },
      })

      // 如果 API 没有返回 token 使用量，使用 tokenCounterService 估算
      if (promptTokens === 0 && completionTokens === 0) {
        promptTokens = tokenCounterService.countTokens(contextWindow.messages, model.name)
        completionTokens = tokenCounterService.countTokens([{ role: 'assistant', content: fullContent }], model.name)
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
      } catch (err) {
        fastify.log.error({ err }, 'Failed to record usage stats')
      }

      // 发送完成消息
      reply.raw.write(
        `data: ${JSON.stringify({
          type: 'done',
          messageId: newMessage.id,
          usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
        })}\n\n`
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '重新生成失败'
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`)

      await fastify.prisma.message.delete({ where: { id: newMessage.id } })
    } finally {
      activeGenerations.delete(sessionId)
    }

    reply.raw.end()
  })
}

export default chatController
