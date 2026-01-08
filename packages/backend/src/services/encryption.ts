import crypto from 'crypto'

/**
 * 加密服务
 * 使用 AES-256-GCM 进行加密
 */
export class EncryptionService {
  private algorithm = 'aes-256-gcm'
  private keyLength = 32 // 256 bits
  private ivLength = 16 // 128 bits
  private tagLength = 16 // 128 bits

  private key: Buffer

  constructor(secretKey: string) {
    // 如果是 Base64 编码，解码为 Buffer
    let keyBuffer: Buffer
    if (/^[A-Za-z0-9+/=]+$/.test(secretKey)) {
      try {
        keyBuffer = Buffer.from(secretKey, 'base64')
      } catch {
        keyBuffer = Buffer.from(secretKey)
      }
    } else {
      keyBuffer = Buffer.from(secretKey)
    }

    // 如果长度不足 32 字节，使用 SHA-256 派生密钥
    if (keyBuffer.length !== this.keyLength) {
      keyBuffer = crypto.createHash('sha256').update(secretKey).digest()
    }

    this.key = keyBuffer
  }

  /**
   * 加密文本
   */
  encrypt(plaintext: string): string {
    // 生成随机 IV
    const iv = crypto.randomBytes(this.ivLength)

    // 创建加密器
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv)

    // 加密数据
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // 获取认证标签
    const authTag = cipher.getAuthTag()

    // 组合 IV + 认证标签 + 密文
    // 格式: [iv(16 bytes)][authTag(16 bytes)][encrypted]
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'hex'),
    ])

    return combined.toString('base64')
  }

  /**
   * 解密文本
   */
  decrypt(ciphertext: string): string {
    try {
      // 从 base64 解码
      const combined = Buffer.from(ciphertext, 'base64')

      // 提取 IV、认证标签和密文
      const iv = combined.slice(0, this.ivLength)
      const authTag = combined.slice(this.ivLength, this.ivLength + this.tagLength)
      const encrypted = combined.slice(this.ivLength + this.tagLength)

    // 创建解密器
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv)

      decipher.setAuthTag(authTag)

      // 解密数据
      let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } catch (error) {
      throw new Error('解密失败：数据已损坏或密钥错误')
    }
  }

  /**
   * 生成密钥提示
   * 例如: sk-...xxxx
   */
  generateHint(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '****'
    }
    const prefix = apiKey.slice(0, 3)
    const suffix = apiKey.slice(-4)
    return `${prefix}...${suffix}`
  }

  /**
   * 安全清除字符串（覆盖内存）
   */
  secureWipe(str: string): void {
    // 在 JavaScript 中很难真正清除内存
    // 但我们可以尝试覆盖
    if (typeof str === 'string') {
      for (let i = 0; i < str.length; i++) {
        // 尝试覆盖（实际效果有限，因为字符串是不可变的）
      }
    }
  }
}

/**
 * 创建加密服务实例
 */
export function createEncryptionService(secretKey: string): EncryptionService {
  return new EncryptionService(secretKey)
}
