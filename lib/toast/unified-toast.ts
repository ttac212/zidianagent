/**
 * 统一的Toast系统
 * 整合use-toast和sonner，提供一致的API
 */

import { toast as useToastBase } from '@/hooks/use-toast'
import { toast as sonnerToast } from 'sonner'

// Toast类型
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'

// Toast配置
export interface ToastOptions {
  title?: string
  description?: string
  duration?: number
  action?: React.ReactNode
  onAction?: () => void
  closeButton?: boolean
  important?: boolean  // 重要通知使用use-toast，确保不被覆盖
}

// 默认持续时间（毫秒）
const DEFAULT_DURATION = {
  success: 3000,
  error: 8000,
  warning: 5000,
  info: 4000,
  loading: 60000, // loading状态不自动消失
}

/**
 * 统一的toast函数
 * 根据消息的重要性选择合适的通知系统
 */
class UnifiedToast {
  /**
   * 成功提示
   */
  success(message: string, options?: ToastOptions) {
    const duration = options?.duration ?? DEFAULT_DURATION.success
    
    if (options?.important || options?.action) {
      // 重要通知或带操作的使用use-toast
      return useToastBase({
        title: options?.title || message,
        description: options?.description,
        action: options?.action,
        duration,
      })
    }
    
    // 普通成功提示使用sonner（更轻量）
    return sonnerToast.success(message, {
      description: options?.description,
      duration,
      closeButton: options?.closeButton,
    })
  }
  
  /**
   * 错误提示
   */
  error(message: string, options?: ToastOptions) {
    const duration = options?.duration ?? DEFAULT_DURATION.error
    
    // 错误始终视为重要，使用use-toast确保可见
    return useToastBase({
      variant: 'destructive',
      title: options?.title || message,
      description: options?.description,
      action: options?.action,
      duration,
    })
  }
  
  /**
   * 警告提示
   */
  warning(message: string, options?: ToastOptions) {
    const duration = options?.duration ?? DEFAULT_DURATION.warning
    
    if (options?.important || options?.action) {
      return useToastBase({
        title: options?.title || message,
        description: options?.description,
        action: options?.action,
        duration,
      })
    }
    
    // 普通警告使用sonner
    return sonnerToast.warning(message, {
      description: options?.description,
      duration,
      closeButton: options?.closeButton,
    })
  }
  
  /**
   * 信息提示
   */
  info(message: string, options?: ToastOptions) {
    const duration = options?.duration ?? DEFAULT_DURATION.info
    
    if (options?.important || options?.action) {
      return useToastBase({
        title: options?.title || message,
        description: options?.description,
        action: options?.action,
        duration,
      })
    }
    
    // 普通信息使用sonner
    return sonnerToast.info(message, {
      description: options?.description,
      duration,
      closeButton: options?.closeButton,
    })
  }
  
  /**
   * 加载中提示
   */
  loading(message: string, options?: ToastOptions) {
    const id = Math.random().toString(36).slice(2)
    
    // 加载状态使用sonner的promise功能
    const promise = new Promise((resolve) => {
      // 存储resolve函数以便后续调用
      (this as any)[`_loading_${id}`] = resolve
    })
    
    sonnerToast.promise(promise, {
      loading: message,
      success: options?.title || '操作完成',
      error: '操作失败',
    })
    
    return {
      id,
      success: (message?: string) => {
        const resolve = (this as any)[`_loading_${id}`]
        if (resolve) {
          resolve(message || '操作完成')
          delete (this as any)[`_loading_${id}`]
        }
      },
      error: (message?: string) => {
        const resolve = (this as any)[`_loading_${id}`]
        if (resolve) {
          resolve(Promise.reject(new Error(message || '操作失败')))
          delete (this as any)[`_loading_${id}`]
        }
      }
    }
  }
  
  /**
   * Promise提示（自动显示loading/success/error）
   */
  async promise<T>(
    promise: Promise<T>,
    messages: {
      loading?: string
      success?: string | ((data: T) => string)
      error?: string | ((error: any) => string)
    }
  ): Promise<T> {
    return sonnerToast.promise(promise, {
      loading: messages.loading || '处理中...',
      success: messages.success || '操作成功',
      error: messages.error || '操作失败',
    })
  }
  
  /**
   * 自定义提示
   */
  custom(content: React.ReactNode, options?: ToastOptions) {
    if (options?.important) {
      return useToastBase({
        title: options?.title,
        description: content,
        duration: options?.duration,
      })
    }
    
    return sonnerToast.custom(content, {
      duration: options?.duration,
      closeButton: options?.closeButton,
    })
  }
  
  /**
   * 关闭所有toast
   */
  dismissAll() {
    // 关闭所有sonner toast
    sonnerToast.dismiss()
    
    // use-toast没有全部关闭的API，需要单独实现
    // 这里暂时无法关闭use-toast的消息
  }
}

// 创建全局实例
export const toast = new UnifiedToast()

// 导出类型
export type { UnifiedToast }

// 智能Toast判断函数
export function shouldShowToast(context: {
  type: ToastType
  isAutoSave?: boolean
  hasVisualFeedback?: boolean
  isFirstAction?: boolean
  isCritical?: boolean
}): boolean {
  const { type, isAutoSave, hasVisualFeedback, isFirstAction, isCritical } = context
  
  // 错误和关键操作始终显示
  if (type === 'error' || isCritical) {
    return true
  }
  
  // 自动保存不显示
  if (isAutoSave) {
    return false
  }
  
  // 有视觉反馈时不重复提示
  if (hasVisualFeedback && type === 'success') {
    return false
  }
  
  // 首次操作显示提示
  if (isFirstAction) {
    return true
  }
  
  // 默认：成功不显示，其他类型显示
  return type !== 'success'
}