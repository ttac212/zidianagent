/**
 * 智能Fetch客户端
 * 集成网络状态监控、自动重连、断线恢复等功能
 */

import { retryWithBackoff, type RetryOptions } from './retry'

/**
 * 检测是否在浏览器环境中
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && 
         typeof navigator !== 'undefined' &&
         typeof document !== 'undefined'
}

/**
 * 检测是否在Node.js环境中
 */
function isNode(): boolean {
  return typeof process !== 'undefined' &&
         process.versions != null &&
         process.versions.node != null
}

export interface SmartFetchOptions extends RequestInit {
  /** 重试选项 */
  retry?: RetryOptions
  /** 是否等待网络恢复 */
  waitForRecovery?: boolean
  /** 网络恢复等待超时时间（毫秒） */
  recoveryTimeout?: number
  /** 是否在重试前检查网络状态 */
  checkNetworkBeforeRetry?: boolean
  /** 请求超时时间（毫秒） */
  timeout?: number
  /** 是否显示重试通知 */
  showRetryNotification?: boolean
}

/**
 * 网络恢复检查函数
 */
async function waitForNetworkRecovery(timeout = 30000): Promise<boolean> {
  // 在服务端环境中直接返回true（假设网络正常）
  if (!isBrowser()) {
    return true
  }
  
  const startTime = Date.now()
  const healthCheckUrl = '/api/health'
  
  while (Date.now() - startTime < timeout) {
    try {
      // 检查浏览器网络状态
      if ('navigator' in window && !navigator.onLine) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }

      // 检查服务器健康状态
      const response = await fetch(healthCheckUrl, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      })

      if (response.ok) {
        return true
      }
    } catch (error) {
      // 继续等待
    }

    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  return false
}

/**
 * 检查网络状态
 */
async function checkNetworkStatus(): Promise<boolean> {
  // 在服务端环境中直接返回true
  if (!isBrowser()) {
    return true
  }
  
  // 检查navigator.onLine状态
  if ('navigator' in window && !navigator.onLine) {
    return false
  }

  try {
    // 在服务端环境中，这个请求可能需要完整URL
    const healthCheckUrl = isBrowser() ? '/api/health' : `${process.env.NEXTAUTH_URL || 'http://localhost:3007'}/api/health`
    
    const response = await fetch(healthCheckUrl, {
      method: 'HEAD',
      cache: 'no-cache',
      signal: AbortSignal.timeout(5000)
    })
    return response.ok
  } catch (error) {
    return false
  }
}

/**
 * 创建带超时的fetch请求
 */
function createTimeoutFetch(url: string, options: RequestInit, timeout: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
      reject(new Error(`请求超时（${timeout}ms）`))
    }, timeout)

    fetch(url, {
      ...options,
      signal: controller.signal
    })
    .then(response => {
      clearTimeout(timeoutId)
      resolve(response)
    })
    .catch(error => {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        reject(new Error(`请求超时（${timeout}ms）`))
      } else {
        reject(error)
      }
    })
  })
}

/**
 * 智能Fetch函数
 * 自动处理网络异常、重连、重试等场景
 */
export async function smartFetch(
  url: string,
  options: SmartFetchOptions = {}
): Promise<Response> {
  const {
    retry = {
      maxRetries: 3,
      initialDelay: 1000,
      factor: 2
    },
    waitForRecovery = true,
    recoveryTimeout = 30000,
    checkNetworkBeforeRetry = true,
    timeout = 30000,
    showRetryNotification = false,
    ...fetchOptions
  } = options

  // 增强的重试逻辑
  const enhancedRetry: RetryOptions = {
    ...retry,
    onRetry: async (error, attempt) => {
      // 如果启用了重试通知
      if (showRetryNotification && typeof window !== 'undefined') {
        const event = new CustomEvent('smart-fetch-retry', {
          detail: { url, attempt, error: error.message }
        })
        window.dispatchEvent(event)
      }

      // 在重试前检查网络状态
      if (checkNetworkBeforeRetry) {
        const networkHealthy = await checkNetworkStatus()
        if (!networkHealthy && waitForRecovery) {
          const recovered = await waitForNetworkRecovery(recoveryTimeout)
          if (!recovered) {
            throw new Error('网络恢复超时，请检查网络连接')
          }
        }
      }

      // 调用原始的重试回调
      if (retry.onRetry) {
        retry.onRetry(error, attempt)
      }
    }
  }

  // 执行请求
  return retryWithBackoff(
    () => createTimeoutFetch(url, fetchOptions, timeout),
    enhancedRetry
  )
}

/**
 * 智能Fetch的便捷方法
 */
export const smartApi = {
  async get(url: string, options?: Omit<SmartFetchOptions, 'method'>) {
    return smartFetch(url, { ...options, method: 'GET' })
  },

  async post(url: string, data?: any, options?: Omit<SmartFetchOptions, 'method' | 'body'>) {
    return smartFetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: data ? JSON.stringify(data) : undefined
    })
  },

  async put(url: string, data?: any, options?: Omit<SmartFetchOptions, 'method' | 'body'>) {
    return smartFetch(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: data ? JSON.stringify(data) : undefined
    })
  },

  async delete(url: string, options?: Omit<SmartFetchOptions, 'method'>) {
    return smartFetch(url, { ...options, method: 'DELETE' })
  },

  /**
   * 带JSON解析的GET请求
   */
  async getJson<T>(url: string, options?: Omit<SmartFetchOptions, 'method'>): Promise<T> {
    const response = await this.get(url, options)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return response.json()
  },

  /**
   * 带JSON解析的POST请求
   */
  async postJson<T>(url: string, data?: any, options?: Omit<SmartFetchOptions, 'method' | 'body'>): Promise<T> {
    const response = await this.post(url, data, options)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return response.json()
  }
}

/**
 * 网络状态感知的Hook工厂
 * 返回一个自动处理网络状态的fetch hook
 */
export function createNetworkAwareFetch(defaultOptions?: SmartFetchOptions) {
  return {
    smartFetch: (url: string, options?: SmartFetchOptions) => 
      smartFetch(url, { ...defaultOptions, ...options }),
    
    smartApi: {
      get: (url: string, options?: Omit<SmartFetchOptions, 'method'>) =>
        smartApi.get(url, { ...defaultOptions, ...options }),
      
      post: (url: string, data?: any, options?: Omit<SmartFetchOptions, 'method' | 'body'>) =>
        smartApi.post(url, data, { ...defaultOptions, ...options }),
      
      getJson: <T>(url: string, options?: Omit<SmartFetchOptions, 'method'>) =>
        smartApi.getJson<T>(url, { ...defaultOptions, ...options }),
      
      postJson: <T>(url: string, data?: any, options?: Omit<SmartFetchOptions, 'method' | 'body'>) =>
        smartApi.postJson<T>(url, data, { ...defaultOptions, ...options })
    }
  }
}

// 默认的网络感知fetch实例
export const networkAwareFetch = createNetworkAwareFetch({
  retry: { maxRetries: 3, initialDelay: 1000 },
  waitForRecovery: true,
  recoveryTimeout: 30000,
  checkNetworkBeforeRetry: true,
  timeout: 30000
})

/**
 * 安全的fetch包装器 - 自动处理环境差异
 */
export async function safeFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  // 在服务端环境中，可能需要完整URL
  const fullUrl = !isBrowser() && !url.startsWith('http') 
    ? `${process.env.NEXTAUTH_URL || 'http://localhost:3007'}${url}`
    : url
  
  // 在服务端环境中，不使用智能重试功能
  if (!isBrowser()) {
    return fetch(fullUrl, options)
  }
  
  // 在浏览器环境中，使用智能Fetch
  return smartFetch(url, options as SmartFetchOptions)
}

/**
 * 检测当前环境的网络能力
 */
export function getNetworkCapabilities() {
  return {
    isBrowser: isBrowser(),
    isNode: isNode(),
    hasNavigator: typeof navigator !== 'undefined',
    hasOnlineAPI: isBrowser() && 'onLine' in navigator,
    hasConnectionAPI: isBrowser() && 'connection' in navigator,
    hasServiceWorker: isBrowser() && 'serviceWorker' in navigator,
    hasFetch: typeof fetch !== 'undefined',
    hasAbortController: typeof AbortController !== 'undefined',
    hasTimeout: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
  }
}