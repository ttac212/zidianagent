/**
 * 重试工具函数
 * 提供指数退避的自动重试机制
 */

export interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  factor?: number
  onRetry?: (error: Error, attempt: number) => void
}

/**
 * 使用指数退避算法的重试函数
 * @param fn 需要重试的异步函数
 * @param options 重试配置选项
 * @returns Promise<T>
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    onRetry
  } = options

  let lastError: Error

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // 判断是否应该重试
      if (!shouldRetry(error)) {
        throw error
      }

      // 最后一次尝试，直接抛出错误
      if (attempt === maxRetries - 1) {
        throw error
      }

      // 计算延迟时间（指数退避）
      const delay = Math.min(
        initialDelay * Math.pow(factor, attempt),
        maxDelay
      )

      // 触发重试回调
      if (onRetry) {
        onRetry(lastError, attempt + 1)
      }

      // 等待后重试
      await sleep(delay)
    }
  }

  throw lastError!
}

/**
 * 判断错误是否应该重试
 * @param error 错误对象
 * @returns boolean
 */
function shouldRetry(error: any): boolean {
  const message = error?.message || ''
  const status = error?.status || error?.response?.status

  // 特殊处理: AbortError 永远不应重试（用户主动中止）
  if (error?.name === 'AbortError' || message.includes('AbortError')) {
    return false
  }

  // 不应该重试的错误类型
  const noRetryPatterns = [
    '401',           // 未授权
    '403',           // 禁止访问
    '月度配额',      // 配额耗尽
    '无效的API Key', // API Key错误
    '模型验证失败',  // 模型不支持
  ]

  // 检查是否包含不应重试的模式
  for (const pattern of noRetryPatterns) {
    if (message.includes(pattern) || status === parseInt(pattern)) {
      return false
    }
  }

  // 应该重试的错误类型
  const retryPatterns = [
    'ECONNRESET',       // 连接重置
    'ETIMEDOUT',        // 超时
    'ENOTFOUND',        // DNS解析失败
    'NetworkError',     // 网络错误
    '408',              // 请求超时
    '500',              // 服务器内部错误
    '502',              // 网关错误
    '503',              // 服务不可用
    '504',              // 网关超时
    '429',              // 请求过多（限流）
    // 'AbortError' 已移除 - 用户主动中止不应重试
    '请求超时',         // 中文超时消息
    '流处理失败',       // SSE流错误
    'AI服务响应超时',   // AI服务超时
    'AI服务连接失败',   // AI服务连接失败
    'Database timeout', // 数据库超时
    'timeout',          // 通用超时
  ]

  // 检查是否应该重试
  for (const pattern of retryPatterns) {
    if (message.includes(pattern) || status === parseInt(pattern)) {
      return true
    }
  }

  // 默认重试网络相关错误
  return error.name === 'TypeError' || error.name === 'FetchError'
}

/**
 * 延迟函数
 * @param ms 延迟毫秒数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 带超时的fetch请求
 * @param url 请求URL
 * @param options 请求选项
 * @param timeout 超时时间（毫秒）
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 30000
): Promise<Response> {
  const controller = new AbortController()
  let isTimeoutAbort = false
  const timeoutId = setTimeout(() => {
    isTimeoutAbort = true
    controller.abort()
  }, timeout)

  // 如果外部提供了signal，需要合并处理
  const originalSignal = options.signal as AbortSignal | undefined
  if (originalSignal) {
    originalSignal.addEventListener('abort', () => {
      controller.abort()
    })
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error: any) {
    clearTimeout(timeoutId)
    
    // 区分超时中止和用户中止
    if (error.name === 'AbortError') {
      if (isTimeoutAbort) {
        const timeoutError = new Error(`请求超时（${timeout}ms）`)
        timeoutError.name = 'TimeoutError'
        throw timeoutError
      }
      // 保留原始的 AbortError（用户主动中止）
    }
    throw error
  }
}

/**
 * 带重试和超时的fetch请求
 * @param url 请求URL
 * @param options 请求选项
 * @param retryOptions 重试选项
 * @param timeout 超时时间
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {},
  timeout = 30000
): Promise<Response> {
  return retryWithBackoff(
    () => fetchWithTimeout(url, options, timeout),
    retryOptions
  )
}