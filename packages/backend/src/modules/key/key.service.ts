import { PrismaClient } from '@prisma/client'
import { ErrorCodes, type ModelProvider } from '@ai-chat-hub/shared'
import type { EncryptionService } from '../../services/encryption.js'
import { getAdapter } from '../../adapters/index.js'

export class KeyService {
  constructor(
    private prisma: PrismaClient,
    private encryption: EncryptionService
  ) {}

  /**
   * 获取用户的所有 API 密钥
   */
  async list(userId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        keyHint: true,
        baseUrl: true,
        isValid: true,
        lastValidated: true,
        lastUsedAt: true,
        createdAt: true,
      },
    })

    return keys
  }

  /**
   * 添加或更新 API 密钥
   */
  async upsert(userId: string, provider: ModelProvider, apiKey: string, baseUrl?: string) {
    // 加密密钥
    const encryptedKey = this.encryption.encrypt(apiKey)
    const keyHint = this.encryption.generateHint(apiKey)

    // 验证密钥是否有效
    const isValid = await this.validateKey(provider, apiKey, baseUrl)

    // 存储密钥
    const record = await this.prisma.apiKey.upsert({
      where: {
        userId_provider: { userId, provider },
      },
      create: {
        userId,
        provider,
        encryptedKey,
        keyHint,
        baseUrl: baseUrl || null,
        isValid,
        lastValidated: new Date(),
      },
      update: {
        encryptedKey,
        keyHint,
        baseUrl: baseUrl || null,
        isValid,
        lastValidated: new Date(),
      },
      select: {
        id: true,
        provider: true,
        keyHint: true,
        baseUrl: true,
        isValid: true,
        lastValidated: true,
        createdAt: true,
      },
    })

    // 清除明文密钥
    this.encryption.secureWipe(apiKey)

    return record
  }

  /**
   * 删除 API 密钥
   */
  async delete(userId: string, provider: ModelProvider) {
    const key = await this.prisma.apiKey.findUnique({
      where: {
        userId_provider: { userId, provider },
      },
    })

    if (!key) {
      throw new KeyError(ErrorCodes.KEY_NOT_FOUND, 'API 密钥不存在')
    }

    await this.prisma.apiKey.delete({
      where: {
        userId_provider: { userId, provider },
      },
    })
  }

  /**
   * 验证密钥有效性
   */
  async validate(userId: string, provider: ModelProvider): Promise<boolean> {
    const key = await this.prisma.apiKey.findUnique({
      where: {
        userId_provider: { userId, provider },
      },
    })

    if (!key) {
      throw new KeyError(ErrorCodes.KEY_NOT_FOUND, 'API 密钥不存在')
    }

    // 解密密钥
    const apiKey = this.encryption.decrypt(key.encryptedKey)

    // 验证
    const isValid = await this.validateKey(provider, apiKey, key.baseUrl || undefined)

    // 更新验证状态
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: {
        isValid,
        lastValidated: new Date(),
      },
    })

    // 清除明文密钥
    this.encryption.secureWipe(apiKey)

    return isValid
  }

  /**
   * 获取解密的 API 密钥（仅供内部使用）
   */
  async getDecryptedKey(userId: string, provider: ModelProvider): Promise<string> {
    const key = await this.prisma.apiKey.findUnique({
      where: {
        userId_provider: { userId, provider },
      },
    })

    if (!key) {
      throw new KeyError(ErrorCodes.KEY_NOT_FOUND, 'API 密钥不存在')
    }

    if (!key.isValid) {
      throw new KeyError(ErrorCodes.KEY_INVALID, 'API 密钥无效')
    }

    // 更新最后使用时间
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    })

    return this.encryption.decrypt(key.encryptedKey)
  }

  /**
   * 使用适配器验证密钥
   */
  private async validateKey(provider: ModelProvider, apiKey: string, baseUrl?: string): Promise<boolean> {
    const adapter = getAdapter(provider, baseUrl)
    if (!adapter) {
      return false
    }

    try {
      return await adapter.validateKey(apiKey)
    } catch {
      return false
    }
  }
}

export class KeyError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'KeyError'
  }
}
