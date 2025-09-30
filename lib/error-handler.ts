import * as dt from '@/lib/utils/date-toolkit'

"use client"

export class AppError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(message: string, code = "UNKNOWN_ERROR", statusCode = 500, isOperational = true) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.statusCode = statusCode
    this.isOperational = isOperational

    Error.captureStackTrace(this, this.constructor)
  }
}

export class NetworkError extends AppError {
  constructor(message = "网络连接失败") {
    super(message, "NETWORK_ERROR", 0, true)
    this.name = "NetworkError"
  }
}

export class APIError extends AppError {
  constructor(message: string, statusCode = 500) {
    super(message, "API_ERROR", statusCode, true)
    this.name = "APIError"
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400, true)
    this.name = "ValidationError"
  }
}

export function handleAPIError(error: any): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error.name === "TypeError" && error.message.includes("fetch")) {
    return new NetworkError("网络连接失败，请检查您的网络连接")
  }

  if (error.status || error.statusCode) {
    const statusCode = error.status || error.statusCode
    let message = error.message || "请求失败"

    switch (statusCode) {
      case 400:
        message = "请求参数错误"
        break
      case 401:
        message = "未授权访问"
        break
      case 403:
        message = "访问被拒绝"
        break
      case 404:
        message = "请求的资源不存在"
        break
      case 429:
        message = "请求过于频繁，请稍后重试"
        break
      case 500:
        message = "服务器内部错误"
        break
      case 502:
        message = "网关错误"
        break
      case 503:
        message = "服务暂时不可用"
        break
    }

    return new APIError(message, statusCode)
  }

  return new AppError(error.message || "未知错误", "UNKNOWN_ERROR", 500, false)
}

export function logError(error: Error, context?: string) {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: dt.toISO(),
    userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
    url: typeof window !== "undefined" ? window.location.href : "server",
  }

  // 在生产环境中，这里可以发送错误到监控服务
  if (process.env.NODE_ENV === "production") {
    // 发送到错误监控服务
    // sendToErrorService(errorInfo)
  } else {
    // 开发环境中输出详细错误信息
    console.error('Error logged:', errorInfo)
  }
}
