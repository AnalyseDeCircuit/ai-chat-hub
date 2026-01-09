import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import type { AuthTokens, JwtPayload } from '@ai-chat-hub/shared'
import { ErrorCodes } from '@ai-chat-hub/shared'
import type { RegisterInput, LoginInput } from './auth.schema.js'
import type { Env } from '../../config/env.js'

export class AuthService {
  constructor(
    private prisma: PrismaClient,
    private config: Env
  ) {}

  /**
   * 用户注册
   */
  async register(input: RegisterInput) {
    const { email, password, nickname } = input

    // 检查邮箱是否已存在
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      throw new AuthError(ErrorCodes.USER_EMAIL_EXISTS, '该邮箱已被注册')
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10)

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        nickname: nickname || email.split('@')[0],
        settings: {
          theme: 'system',
          language: 'zh-CN',
        },
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
      },
    })

    // 生成 Token
    const tokens = await this.generateTokens(user.id, user.email)

    return {
      user,
      ...tokens,
    }
  }

  /**
   * 用户登录
   */
  async login(input: LoginInput) {
    const { email, password } = input

    // 查找用户
    const user = await this.prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      throw new AuthError(ErrorCodes.AUTH_INVALID_CREDENTIALS, '邮箱或密码错误')
    }

    // 检查用户状态
    if (user.status === 'SUSPENDED') {
      throw new AuthError(ErrorCodes.USER_SUSPENDED, '账号已被暂停使用')
    }

    if (user.status === 'DELETED') {
      throw new AuthError(ErrorCodes.AUTH_INVALID_CREDENTIALS, '邮箱或密码错误')
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      throw new AuthError(ErrorCodes.AUTH_INVALID_CREDENTIALS, '邮箱或密码错误')
    }

    // 更新最后登录时间
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // 生成 Token
    const tokens = await this.generateTokens(user.id, user.email)

    return {
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        status: user.status,
        createdAt: user.createdAt,
      },
      ...tokens,
    }
  }

  /**
   * 刷新 Token
   */
  async refreshToken(refreshToken: string) {
    // 查找刷新令牌
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    })

    if (!tokenRecord) {
      throw new AuthError(ErrorCodes.AUTH_REFRESH_TOKEN_INVALID, '刷新令牌无效')
    }

    // 检查是否过期
    if (tokenRecord.expiresAt < new Date()) {
      // 删除过期的令牌
      await this.prisma.refreshToken.delete({
        where: { id: tokenRecord.id },
      })
      throw new AuthError(ErrorCodes.AUTH_TOKEN_EXPIRED, '刷新令牌已过期，请重新登录')
    }

    // 检查用户状态
    if (tokenRecord.user.status !== 'ACTIVE') {
      throw new AuthError(ErrorCodes.USER_SUSPENDED, '账号已被暂停使用')
    }

    // 删除旧的刷新令牌
    await this.prisma.refreshToken.delete({
      where: { id: tokenRecord.id },
    })

    // 生成新的 Token
    const tokens = await this.generateTokens(tokenRecord.user.id, tokenRecord.user.email)

    return tokens
  }

  /**
   * 退出登录
   */
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      // 删除指定的刷新令牌
      await this.prisma.refreshToken.deleteMany({
        where: {
          userId,
          token: refreshToken,
        },
      })
    } else {
      // 删除用户所有的刷新令牌（全设备退出）
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      })
    }
  }

  /**
   * 生成 Token 对
   */
  private async generateTokens(userId: string, email: string): Promise<AuthTokens> {
    // 生成访问令牌
    const accessToken = jwt.sign(
      { userId, email } as Omit<JwtPayload, 'iat' | 'exp'>,
      this.config.JWT_SECRET,
      { expiresIn: this.config.JWT_EXPIRES_IN as string }
    )

    // 生成刷新令牌
    const refreshToken = randomUUID()
    const refreshTokenExpiresIn = this.parseExpiration(this.config.REFRESH_TOKEN_EXPIRES_IN)

    // 存储刷新令牌
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + refreshTokenExpiresIn),
      },
    })

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiration(this.config.JWT_EXPIRES_IN) / 1000, // 转为秒
    }
  }

  /**
   * 解析过期时间字符串
   */
  private parseExpiration(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/)
    if (!match) {
      return 15 * 60 * 1000 // 默认 15 分钟
    }

    const value = parseInt(match[1], 10)
    const unit = match[2]

    switch (unit) {
      case 's':
        return value * 1000
      case 'm':
        return value * 60 * 1000
      case 'h':
        return value * 60 * 60 * 1000
      case 'd':
        return value * 24 * 60 * 60 * 1000
      default:
        return 15 * 60 * 1000
    }
  }
}

/**
 * 认证错误类
 */
export class AuthError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'AuthError'
  }
}
