import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { ErrorCodes } from '@ai-chat-hub/shared'
import type { UpdateUserInput, UpdateSettingsInput, ChangePasswordInput } from './user.schema.js'

export class UserService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 获取用户信息
   */
  async getById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        status: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    })

    if (!user) {
      throw new UserError(ErrorCodes.USER_NOT_FOUND, '用户不存在')
    }

    return user
  }

  /**
   * 更新用户信息
   */
  async update(userId: string, input: UpdateUserInput) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.nickname !== undefined && { nickname: input.nickname }),
        ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        status: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return user
  }

  /**
   * 获取用户设置
   */
  async getSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    })

    if (!user) {
      throw new UserError(ErrorCodes.USER_NOT_FOUND, '用户不存在')
    }

    return user.settings
  }

  /**
   * 更新用户设置
   */
  async updateSettings(userId: string, input: UpdateSettingsInput) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    })

    if (!user) {
      throw new UserError(ErrorCodes.USER_NOT_FOUND, '用户不存在')
    }

    const currentSettings = (user.settings as Record<string, unknown>) || {}
    const newSettings = {
      ...currentSettings,
      ...input,
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { settings: newSettings },
    })

    return newSettings
  }

  /**
   * 修改密码
   */
  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new UserError(ErrorCodes.USER_NOT_FOUND, '用户不存在')
    }

    // 验证旧密码
    const isValidPassword = await bcrypt.compare(input.oldPassword, user.passwordHash)
    if (!isValidPassword) {
      throw new UserError(ErrorCodes.AUTH_INVALID_CREDENTIALS, '旧密码错误')
    }

    // 加密新密码
    const newPasswordHash = await bcrypt.hash(input.newPassword, 10)

    // 更新密码
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    })

    // 删除所有刷新令牌（强制重新登录）
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    })
  }

  /**
   * 注销账号
   */
  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new UserError(ErrorCodes.USER_NOT_FOUND, '用户不存在')
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      throw new UserError(ErrorCodes.AUTH_INVALID_CREDENTIALS, '密码错误')
    }

    // 软删除：更新状态为 DELETED
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'DELETED' },
    })

    // 删除所有刷新令牌
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    })
  }
}

/**
 * 用户错误类
 */
export class UserError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'UserError'
  }
}
