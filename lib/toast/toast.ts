/**
 * 统一的Toast系统 - 基于Sonner的简单包装
 * 消除所有特殊情况，提供清晰一致的API
 */

import { toast as sonner, ExternalToast } from 'sonner'

// 简化的配置选项
export interface ToastOptions extends Omit<ExternalToast, 'duration'> {
  duration?: number
  description?: string
  actionLabel?: string
  onAction?: () => void
}

// 默认配置 - 简单明确
const DEFAULT_DURATIONS = {
  success: 3000,   // 成功提示短一些
  error: 8000,     // 错误提示长一些，用户需要时间阅读
  warning: 5000,   // 警告适中
  info: 4000,      // 信息适中
  loading: 0,      // loading不自动消失
}

/**
 * 统一的toast API - 最笨但最清晰的实现
 */
export const toast = {
  /**
   * 成功提示
   */
  success: (message: string, options?: ToastOptions) => {
    const { actionLabel, onAction, duration = DEFAULT_DURATIONS.success, ...rest } = options || {}

    return sonner.success(message, {
      duration,
      action: actionLabel ? {
        label: actionLabel,
        onClick: onAction || (() => {}),
      } : undefined,
      ...rest,
    })
  },

  /**
   * 错误提示 - 默认时间较长，确保用户看到
   */
  error: (message: string, options?: ToastOptions) => {
    const { actionLabel, onAction, duration = DEFAULT_DURATIONS.error, ...rest } = options || {}

    return sonner.error(message, {
      duration,
      action: actionLabel ? {
        label: actionLabel,
        onClick: onAction || (() => {}),
      } : undefined,
      ...rest,
    })
  },

  /**
   * 警告提示
   */
  warning: (message: string, options?: ToastOptions) => {
    const { actionLabel, onAction, duration = DEFAULT_DURATIONS.warning, ...rest } = options || {}

    return sonner.warning(message, {
      duration,
      action: actionLabel ? {
        label: actionLabel,
        onClick: onAction || (() => {}),
      } : undefined,
      ...rest,
    })
  },

  /**
   * 信息提示
   */
  info: (message: string, options?: ToastOptions) => {
    const { actionLabel, onAction, duration = DEFAULT_DURATIONS.info, ...rest } = options || {}

    return sonner.info(message, {
      duration,
      action: actionLabel ? {
        label: actionLabel,
        onClick: onAction || (() => {}),
      } : undefined,
      ...rest,
    })
  },

  /**
   * 加载提示
   */
  loading: (message: string, options?: Omit<ToastOptions, 'duration'>) => {
    return sonner.loading(message, {
      duration: DEFAULT_DURATIONS.loading,
      ...options,
    })
  },

  /**
   * Promise提示 - 直接暴露Sonner的Promise功能
   */
  promise: sonner.promise,

  /**
   * 自定义提示
   */
  custom: sonner.custom,

  /**
   * 关闭特定提示
   */
  dismiss: sonner.dismiss,

  /**
   * 关闭所有提示
   */
  dismissAll: () => sonner.dismiss(),
}

// 兼容性导出 - 确保现有代码能平滑迁移
export default toast