/**
 * 简单的内存缓存工具
 * 用于缓存统计查询结果，减少数据库压力
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>()
  private cleanupTimer?: NodeJS.Timeout

  constructor(
    private defaultTTL = 60000, // 默认60秒
    private maxSize = 100        // 最大缓存条目数
  ) {
    // 每分钟清理过期缓存
    this.startCleanup()
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // 检查是否过期
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    })
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys())
    }
  }

  /**
   * 启动定期清理
   */
  private startCleanup() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.timestamp + entry.ttl) {
          this.cache.delete(key)
        }
      }
    }, 60000) // 每分钟清理一次
  }

  /**
   * 停止清理（用于测试或关闭）
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
    this.clear()
  }
}

// 创建缓存实例
const statsCache = new SimpleCache(30000, 50)  // 30秒TTL，最多50条
const queryCache = new SimpleCache(60000, 100) // 60秒TTL，最多100条

/**
 * 带缓存的查询包装器
 */
export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // 尝试从缓存获取
  const cached = queryCache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // 执行查询
  const result = await queryFn()
  
  // 存入缓存
  queryCache.set(key, result, ttl)
  
  return result
}

/**
 * 使用示例：
 * 
 * const stats = await cachedQuery(
 *   `user-stats-${userId}-${days}`,
 *   () => prisma.usageStats.findMany({ ... }),
 *   30000 // 30秒缓存
 * )
 */

export { SimpleCache, statsCache, queryCache }