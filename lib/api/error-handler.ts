/**
 * 统一API错误处理工具
 * 提供一致的错误响应格式和安全的错误信息处理
 */

import { NextResponse } from 'next/server'
import '@/lib/config/env-init'
import * as dt from '@/lib/utils/date-toolkit'

// 错误类型定义
export const API_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES]

// 统一错误响应格式
export interface ApiErrorResponse {
  success: false
  error: {
    code: ApiErrorCode
    message: string
    details?: any
    timestamp: string
    requestId?: string
  }
}

// 统一成功响应格式
export interface ApiSuccessResponse<T = any> {
  success: true
  data: T
  message?: string
  metadata?: {
    total?: number
    page?: number
    limit?: number
    [key: string]: any
  }
}

// API错误类
export class ApiError extends Error {
  public code: ApiErrorCode
  public statusCode: number
  public details?: any

  constructor(code: ApiErrorCode, message: string, statusCode: number = 500, details?: any) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

// 预定义常用错误
export const CommonErrors = {
  UNAUTHORIZED: new ApiError(API_ERROR_CODES.UNAUTHORIZED, '未认证，请先登录', 401),
  FORBIDDEN: new ApiError(API_ERROR_CODES.FORBIDDEN, '权限不足，无法访问该资源', 403),
  NOT_FOUND: new ApiError(API_ERROR_CODES.NOT_FOUND, '请求的资源不存在', 404),
  VALIDATION_FAILED: new ApiError(API_ERROR_CODES.VALIDATION_FAILED, '输入数据验证失败', 400),
  RATE_LIMITED: new ApiError(API_ERROR_CODES.RATE_LIMITED, '请求过于频繁，请稍后重试', 429),
  INTERNAL_ERROR: new ApiError(API_ERROR_CODES.INTERNAL_ERROR, '服务器内部错误', 500)
}

/**
 * 统一错误响应生成器
 */
export function createErrorResponse(
  error: ApiError | Error | string,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  let apiError: ApiError

  if (error instanceof ApiError) {
    apiError = error
  } else if (error instanceof Error) {
    // 根据错误类型智能分类
    apiError = classifyError(error)
  } else {
    // 字符串错误
    apiError = new ApiError(API_ERROR_CODES.INTERNAL_ERROR, error)
  }

  // 生产环境下隐藏敏感错误信息
  const isProduction = process.env.NODE_ENV === 'production'
  const shouldHideDetails = isProduction && apiError.statusCode >= 500

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: apiError.code,
      message: shouldHideDetails ? '服务暂时不可用，请稍后重试' : apiError.message,
      details: shouldHideDetails ? undefined : apiError.details,
      timestamp: dt.toISO(),
      requestId
    }
  }

  // 记录错误日志（仅服务器错误）
  if (apiError.statusCode >= 500) {
    }

  return NextResponse.json(response, { status: apiError.statusCode })
}

/**
 * 统一成功响应生成器
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  metadata?: any
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    message,
    metadata
  }

  return NextResponse.json(response)
}

/**
 * 智能错误分类
 */
function classifyError(error: Error): ApiError {
  const message = error.message.toLowerCase()

  // Prisma数据库错误
  if (error.name === 'PrismaClientKnownRequestError') {
    return new ApiError(API_ERROR_CODES.DATABASE_ERROR, '数据库操作失败', 500, { originalError: error.message })
  }

  // 验证错误
  if (message.includes('validation') || message.includes('invalid')) {
    return new ApiError(API_ERROR_CODES.VALIDATION_FAILED, error.message, 400)
  }

  // 权限错误
  if (message.includes('unauthorized') || message.includes('permission')) {
    return new ApiError(API_ERROR_CODES.FORBIDDEN, error.message, 403)
  }

  // 网络/外部服务错误
  if (message.includes('fetch') || message.includes('network') || message.includes('timeout')) {
    return new ApiError(API_ERROR_CODES.EXTERNAL_SERVICE_ERROR, '外部服务调用失败', 502, { originalError: error.message })
  }

  // 默认服务器错误
  return new ApiError(API_ERROR_CODES.INTERNAL_ERROR, error.message, 500)
}

/**
 * 中间件工具：统一认证检查
 */
export function requireAuth(token: any, role?: string): ApiError | null {
  if (!token?.sub) {
    return CommonErrors.UNAUTHORIZED
  }

  if (role && (token as any).role !== role) {
    return CommonErrors.FORBIDDEN
  }

  return null
}

/**
 * 中间件工具：商家访问权限检查
 * 检查用户是否有权访问指定商家的数据
 */
export async function checkMerchantAccess(_userId: string, _merchantId: string): Promise<boolean> {
  // FIXME: 当前简化实现，允许所有登录用户访问
  // TODO: 实现真实的商家-用户关联检查
  // 1. 检查用户是否是商家所有者
  // 2. 检查用户是否在商家的协作者列表中
  // 3. ADMIN 角色可以访问所有商家
  
  // const prisma = require('@/lib/prisma').prisma
  // const merchant = await prisma.merchant.findUnique({
  //   where: { id: merchantId },
  //   include: { owner: true, collaborators: true }
  // })
  // 
  // if (!merchant) return false
  // if (merchant.ownerId === userId) return true
  // if (merchant.collaborators.some(c => c.userId === userId)) return true
  
  return true  // 临时：允许所有登录用户
}

/**
 * 中间件工具：输入验证
 */
export function validateInput(data: any, required: string[]): ApiError | null {
  const missing = required.filter(field => !data[field])
  
  if (missing.length > 0) {
    return new ApiError(
      API_ERROR_CODES.VALIDATION_FAILED,
      `缺少必填字段: ${missing.join(', ')}`,
      400,
      { missingFields: missing }
    )
  }

  return null
}

/**
 * 请求ID生成器（用于追踪）
 */
export function generateRequestId(): string {
  return `req_${dt.timestamp()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 错误处理装饰器（用于包装API处理函数）
 */
export function withErrorHandler<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse<R | ApiErrorResponse>>
) {
  return async (...args: T): Promise<NextResponse<R | ApiErrorResponse>> => {
    const requestId = generateRequestId()
    
    try {
      return await handler(...args)
    } catch (error) {
      return createErrorResponse(error as Error, requestId)
    }
  }
}