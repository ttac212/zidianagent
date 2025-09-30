/**
 * API速率限制工具
 * 防止恶意刷量攻击，保护系统资源
 */

import { NextRequest } from 'next/server'
import { ApiError, API_ERROR_CODES } from '@/lib/api/error-handler'
import { getRateLimiter } from './distributed-rate-limiter'

// 速率限制配置
export const RATE_LIMIT_CONFIG = {
  // 通用API限制 (requests per minute)
  GENERAL: { requests: 60, window: 60 * 1000, blockDuration: 60 * 1000 },
  
  // 聊天API限制 (更严格)
  CHAT: { requests: 30, window: 60 * 1000, blockDuration: 5 * 60 * 1000 },
  
  // 认证相关API限制 (非常严格)
  AUTH: { requests: 10, window: 60 * 1000, blockDuration: 15 * 60 * 1000 },
  
  // 管理员API限制
  ADMIN: { requests: 100, window: 60 * 1000, blockDuration: 60 * 1000 },
  
  // 文件上传限制
  UPLOAD: { requests: 20, window: 60 * 1000, blockDuration: 10 * 60 * 1000 },
  
  // 搜索API限制
  SEARCH: { requests: 50, window: 60 * 1000, blockDuration: 2 * 60 * 1000 },
  
  // IP级别的全局限制
  GLOBAL_IP: { requests: 200, window: 60 * 1000, blockDuration: 10 * 60 * 1000 },
  
  // 用户级别的限制
  USER: { requests: 300, window: 60 * 1000, blockDuration: 5 * 60 * 1000 }
}

// 限制类型
export type RateLimitType = keyof typeof RATE_LIMIT_CONFIG


// 使用分布式速率限制器替代内存存储
// 注意：改为懒加载避免模块级初始化



/**
 * 检查速率限制（使用分布式存储）
 */
export async function checkRateLimit(
  request: NextRequest, 
  type: RateLimitType,
  userId?: string
): Promise<{ allowed: boolean; remaining: number; resetTime: number; error?: ApiError }> {
  const config = RATE_LIMIT_CONFIG[type]

  // 懒加载：每次调用时获取rateLimiter实例
  const rateLimiter = getRateLimiter()

  // 使用分布式速率限制器
  const result = await rateLimiter.check(
    request,
    type,
    {
      maxRequests: config.requests,
      window: config.window,
      blockDuration: config.blockDuration || config.window // 使用blockDuration或window作为阻止时长
    },
    userId
  )
  
  if (!result.allowed) {
    return {
      allowed: false,
      remaining: result.remaining,
      resetTime: result.resetTime,
      error: new ApiError(
        API_ERROR_CODES.RATE_LIMITED,
        result.reason || 'API调用过于频繁',
        429,
        { 
          type, 
          resetTime: result.resetTime,
          identifier: userId ? 'user' : 'ip'
        }
      )
    }
  }
  
  return {
    allowed: true,
    remaining: result.remaining,
    resetTime: result.resetTime
  }
}

/**
 * 速率限制装饰器
 */
export function withRateLimit<T extends any[], R>(
  handler: (..._args: T) => Promise<R>,
  type: RateLimitType,
  getUserId?: (request: NextRequest) => Promise<string | undefined>
) {
  return async (request: NextRequest, ...restArgs: any[]): Promise<R> => {
    // 获取用户ID（如果提供了获取函数）
    let userId: string | undefined
    if (getUserId) {
      try {
        userId = await getUserId(request)
      } catch (_error) {
        // 忽略获取用户ID的错误，继续使用IP限制
        }
    }
    
    // 检查速率限制
    const limitCheck = await checkRateLimit(request, type, userId)
    
    if (!limitCheck.allowed && limitCheck.error) {
      throw limitCheck.error
    }
    
    // 执行原始处理函数，使用类型断言来解决泛型约束问题
    const result = await handler(...([request, ...restArgs] as T))
    
    return result
  }
}

/**
 * 多重限制检查 (同时检查多个限制类型)
 */
export async function checkMultipleRateLimits(
  request: NextRequest,
  types: RateLimitType[],
  userId?: string
): Promise<{ allowed: boolean; remaining: number; resetTime: number; error?: ApiError; failedType?: RateLimitType }> {
  // 并行检查所有限制类型
  const results = await Promise.all(
    types.map(async type => ({
      type,
      result: await checkRateLimit(request, type, userId)
    }))
  )
  
  // 检查是否有被拒绝的请求
  for (const { type, result } of results) {
    if (!result.allowed) {
      return { ...result, failedType: type }
    }
  }
  
  // 返回最严格的限制信息（使用缓存的结果）
  const minRemaining = Math.min(...results.map(r => r.result.remaining))
  const maxResetTime = Math.max(...results.map(r => r.result.resetTime))
  
  return {
    allowed: true,
    remaining: minRemaining,
    resetTime: maxResetTime
  }
}

/**
 * 获取限制状态（用于监控）
 */
export async function getRateLimitStats(): Promise<{
  totalKeys: number
  activeBlocks: number
  memoryUsage: number
}> {
  // 在分布式架构中，统计信息需要从存储后端获取
  // 目前返回默认值，实际应用应该使用监控服务
  return {
    totalKeys: 0,  // 需要从分布式存储获取
    activeBlocks: 0,  // 需要从分布式存储获取
    memoryUsage: 0  // 在分布式架构中不适用
  }
}

/**
 * 手动清除特定键的限制（管理员功能）
 */
export async function clearRateLimit(identifier: string, type: RateLimitType): Promise<boolean> {
  // 创建一个临时请求对象来生成键
  const dummyRequest = new Request('http://localhost', {
    headers: new Headers()
  })

  // 懒加载：获取rateLimiter实例
  const rateLimiter = getRateLimiter({ skipProductionCheck: true })

  try {
    await rateLimiter.reset(dummyRequest as any, type, identifier.startsWith('user:') ? identifier.replace('user:', '') : undefined)
    return true
  } catch (_error) {
    // Failed to clear rate limit
    return false
  }
}

/**
 * 预设的速率限制中间件
 */
export const RateLimitMiddleware = {
  chat: <T extends any[], R>(handler: (..._args: T) => Promise<R>) =>
    withRateLimit(handler, 'CHAT'),

  auth: <T extends any[], R>(handler: (..._args: T) => Promise<R>) =>
    withRateLimit(handler, 'AUTH'),

  admin: <T extends any[], R>(handler: (..._args: T) => Promise<R>) =>
    withRateLimit(handler, 'ADMIN'),

  general: <T extends any[], R>(handler: (..._args: T) => Promise<R>) =>
    withRateLimit(handler, 'GENERAL')
}
