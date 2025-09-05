/**
 * API速率限制工具
 * 防止恶意刷量攻击，保护系统资源
 */

import { NextRequest } from 'next/server'
import { createHash } from 'crypto'
import { ApiError, ApiErrorCode } from '@/lib/api/error-handler'

// 速率限制配置
export const RATE_LIMIT_CONFIG = {
  // 通用API限制 (requests per minute)
  GENERAL: { requests: 60, window: 60 * 1000 },
  
  // 聊天API限制 (更严格)
  CHAT: { requests: 30, window: 60 * 1000 },
  
  // 认证相关API限制 (非常严格)
  AUTH: { requests: 10, window: 60 * 1000 },
  
  // 管理员API限制
  ADMIN: { requests: 100, window: 60 * 1000 },
  
  // 文件上传限制
  UPLOAD: { requests: 20, window: 60 * 1000 },
  
  // 搜索API限制
  SEARCH: { requests: 50, window: 60 * 1000 },
  
  // IP级别的全局限制
  GLOBAL_IP: { requests: 200, window: 60 * 1000 },
  
  // 用户级别的限制
  USER: { requests: 300, window: 60 * 1000 }
}

// 限制类型
export type RateLimitType = keyof typeof RATE_LIMIT_CONFIG

// 请求记录接口
interface RequestRecord {
  count: number
  firstRequest: number
  lastRequest: number
  blocked: boolean
  blockedUntil?: number
}

// 内存存储（生产环境建议使用Redis）
const requestCounts = new Map<string, RequestRecord>()

// 清理过期记录的定时任务
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of requestCounts.entries()) {
    // 清理超过5分钟的记录
    if (now - record.lastRequest > 5 * 60 * 1000) {
      requestCounts.delete(key)
    }
  }
}, 2 * 60 * 1000) // 每2分钟清理一次

/**
 * 生成限制键
 */
function generateLimitKey(identifier: string, type: RateLimitType): string {
  // 对标识符进行哈希处理以保护隐私
  const hash = createHash('sha256').update(identifier).digest('hex').substring(0, 16)
  return `ratelimit:${type}:${hash}`
}

/**
 * 获取客户端标识符
 */
function getClientIdentifier(request: NextRequest, userId?: string): string {
  // 优先使用用户ID，其次使用IP
  if (userId) return `user:${userId}`
  
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip') 
  const ip = forwarded?.split(',')[0] || realIP || 'unknown'
  
  return `ip:${ip}`
}

/**
 * 检查速率限制
 */
export function checkRateLimit(
  request: NextRequest, 
  type: RateLimitType,
  userId?: string
): { allowed: boolean; remaining: number; resetTime: number; error?: ApiError } {
  const config = RATE_LIMIT_CONFIG[type]
  const identifier = getClientIdentifier(request, userId)
  const key = generateLimitKey(identifier, type)
  const now = Date.now()
  
  // 获取或创建请求记录
  let record = requestCounts.get(key)
  
  if (!record) {
    // 首次请求
    record = {
      count: 1,
      firstRequest: now,
      lastRequest: now,
      blocked: false
    }
    requestCounts.set(key, record)
    return { 
      allowed: true, 
      remaining: config.requests - 1,
      resetTime: now + config.window
    }
  }
  
  // 检查是否在阻止期间
  if (record.blocked && record.blockedUntil && now < record.blockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.blockedUntil,
      error: new ApiError(
        ApiErrorCode.RATE_LIMITED,
        `API调用过于频繁，请在${Math.ceil((record.blockedUntil - now) / 1000)}秒后重试`,
        429,
        { 
          type, 
          resetTime: record.blockedUntil,
          identifier: identifier.startsWith('user:') ? 'user' : 'ip'
        }
      )
    }
  }
  
  // 检查时间窗口
  if (now - record.firstRequest > config.window) {
    // 重置窗口
    record = {
      count: 1,
      firstRequest: now,
      lastRequest: now,
      blocked: false
    }
    requestCounts.set(key, record)
    return { 
      allowed: true, 
      remaining: config.requests - 1,
      resetTime: now + config.window
    }
  }
  
  // 检查是否超过限制
  if (record.count >= config.requests) {
    // 超过限制，阻止请求
    record.blocked = true
    record.blockedUntil = now + config.window
    record.lastRequest = now
    requestCounts.set(key, record)
    
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.blockedUntil,
      error: new ApiError(
        ApiErrorCode.RATE_LIMITED,
        `API调用频率超限，请在${Math.ceil(config.window / 1000)}秒后重试`,
        429,
        { 
          type, 
          limit: config.requests,
          window: config.window,
          identifier: identifier.startsWith('user:') ? 'user' : 'ip'
        }
      )
    }
  }
  
  // 更新记录
  record.count++
  record.lastRequest = now
  requestCounts.set(key, record)
  
  return { 
    allowed: true, 
    remaining: config.requests - record.count,
    resetTime: record.firstRequest + config.window
  }
}

/**
 * 速率限制装饰器
 */
export function withRateLimit<T extends any[], R>(
  handler: (...args: T) => Promise<R>,
  type: RateLimitType,
  getUserId?: (request: NextRequest) => Promise<string | undefined>
) {
  return async (request: NextRequest, ...restArgs: any[]): Promise<R> => {
    // 获取用户ID（如果提供了获取函数）
    let userId: string | undefined
    if (getUserId) {
      try {
        userId = await getUserId(request)
      } catch (error) {
        // 忽略获取用户ID的错误，继续使用IP限制
        console.warn('[Rate Limiter] Failed to get user ID:', error)
      }
    }
    
    // 检查速率限制
    const limitCheck = checkRateLimit(request, type, userId)
    
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
export function checkMultipleRateLimits(
  request: NextRequest,
  types: RateLimitType[],
  userId?: string
): { allowed: boolean; remaining: number; resetTime: number; error?: ApiError; failedType?: RateLimitType } {
  for (const type of types) {
    const result = checkRateLimit(request, type, userId)
    if (!result.allowed) {
      return { ...result, failedType: type }
    }
  }
  
  // 返回最严格的限制信息
  const results = types.map(type => checkRateLimit(request, type, userId))
  const minRemaining = Math.min(...results.map(r => r.remaining))
  const maxResetTime = Math.max(...results.map(r => r.resetTime))
  
  return {
    allowed: true,
    remaining: minRemaining,
    resetTime: maxResetTime
  }
}

/**
 * 获取限制状态（用于监控）
 */
export function getRateLimitStats(): {
  totalKeys: number
  activeBlocks: number
  memoryUsage: number
} {
  const now = Date.now()
  let activeBlocks = 0
  
  for (const record of requestCounts.values()) {
    if (record.blocked && record.blockedUntil && now < record.blockedUntil) {
      activeBlocks++
    }
  }
  
  return {
    totalKeys: requestCounts.size,
    activeBlocks,
    memoryUsage: JSON.stringify([...requestCounts.entries()]).length
  }
}

/**
 * 手动清除特定键的限制（管理员功能）
 */
export function clearRateLimit(identifier: string, type: RateLimitType): boolean {
  const key = generateLimitKey(identifier, type)
  return requestCounts.delete(key)
}

/**
 * 预设的速率限制中间件
 */
export const RateLimitMiddleware = {
  chat: <T extends any[], R>(handler: (...args: T) => Promise<R>) => 
    withRateLimit(handler, 'CHAT'),
    
  auth: <T extends any[], R>(handler: (...args: T) => Promise<R>) =>
    withRateLimit(handler, 'AUTH'),
    
  admin: <T extends any[], R>(handler: (...args: T) => Promise<R>) =>
    withRateLimit(handler, 'ADMIN'),
    
  general: <T extends any[], R>(handler: (...args: T) => Promise<R>) =>
    withRateLimit(handler, 'GENERAL')
}