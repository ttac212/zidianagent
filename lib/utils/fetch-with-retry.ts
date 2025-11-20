/**
 * Fetch with Retry - 带指数退避的重试逻辑
 *
 * 适用场景：
 * - 临时性限流（429）
 * - 网络抖动（502/503/504）
 * - 服务端临时不可用
 */

export interface RetryOptions {
  /** 最大重试次数（默认3次） */
  maxRetries?: number
  /** 初始延迟时间（毫秒，默认1000ms） */
  initialDelay?: number
  /** 延迟倍数（默认2，即指数退避） */
  backoffMultiplier?: number
  /** 最大延迟时间（毫秒，默认10000ms） */
  maxDelay?: number
  /** 可重试的HTTP状态码（默认429, 502, 503, 504） */
  retryableStatuses?: number[]
  /** 重试前回调（可用于日志） */
  onRetry?: (attempt: number, delay: number, error: string) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  backoffMultiplier: 2,
  maxDelay: 10000,
  retryableStatuses: [429, 502, 503, 504],
  onRetry: () => {},
}

/**
 * 计算退避延迟时间
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  backoffMultiplier: number,
  maxDelay: number
): number {
  const delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1)
  return Math.min(delay, maxDelay)
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 带重试的fetch函数
 *
 * @example
 * const response = await fetchWithRetry(url, {
 *   method: 'POST',
 *   headers: { ... },
 *   body: JSON.stringify(data),
 * }, {
 *   maxRetries: 3,
 *   onRetry: (attempt, delay) => console.log(`Retrying (${attempt}/3) after ${delay}ms`)
 * })
 */
export async function fetchWithRetry(
  url: string | URL,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  const config = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error | null = null
  let lastResponse: Response | null = null

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, init)

      // 成功响应（2xx）直接返回
      if (response.ok) {
        return response
      }

      // 检查是否为可重试的状态码
      if (config.retryableStatuses.includes(response.status)) {
        lastResponse = response

        // 已达最大重试次数
        if (attempt === config.maxRetries) {
          console.error(`[FetchWithRetry] Max retries (${config.maxRetries}) reached for ${url}`)
          return response
        }

        // 计算延迟时间
        const delay = calculateDelay(
          attempt + 1,
          config.initialDelay,
          config.backoffMultiplier,
          config.maxDelay
        )

        // 读取错误信息（不影响重试）
        let errorMessage = `${response.status} ${response.statusText}`
        try {
          const errorText = await response.clone().text()
          if (errorText) {
            errorMessage = `${response.status} - ${errorText.substring(0, 200)}`
          }
        } catch (_error) {
          // 忽略读取错误
        }

        // 触发重试回调
        config.onRetry(attempt + 1, delay, errorMessage)

        console.warn(
          `[FetchWithRetry] Retrying (${attempt + 1}/${config.maxRetries}) after ${delay}ms due to ${errorMessage}`
        )

        // 等待后重试
        await sleep(delay)
        continue
      }

      // 非可重试状态码，直接返回
      return response
    } catch (error) {
      lastError = error as Error

      // 已达最大重试次数
      if (attempt === config.maxRetries) {
        console.error(`[FetchWithRetry] Max retries (${config.maxRetries}) reached for ${url}`)
        throw error
      }

      // 计算延迟时间
      const delay = calculateDelay(
        attempt + 1,
        config.initialDelay,
        config.backoffMultiplier,
        config.maxDelay
      )

      const errorMessage = error instanceof Error ? error.message : String(error)

      // 触发重试回调
      config.onRetry(attempt + 1, delay, errorMessage)

      console.warn(
        `[FetchWithRetry] Retrying (${attempt + 1}/${config.maxRetries}) after ${delay}ms due to ${errorMessage}`
      )

      // 等待后重试
      await sleep(delay)
    }
  }

  // 理论上不应该到达这里，但为了类型安全
  if (lastResponse) {
    return lastResponse
  }

  if (lastError) {
    throw lastError
  }

  throw new Error('Fetch failed with unknown error')
}

/**
 * 构建友好的429错误消息
 */
export function buildRateLimitError(
  modelName: string,
  retryAfter?: number
): { message: string; details: any } {
  const retryMessage = retryAfter
    ? `请在${retryAfter}秒后重试`
    : '请稍后重试'

  return {
    message: `${modelName}模型当前请求过多，已达到速率限制。${retryMessage}或切换到其他模型。`,
    details: {
      errorType: 'RATE_LIMIT_EXCEEDED',
      modelName,
      retryAfter,
      suggestion: '建议切换到Claude Sonnet 4.5或GPT-5.1模型',
    },
  }
}
