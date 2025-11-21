/**
 * 统一错误处理文案映射
 * 提供中文友好的错误提示信息
 */

export interface ErrorMessage {
  title: string
  message: string
  action?: string
}

/**
 * 根据错误类型获取友好的中文错误信息
 * @param error - 错误对象或错误消息字符串
 * @returns 格式化的错误信息对象
 */
export function getFriendlyErrorMessage(error: Error | string | null | undefined): ErrorMessage {
  const errorMessage = error instanceof Error ? error.message : (error || '')
  const errorName = error instanceof Error ? error.name : ''
  const lower = errorMessage.toLowerCase()

  // 用户主动中止
  if (errorName === 'AbortError' || lower.includes('aborted') || lower.includes('abort') || lower.includes('cancel')) {
    return {
      title: '请求已取消',
      message: '您已取消本次请求',
      action: '重新发送'
    }
  }

  // 429 请求过于频繁
  if (lower.includes('429') || lower.includes('too many requests') || lower.includes('rate limit')) {
    return {
      title: '请求过于频繁',
      message: '当前请求过多，请稍后再试',
      action: '稍后重试'
    }
  }

  // 504 网关超时
  if (lower.includes('504') || lower.includes('gateway timeout') || lower.includes('timeout')) {
    return {
      title: '请求超时',
      message: '服务器响应超时，请稍后重试',
      action: '重新尝试'
    }
  }

  // 401 未授权
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('unauthenticated')) {
    return {
      title: '认证失败',
      message: '您的登录状态已失效，请重新登录',
      action: '重新登录'
    }
  }

  // 403 禁止访问
  if (lower.includes('403') || lower.includes('forbidden')) {
    return {
      title: '无权访问',
      message: '您没有权限执行此操作',
      action: '返回'
    }
  }

  // 404 未找到
  if (lower.includes('404') || lower.includes('not found')) {
    return {
      title: '资源不存在',
      message: '请求的资源不存在',
      action: '返回'
    }
  }

  // 500 服务器错误
  if (lower.includes('500') || lower.includes('internal server error')) {
    return {
      title: '服务器错误',
      message: '服务器遇到了问题，我们会尽快修复',
      action: '重试'
    }
  }

  // 503 服务不可用
  if (lower.includes('503') || lower.includes('service unavailable')) {
    return {
      title: '服务暂时不可用',
      message: '服务器正在维护或负载过高，请稍后再试',
      action: '稍后重试'
    }
  }

  // 网络错误
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('connection')) {
    return {
      title: '网络连接失败',
      message: '无法连接到服务器，请检查您的网络连接',
      action: '重新连接'
    }
  }

  // Token配额不足
  if (lower.includes('quota') || lower.includes('limit exceeded') || lower.includes('配额')) {
    return {
      title: 'Token配额不足',
      message: '您的Token使用量已达上限，请联系管理员',
      action: '了解详情'
    }
  }

  // 模型不可用
  if (lower.includes('model') || lower.includes('模型')) {
    return {
      title: '模型暂时不可用',
      message: '当前AI模型正在维护，请稍后重试或切换其他模型',
      action: '切换模型'
    }
  }

  // 默认错误
  return {
    title: '发生了错误',
    message: errorMessage || '请求失败，请稍后重试',
    action: '重试'
  }
}

/**
 * 检查错误是否可重试
 * @param error - 错误对象或错误消息字符串
 * @returns 是否可重试
 */
export function isRetryableError(error: Error | string | null | undefined): boolean {
  const errorMessage = error instanceof Error ? error.message : (error || '')
  const lower = errorMessage.toLowerCase()

  // 不可重试的错误
  const nonRetryable = [
    'abort',
    'cancel',
    '401',
    '403',
    '404',
    'unauthorized',
    'forbidden',
    'not found'
  ]

  return !nonRetryable.some(keyword => lower.includes(keyword))
}

/**
 * 检查是否是用户主动取消
 * @param error - 错误对象或错误消息字符串
 * @returns 是否是用户主动取消
 */
export function isUserCancellation(error: Error | string | null | undefined): boolean {
  const errorMessage = error instanceof Error ? error.message : (error || '')
  const errorName = error instanceof Error ? error.name : ''
  const lower = errorMessage.toLowerCase()

  return (
    errorName === 'AbortError' ||
    lower.includes('aborted') ||
    lower.includes('abort') ||
    lower.includes('cancel')
  )
}

/**
 * 获取HTTP状态码错误信息
 * @param status - HTTP状态码
 * @returns 格式化的错误信息
 */
export function getHttpStatusError(status: number): ErrorMessage {
  switch (status) {
    case 400:
      return {
        title: '请求参数错误',
        message: '请求参数格式不正确',
        action: '检查参数'
      }
    case 401:
      return {
        title: '未授权',
        message: '您需要登录才能访问此资源',
        action: '去登录'
      }
    case 403:
      return {
        title: '禁止访问',
        message: '您没有权限访问此资源',
        action: '返回'
      }
    case 404:
      return {
        title: '资源不存在',
        message: '请求的资源未找到',
        action: '返回'
      }
    case 429:
      return {
        title: '请求过于频繁',
        message: '您的请求过多，请稍后再试',
        action: '稍后重试'
      }
    case 500:
      return {
        title: '服务器错误',
        message: '服务器遇到了问题，请稍后重试',
        action: '重试'
      }
    case 502:
      return {
        title: '网关错误',
        message: '服务器网关错误，请稍后重试',
        action: '重试'
      }
    case 503:
      return {
        title: '服务不可用',
        message: '服务器暂时无法处理请求，请稍后重试',
        action: '稍后重试'
      }
    case 504:
      return {
        title: '网关超时',
        message: '服务器响应超时，请稍后重试',
        action: '重试'
      }
    default:
      return {
        title: `HTTP ${status} 错误`,
        message: '请求失败，请稍后重试',
        action: '重试'
      }
  }
}
