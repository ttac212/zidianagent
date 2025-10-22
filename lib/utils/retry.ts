/**
 * API重试和熔断工具 - Linus式最小实现
 *
 * 原则：
 * - 只在网络层和外部API调用处使用
 * - 有限次数重试（默认3次），不要无限重试
 * - 指数退避，避免雪崩
 * - 熔断器模式，快速失败
 */

export interface RetryOptions {
  /** 最大重试次数，默认3 */
  maxRetries?: number
  /** 初始延迟(ms)，默认100ms */
  initialDelay?: number
  /** 延迟倍增因子，默认2 */
  backoffMultiplier?: number
  /** 最大延迟(ms)，默认5000ms */
  maxDelay?: number
  /** 是否应该重试的判断函数，默认所有错误都重试 */
  shouldRetry?: (error: unknown, attempt: number) => boolean
}

/**
 * 简单重试包装器
 *
 * @example
 * const data = await retryWithBackoff(
 *   () => fetch('https://api.example.com/data'),
 *   { maxRetries: 3, shouldRetry: (err) => isNetworkError(err) }
 * )
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    backoffMultiplier = 2,
    maxDelay = 5000,
    shouldRetry = () => true
  } = options

  let lastError: unknown
  let delay = initialDelay

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // 最后一次尝试失败，直接抛出
      if (attempt === maxRetries) {
        break
      }

      // 检查是否应该重试
      if (!shouldRetry(error, attempt)) {
        throw error
      }

      // 等待后重试，使用指数退避
      await sleep(delay)
      delay = Math.min(delay * backoffMultiplier, maxDelay)
    }
  }

  throw lastError
}

/**
 * 简单的熔断器 - 保护外部API调用
 *
 * 状态机：
 * - CLOSED（正常）：允许请求通过
 * - OPEN（熔断）：直接拒绝请求，快速失败
 * - HALF_OPEN（半开）：允许一次测试请求
 *
 * @example
 * const breaker = new CircuitBreaker({ failureThreshold: 5, resetTimeout: 60000 })
 *
 * const result = await breaker.execute(
 *   () => fetchExternalAPI()
 * )
 */
export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  private failureCount = 0
  private lastFailureTime = 0
  private readonly failureThreshold: number
  private readonly resetTimeout: number
  private readonly name: string

  constructor(options: {
    /** 失败次数阈值，默认5次 */
    failureThreshold?: number
    /** 熔断后的恢复时间(ms)，默认60秒 */
    resetTimeout?: number
    /** 熔断器名称（用于日志） */
    name?: string
  } = {}) {
    this.failureThreshold = options.failureThreshold ?? 5
    this.resetTimeout = options.resetTimeout ?? 60000
    this.name = options.name ?? 'CircuitBreaker'
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // 检查是否应该尝试恢复
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        console.info(`[${this.name}] Entering HALF_OPEN state`)
        this.state = 'HALF_OPEN'
      } else {
        throw new Error(`Circuit breaker [${this.name}] is OPEN. Service unavailable.`)
      }
    }

    try {
      const result = await fn()

      // 成功：重置计数器
      if (this.state === 'HALF_OPEN') {
        console.info(`[${this.name}] Recovered, entering CLOSED state`)
      }
      this.state = 'CLOSED'
      this.failureCount = 0

      return result
    } catch (error) {
      this.handleFailure()
      throw error
    }
  }

  private handleFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === 'HALF_OPEN') {
      // 半开状态下失败，立即重新打开熔断器
      console.warn(`[${this.name}] HALF_OPEN test failed, re-entering OPEN state`)
      this.state = 'OPEN'
    } else if (this.failureCount >= this.failureThreshold) {
      // 失败次数达到阈值，打开熔断器
      console.warn(`[${this.name}] Threshold reached (${this.failureCount}), entering OPEN state`)
      this.state = 'OPEN'
    }
  }

  /** 获取当前状态（用于监控） */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    }
  }

  /** 手动重置熔断器 */
  reset() {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.lastFailureTime = 0
    console.info(`[${this.name}] Manually reset`)
  }
}

/**
 * 判断错误是否可重试
 *
 * 可重试的错误：
 * - 网络错误（ECONNRESET, ETIMEDOUT等）
 * - 5xx服务器错误
 * - 429限流错误
 *
 * 不可重试的错误：
 * - 4xx客户端错误（除了429）
 * - 业务逻辑错误
 */
export function isRetryableError(error: unknown): boolean {
  // 网络错误
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('fetch failed')
    ) {
      return true
    }
  }

  // HTTP错误
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    // 5xx服务器错误 或 429限流
    return status >= 500 || status === 429
  }

  // 默认不重试
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
