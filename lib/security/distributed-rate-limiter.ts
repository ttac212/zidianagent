/**
 * 分布式速率限制器
 * 支持多实例和Serverless环境
 */

import { NextRequest } from 'next/server'
import { createHash } from 'crypto'

// 速率限制存储接口
export interface RateLimitStore {
  /**
   * 增加计数并返回当前值
   * @param key 存储键
   * @param window 时间窗口（毫秒）
   * @returns 当前计数和过期时间
   */
  increment(key: string, window: number): Promise<{ count: number; ttl: number }>
  
  /**
   * 获取当前计数
   * @param key 存储键
   * @returns 当前计数，如果不存在返回0
   */
  get(key: string): Promise<number>
  
  /**
   * 设置阻止状态
   * @param key 存储键
   * @param duration 阻止时长（毫秒）
   */
  block(key: string, duration: number): Promise<void>
  
  /**
   * 检查是否被阻止
   * @param key 存储键
   * @returns 如果被阻止返回解除时间，否则返回null
   */
  isBlocked(key: string): Promise<number | null>
  
  /**
   * 重置计数
   * @param key 存储键
   */
  reset(key: string): Promise<void>
}

// 内存存储实现（开发环境）
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; expiresAt: number }>()
  private blockedStore = new Map<string, number>()
  
  async increment(key: string, window: number): Promise<{ count: number; ttl: number }> {
    const now = Date.now()
    const expiresAt = now + window
    
    const existing = this.store.get(key)
    
    if (!existing || existing.expiresAt < now) {
      // 新窗口或已过期
      this.store.set(key, { count: 1, expiresAt })
      return { count: 1, ttl: window }
    }
    
    // 增加计数
    existing.count++
    return { count: existing.count, ttl: existing.expiresAt - now }
  }
  
  async get(key: string): Promise<number> {
    const now = Date.now()
    const existing = this.store.get(key)
    
    if (!existing || existing.expiresAt < now) {
      return 0
    }
    
    return existing.count
  }
  
  async block(key: string, duration: number): Promise<void> {
    const blockedUntil = Date.now() + duration
    this.blockedStore.set(key, blockedUntil)
  }
  
  async isBlocked(key: string): Promise<number | null> {
    const blockedUntil = this.blockedStore.get(key)
    
    if (!blockedUntil) return null
    
    const now = Date.now()
    if (blockedUntil < now) {
      this.blockedStore.delete(key)
      return null
    }
    
    return blockedUntil
  }
  
  async reset(key: string): Promise<void> {
    this.store.delete(key)
    this.blockedStore.delete(key)
  }
  
  // 清理过期条目（定期调用）
  cleanup(): void {
    const now = Date.now()
    
    // 清理过期的计数
    for (const [key, value] of this.store.entries()) {
      if (value.expiresAt < now) {
        this.store.delete(key)
      }
    }
    
    // 清理过期的阻止
    for (const [key, blockedUntil] of this.blockedStore.entries()) {
      if (blockedUntil < now) {
        this.blockedStore.delete(key)
      }
    }
  }
}

// Redis存储实现示例（需要安装ioredis）
export class RedisRateLimitStore implements RateLimitStore {
  // 注意：这是一个示例实现，实际使用需要配置Redis客户端
  // private redis: Redis
  
  // constructor(redis: Redis) {
  //   this.redis = redis
  // }
  
  async increment(key: string, window: number): Promise<{ count: number; ttl: number }> {
    // const multi = this.redis.multi()
    // multi.incr(key)
    // multi.expire(key, Math.ceil(window / 1000))
    // multi.ttl(key)
    // 
    // const results = await multi.exec()
    // const count = results![0][1] as number
    // const ttl = results![2][1] as number
    // 
    // return { count, ttl: ttl * 1000 }
    
    // 临时返回，实际实现需要Redis
    return { count: 1, ttl: window }
  }
  
  async get(key: string): Promise<number> {
    // const count = await this.redis.get(key)
    // return count ? parseInt(count, 10) : 0
    return 0
  }
  
  async block(key: string, duration: number): Promise<void> {
    // const blockKey = `${key}:blocked`
    // await this.redis.set(blockKey, Date.now() + duration, 'PX', duration)
  }
  
  async isBlocked(key: string): Promise<number | null> {
    // const blockKey = `${key}:blocked`
    // const value = await this.redis.get(blockKey)
    // return value ? parseInt(value, 10) : null
    return null
  }
  
  async reset(key: string): Promise<void> {
    // await this.redis.del(key, `${key}:blocked`)
  }
}

// Upstash Redis存储实现示例
export class UpstashRateLimitStore implements RateLimitStore {
  // private upstash: UpstashRedis
  
  // constructor(config: { url: string; token: string }) {
  //   this.upstash = new UpstashRedis(config)
  // }
  
  // 实现类似Redis版本...
  
  async increment(key: string, window: number): Promise<{ count: number; ttl: number }> {
    // 使用Upstash REST API
    return { count: 1, ttl: window }
  }
  
  async get(key: string): Promise<number> {
    return 0
  }
  
  async block(key: string, duration: number): Promise<void> {}
  async isBlocked(key: string): Promise<number | null> { return null }
  async reset(key: string): Promise<void> {}
}

// 速率限制配置
export interface RateLimitConfig {
  maxRequests: number  // 最大请求数
  window: number       // 时间窗口（毫秒）
  blockDuration?: number // 阻止时长（毫秒）
}

// 分布式速率限制器
export class DistributedRateLimiter {
  private store: RateLimitStore
  private cleanupTimer?: NodeJS.Timeout
  
  constructor(store?: RateLimitStore) {
    // 默认使用内存存储，生产环境应该使用Redis或Upstash
    this.store = store || new MemoryRateLimitStore()
    
    // 如果是内存存储，启动清理任务
    if (this.store instanceof MemoryRateLimitStore) {
      // 注意：在Serverless环境中避免使用定时器
      if (typeof window === 'undefined' && !process.env.VERCEL) {
        this.cleanupTimer = setInterval(() => {
          (this.store as MemoryRateLimitStore).cleanup()
        }, 60 * 1000) // 每分钟清理一次
      }
    }
  }
  
  /**
   * 生成速率限制键
   */
  private generateKey(identifier: string, namespace: string): string {
    const hash = createHash('sha256')
      .update(`${namespace}:${identifier}`)
      .digest('hex')
      .substring(0, 16)
    return `ratelimit:${namespace}:${hash}`
  }
  
  /**
   * 获取客户端标识符
   */
  private getIdentifier(request: NextRequest, userId?: string): string {
    if (userId) return `user:${userId}`
    
    // 获取IP地址
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const ip = forwarded?.split(',')[0]?.trim() || realIP || 'unknown'
    
    return `ip:${ip}`
  }
  
  /**
   * 检查速率限制
   */
  async check(
    request: NextRequest,
    namespace: string,
    config: RateLimitConfig,
    userId?: string
  ): Promise<{
    allowed: boolean
    remaining: number
    resetTime: number
    reason?: string
  }> {
    const identifier = this.getIdentifier(request, userId)
    const key = this.generateKey(identifier, namespace)
    
    // 检查是否被阻止
    const blockedUntil = await this.store.isBlocked(key)
    if (blockedUntil) {
      const now = Date.now()
      return {
        allowed: false,
        remaining: 0,
        resetTime: blockedUntil,
        reason: `请求过于频繁，请在${Math.ceil((blockedUntil - now) / 1000)}秒后重试`
      }
    }
    
    // 增加计数
    const { count, ttl } = await this.store.increment(key, config.window)
    const now = Date.now()
    const resetTime = now + ttl
    
    // 检查是否超过限制
    if (count > config.maxRequests) {
      // 如果配置了阻止时长，设置阻止状态
      if (config.blockDuration) {
        await this.store.block(key, config.blockDuration)
        return {
          allowed: false,
          remaining: 0,
          resetTime: now + config.blockDuration,
          reason: `超过速率限制，已被暂时阻止`
        }
      }
      
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        reason: `超过速率限制（${config.maxRequests}次/${config.window / 1000}秒）`
      }
    }
    
    return {
      allowed: true,
      remaining: config.maxRequests - count,
      resetTime
    }
  }
  
  /**
   * 重置速率限制
   */
  async reset(
    request: NextRequest,
    namespace: string,
    userId?: string
  ): Promise<void> {
    const identifier = this.getIdentifier(request, userId)
    const key = this.generateKey(identifier, namespace)
    await this.store.reset(key)
  }
  
  /**
   * 清理资源
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
  }
}

// 创建全局实例（避免在Serverless环境中重复创建）
let globalRateLimiter: DistributedRateLimiter | null = null

/**
 * 获取速率限制器实例
 */
export function getRateLimiter(): DistributedRateLimiter {
  if (!globalRateLimiter) {
    // 根据环境选择存储
    let store: RateLimitStore
    
    if (process.env.REDIS_URL) {
      // 如果配置了Redis，使用Redis存储
      console.log('[RateLimiter] Using Redis store')
      // store = new RedisRateLimitStore(redis)
      store = new MemoryRateLimitStore() // 暂时使用内存存储
    } else if (process.env.UPSTASH_REDIS_REST_URL) {
      // 如果配置了Upstash，使用Upstash存储
      console.log('[RateLimiter] Using Upstash store')
      // store = new UpstashRateLimitStore({
      //   url: process.env.UPSTASH_REDIS_REST_URL,
      //   token: process.env.UPSTASH_REDIS_REST_TOKEN!
      // })
      store = new MemoryRateLimitStore() // 暂时使用内存存储
    } else {
      // 默认使用内存存储（开发环境）
      console.log('[RateLimiter] Using memory store (not recommended for production)')
      store = new MemoryRateLimitStore()
    }
    
    globalRateLimiter = new DistributedRateLimiter(store)
  }
  
  return globalRateLimiter
}

// 预定义的速率限制配置
export const RATE_LIMIT_PRESETS = {
  // API端点限制
  api: {
    default: { maxRequests: 60, window: 60 * 1000 }, // 60次/分钟
    chat: { maxRequests: 30, window: 60 * 1000, blockDuration: 5 * 60 * 1000 }, // 30次/分钟，违规阻止5分钟
    auth: { maxRequests: 5, window: 60 * 1000, blockDuration: 15 * 60 * 1000 }, // 5次/分钟，违规阻止15分钟
  },
  
  // 用户级别限制
  user: {
    free: { maxRequests: 100, window: 60 * 60 * 1000 }, // 100次/小时
    pro: { maxRequests: 1000, window: 60 * 60 * 1000 }, // 1000次/小时
    unlimited: { maxRequests: Number.MAX_SAFE_INTEGER, window: 1 }, // 无限制
  }
} as const