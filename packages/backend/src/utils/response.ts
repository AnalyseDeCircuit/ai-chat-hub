import type { ApiResponse, PaginationMeta } from '@ai-chat-hub/shared'
import { ErrorCodes, ErrorMessages, HttpStatus } from '@ai-chat-hub/shared'
import type { FastifyReply } from 'fastify'

/**
 * 成功响应
 */
export function success<T>(data: T, meta?: PaginationMeta): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(meta && { meta }),
  }
}

/**
 * 错误响应
 */
export function error(code: string, message?: string, details?: unknown): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message: message || ErrorMessages[code as keyof typeof ErrorMessages] || '未知错误',
      ...(details !== undefined && details !== null ? { details } : {}),
    },
  }
}

/**
 * 发送成功响应
 */
export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  statusCode: number = HttpStatus.OK,
  meta?: PaginationMeta
) {
  return reply.code(statusCode).send(success(data, meta))
}

/**
 * 发送错误响应
 */
export function sendError(
  reply: FastifyReply,
  code: string,
  statusCode: number = HttpStatus.BAD_REQUEST,
  message?: string,
  details?: unknown
) {
  return reply.code(statusCode).send(error(code, message, details))
}

/**
 * 发送未认证错误
 */
export function sendUnauthorized(reply: FastifyReply, message?: string) {
  return sendError(reply, ErrorCodes.AUTH_UNAUTHORIZED, HttpStatus.UNAUTHORIZED, message)
}

/**
 * 发送未找到错误
 */
export function sendNotFound(reply: FastifyReply, message?: string) {
  return sendError(reply, ErrorCodes.NOT_FOUND, HttpStatus.NOT_FOUND, message)
}

/**
 * 发送验证错误
 */
export function sendValidationError(reply: FastifyReply, details?: unknown) {
  return sendError(
    reply,
    ErrorCodes.VALIDATION_ERROR,
    HttpStatus.UNPROCESSABLE_ENTITY,
    undefined,
    details
  )
}

/**
 * 发送服务器错误
 */
export function sendInternalError(reply: FastifyReply, details?: unknown) {
  return sendError(reply, ErrorCodes.INTERNAL_ERROR, HttpStatus.INTERNAL_SERVER_ERROR, undefined, details)
}
