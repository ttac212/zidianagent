/**
 * 统一的 HTTP 响应构造器
 *
 * Linus: "这是过度抽象，但已经有20个文件依赖它了"
 * 保留它是为了保持API响应格式的一致性
 *
 * 如果你是新代码，直接用 NextResponse.json()
 */

import { NextResponse } from 'next/server'
import * as dt from '@/lib/utils/date-toolkit'

/**
 * 标准化的 API 响应结构
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  details?: unknown
  timestamp?: string
}

/**
 * 分页元数据
 */
export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

/**
 * 分页响应结构
 */
export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  meta: PaginationMeta
}

/**
 * HTTP 响应选项
 */
export interface ResponseOptions {
  status?: number
  headers?: HeadersInit
  details?: unknown
}

/**
 * HTTP 响应工具类
 * 提供统一的响应构造方法
 */
export class HttpResponse {
  /**
   * 成功响应
   */
  static success<T = any>(
    data: T,
    init?: ResponseOptions
  ): NextResponse<ApiResponse<T>> {
    const response: ApiResponse<T> = {
      success: true,
      data,
      timestamp: dt.toISO()
    }

    return NextResponse.json(response, {
      status: init?.status || 200,
      headers: init?.headers
    })
  }

  /**
   * 错误响应
   */
  static error(
    message: string,
    options?: ResponseOptions & { details?: unknown }
  ): NextResponse<ApiResponse> {
    const response: ApiResponse = {
      success: false,
      error: message,
      details: options?.details,
      timestamp: dt.toISO()
    }

    return NextResponse.json(response, {
      status: options?.status || 400,
      headers: options?.headers
    })
  }

  /**
   * 分页响应
   */
  static paginated<T = any>(
    items: T[],
    meta: PaginationMeta,
    init?: ResponseOptions
  ): NextResponse<PaginatedResponse<T>> {
    const response: PaginatedResponse<T> = {
      success: true,
      data: items,
      meta,
      timestamp: dt.toISO()
    }

    return NextResponse.json(response, {
      status: init?.status || 200,
      headers: init?.headers
    })
  }

  /**
   * 未找到响应
   */
  static notFound(
    message: string = 'Resource not found'
  ): NextResponse<ApiResponse> {
    return HttpResponse.error(message, { status: 404 })
  }

  /**
   * 未授权响应
   */
  static unauthorized(
    message: string = 'Unauthorized'
  ): NextResponse<ApiResponse> {
    return HttpResponse.error(message, { status: 401 })
  }

  /**
   * 禁止访问响应
   */
  static forbidden(
    message: string = 'Forbidden'
  ): NextResponse<ApiResponse> {
    return HttpResponse.error(message, { status: 403 })
  }

  /**
   * 验证错误响应
   */
  static validationError(
    message: string,
    errors?: Record<string, string[]>
  ): NextResponse<ApiResponse> {
    return HttpResponse.error(message, {
      status: 422,
      details: errors
    })
  }

  /**
   * 服务器错误响应
   */
  static serverError(
    message: string = 'Internal server error',
    details?: unknown
  ): NextResponse<ApiResponse> {
    // 生产环境不暴露详细错误信息
    const safeDetails = process.env.NODE_ENV === 'development' ? details : undefined

    return HttpResponse.error(message, {
      status: 500,
      details: safeDetails
    })
  }

  /**
   * 速率限制响应
   */
  static tooManyRequests(
    message: string = 'Too many requests',
    retryAfter?: number
  ): NextResponse<ApiResponse> {
    const headers = retryAfter
      ? { 'Retry-After': retryAfter.toString() }
      : undefined

    return HttpResponse.error(message, {
      status: 429,
      headers
    })
  }

  /**
   * 无内容响应
   */
  static noContent(): NextResponse {
    return new NextResponse(null, { status: 204 })
  }

  /**
   * 重定向响应
   */
  static redirect(url: string, permanent: boolean = false): NextResponse {
    return NextResponse.redirect(url, {
      status: permanent ? 301 : 302
    })
  }
}

/**
 * 便捷的导出函数
 */
export const success = HttpResponse.success
export const error = HttpResponse.error
export const paginated = HttpResponse.paginated
export const notFound = HttpResponse.notFound
export const unauthorized = HttpResponse.unauthorized
export const forbidden = HttpResponse.forbidden
export const validationError = HttpResponse.validationError
export const serverError = HttpResponse.serverError
export const tooManyRequests = HttpResponse.tooManyRequests
export const noContent = HttpResponse.noContent
export const redirect = HttpResponse.redirect

/**
 * 类型守卫：检查是否为成功响应
 */
export function isSuccessResponse<T = any>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { data: T } {
  return response.success === true && 'data' in response
}

/**
 * 类型守卫：检查是否为错误响应
 */
export function isErrorResponse(
  response: ApiResponse
): response is ApiResponse & { error: string } {
  return response.success === false && 'error' in response
}

/**
 * 类型守卫：检查是否为分页响应
 */
export function isPaginatedResponse<T = any>(
  response: ApiResponse<T[]>
): response is PaginatedResponse<T> {
  return (
    response.success === true &&
    'data' in response &&
    Array.isArray(response.data) &&
    'meta' in response
  )
}

/**
 * 从 fetch Response 解析 API 响应
 */
export async function parseApiResponse<T = any>(
  response: Response
): Promise<ApiResponse<T>> {
  try {
    const data = await response.json()

    // 如果响应已经是标准格式，直接返回
    if ('success' in data) {
      return data as ApiResponse<T>
    }

    // 否则包装成标准格式
    if (response.ok) {
      return {
        success: true,
        data,
        timestamp: dt.toISO()
      }
    } else {
      return {
        success: false,
        error: data.message || data.error || `HTTP ${response.status}`,
        details: data,
        timestamp: dt.toISO()
      }
    }
  } catch (err) {
    return {
      success: false,
      error: 'Failed to parse response',
      details: err,
      timestamp: dt.toISO()
    }
  }
}

/**
 * 计算分页元数据
 */
export function calculatePaginationMeta(
  page: number,
  pageSize: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / pageSize)

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  }
}

/**
 * 从查询参数中提取分页信息
 */
export function extractPaginationParams(
  searchParams: URLSearchParams,
  defaults = { page: 1, pageSize: 20 }
): { page: number; pageSize: number } {
  const page = Math.max(1, Number(searchParams.get('page')) || defaults.page)
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get('pageSize')) || defaults.pageSize)
  )

  return { page, pageSize }
}
