import { PrismaClient } from '@prisma/client'
import { ErrorCodes } from '@ai-chat-hub/shared'
import { generateRandomString } from '@ai-chat-hub/shared'

export class SessionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 获取用户会话列表（支持搜索）
   */
  async list(userId: string, page = 1, limit = 20, archived = false, search?: string) {
    const skip = (page - 1) * limit

    const where: any = {
      userId,
      archivedAt: archived ? { not: null } : null,
    }

    // 添加搜索条件
    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive', // 不区分大小写
      }
    }

    const [sessions, total] = await Promise.all([
      this.prisma.session.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.session.count({
        where,
      }),
    ])

    return {
      sessions,
      meta: {
        page,
        limit,
        total,
        hasMore: skip + sessions.length < total,
      },
    }
  }

  /**
   * 创建会话
   */
  async create(userId: string, title?: string) {
    return this.prisma.session.create({
      data: {
        userId,
        title,
      },
    })
  }

  /**
   * 获取会话详情
   */
  async getById(sessionId: string, userId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      throw new SessionError(ErrorCodes.SESSION_NOT_FOUND, '会话不存在')
    }

    if (session.userId !== userId && !session.isShared) {
      throw new SessionError(ErrorCodes.SESSION_ACCESS_DENIED, '无权访问此会话')
    }

    return session
  }

  /**
   * 更新会话
   */
  async update(sessionId: string, userId: string, data: { title?: string }) {
    await this.checkOwnership(sessionId, userId)

    return this.prisma.session.update({
      where: { id: sessionId },
      data,
    })
  }

  /**
   * 删除会话
   */
  async delete(sessionId: string, userId: string) {
    await this.checkOwnership(sessionId, userId)

    await this.prisma.session.delete({
      where: { id: sessionId },
    })
  }

  /**
   * 归档会话
   */
  async archive(sessionId: string, userId: string) {
    await this.checkOwnership(sessionId, userId)

    return this.prisma.session.update({
      where: { id: sessionId },
      data: { archivedAt: new Date() },
    })
  }

  /**
   * 取消归档
   */
  async unarchive(sessionId: string, userId: string) {
    await this.checkOwnership(sessionId, userId)

    return this.prisma.session.update({
      where: { id: sessionId },
      data: { archivedAt: null },
    })
  }

  /**
   * 生成分享链接
   */
  async share(sessionId: string, userId: string) {
    await this.checkOwnership(sessionId, userId)

    const shareCode = generateRandomString(12)

    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        isShared: true,
        shareCode,
      },
    })
  }

  /**
   * 取消分享
   */
  async unshare(sessionId: string, userId: string) {
    await this.checkOwnership(sessionId, userId)

    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        isShared: false,
        shareCode: null,
      },
    })
  }

  /**
   * 通过分享码获取会话
   */
  async getByShareCode(shareCode: string) {
    const session = await this.prisma.session.findUnique({
      where: { shareCode },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!session || !session.isShared) {
      throw new SessionError(ErrorCodes.SESSION_NOT_FOUND, '会话不存在或未分享')
    }

    return session
  }

  /**
   * 检查会话所有权
   */
  private async checkOwnership(sessionId: string, userId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    })

    if (!session) {
      throw new SessionError(ErrorCodes.SESSION_NOT_FOUND, '会话不存在')
    }

    if (session.userId !== userId) {
      throw new SessionError(ErrorCodes.SESSION_ACCESS_DENIED, '无权访问此会话')
    }
  }
}

export class SessionError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'SessionError'
  }
}
