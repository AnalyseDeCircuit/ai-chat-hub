import { FastifyPluginAsync } from 'fastify'
import { KeyService, KeyError } from './key.service.js'
import { UpsertKeySchema } from './key.schema.js'
import { sendSuccess, sendError } from '../../utils/response.js'
import { HttpStatus, ErrorCodes } from '@ai-chat-hub/shared'
import { authMiddleware, requireUserId } from '../../middleware/auth.js'
import { createEncryptionService } from '../../services/encryption.js'
import { detectModels } from '../../services/model-detector.js'

const keyController: FastifyPluginAsync = async (fastify) => {
  const encryption = createEncryptionService(fastify.config.ENCRYPTION_KEY)
  const keyService = new KeyService(fastify.prisma, encryption)

  // 所有路由需要认证
  fastify.addHook('preHandler', authMiddleware)

  /**
   * GET / - 获取用户的所有 API 密钥
   */
  fastify.get('/', async (request, reply) => {
    const userId = requireUserId(request)
    const keys = await keyService.list(userId)
    return sendSuccess(reply, keys)
  })

  /**
   * POST / - 添加或更新 API 密钥（并自动探测模型）
   */
  fastify.post('/', async (request, reply) => {
    try {
      const userId = requireUserId(request)
      const input = UpsertKeySchema.parse(request.body)

      const key = await keyService.upsert(
        userId,
        input.provider,
        input.apiKey,
        input.baseUrl || undefined
      )

      // 异步探测并添加模型（不阻塞响应）
      detectModels(input.provider, input.apiKey, input.baseUrl || undefined)
        .then(async (detectedModels) => {
          // 将探测到的模型添加到数据库
          for (const model of detectedModels) {
            try {
              await fastify.prisma.model.upsert({
                where: {
                  provider_name: {
                    provider: input.provider,
                    name: model.id,
                  },
                },
                create: {
                  provider: input.provider,
                  name: model.id,
                  displayName: model.name,
                  contextLength: model.contextLength,
                  inputPrice: 0,
                  outputPrice: 0,
                  capabilities: [
                    'chat',
                    ...(model.supportsVision ? ['vision'] : []),
                    ...(model.supportsFunctionCall ? ['function_call'] : []),
                  ],
                  isActive: true,
                },
                update: {
                  displayName: model.name,
                  contextLength: model.contextLength,
                  capabilities: [
                    'chat',
                    ...(model.supportsVision ? ['vision'] : []),
                    ...(model.supportsFunctionCall ? ['function_call'] : []),
                  ],
                  isActive: true,
                },
              })
            } catch (err) {
              fastify.log.error({ err, modelId: model.id }, 'Failed to upsert model')
            }
          }
          fastify.log.info(`Detected ${detectedModels.length} models for ${input.provider}`)
        })
        .catch((err) => {
          fastify.log.error({ err, provider: input.provider }, 'Failed to detect models')
        })

      // 记录审计日志
      await fastify.prisma.auditLog.create({
        data: {
          userId,
          action: 'api_key_update',
          resourceType: 'api_key',
          resourceId: key.id,
          details: { provider: input.provider },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      })

      return sendSuccess(reply, key, HttpStatus.CREATED)
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return sendError(reply, ErrorCodes.VALIDATION_ERROR, HttpStatus.UNPROCESSABLE_ENTITY)
      }
      throw error
    }
  })

  /**
   * DELETE /:provider - 删除 API 密钥
   */
  fastify.delete('/:provider', async (request, reply) => {
    try {
      const userId = requireUserId(request)
      const { provider } = request.params as { provider: string }

      await keyService.delete(userId, provider as any)

      // 记录审计日志
      await fastify.prisma.auditLog.create({
        data: {
          userId,
          action: 'api_key_delete',
          resourceType: 'api_key',
          details: { provider },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      })

      return sendSuccess(reply, null, HttpStatus.NO_CONTENT)
    } catch (error) {
      if (error instanceof KeyError) {
        return sendError(reply, error.code, HttpStatus.NOT_FOUND, error.message)
      }
      throw error
    }
  })

  /**
   * POST /:provider/validate - 验证 API 密钥
   */
  fastify.post('/:provider/validate', async (request, reply) => {
    try {
      const userId = requireUserId(request)
      const { provider } = request.params as { provider: string }

      const isValid = await keyService.validate(userId, provider as any)

      return sendSuccess(reply, { isValid })
    } catch (error) {
      if (error instanceof KeyError) {
        return sendError(reply, error.code, HttpStatus.NOT_FOUND, error.message)
      }
      throw error
    }
  })
}

export default keyController
