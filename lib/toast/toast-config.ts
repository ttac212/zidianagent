/**
 * Toast配置和优化工具
 * 提供不同类型的toast配置和优化后的显示函数
 */

import { toast as baseToast } from '@/hooks/use-toast'

// Toast持续时间配置（毫秒）
export const TOAST_DURATION = {
  SHORT: 2000,    // 2秒 - 简单成功提示
  NORMAL: 5000,   // 5秒 - 默认时间
  LONG: 8000,     // 8秒 - 重要信息或错误
  PERMANENT: null // 不自动消失，需要手动关闭
} as const

// Toast类型配置
export const TOAST_PRESETS = {
  // 成功提示（快速消失）
  success: {
    duration: TOAST_DURATION.SHORT,
    variant: 'default' as const,
  },
  
  // 错误提示（停留较长时间）
  error: {
    duration: TOAST_DURATION.LONG,
    variant: 'destructive' as const,
  },
  
  // 警告提示
  warning: {
    duration: TOAST_DURATION.NORMAL,
    variant: 'default' as const,
  },
  
  // 信息提示
  info: {
    duration: TOAST_DURATION.NORMAL,
    variant: 'default' as const,
  },
  
  // 可操作提示（带按钮，不自动消失）
  action: {
    duration: TOAST_DURATION.PERMANENT,
    variant: 'default' as const,
  }
} as const

/**
 * 优化的toast函数
 * 根据不同类型自动配置持续时间
 */
export const toast = {
  /**
   * 成功提示 - 2秒后自动消失
   */
  success(message: string, description?: string) {
    return baseToast({
      title: message,
      description,
      ...TOAST_PRESETS.success,
    })
  },
  
  /**
   * 错误提示 - 8秒后自动消失
   */
  error(message: string, description?: string) {
    return baseToast({
      title: message,
      description,
      ...TOAST_PRESETS.error,
    })
  },
  
  /**
   * 警告提示 - 5秒后自动消失
   */
  warning(message: string, description?: string) {
    return baseToast({
      title: message,
      description,
      ...TOAST_PRESETS.warning,
    })
  },
  
  /**
   * 信息提示 - 5秒后自动消失
   */
  info(message: string, description?: string) {
    return baseToast({
      title: message,
      description,
      ...TOAST_PRESETS.info,
    })
  },
  
  /**
   * 带操作按钮的提示 - 不自动消失
   */
  action(message: string, options: {
    description?: string
    action?: React.ReactNode
    onAction?: () => void
  }) {
    return baseToast({
      title: message,
      description: options.description,
      action: options.action,
      ...TOAST_PRESETS.action,
    })
  },
  
  /**
   * 自定义提示
   */
  custom: baseToast
}

/**
 * 检查是否应该显示成功提示
 * 用于减少重复的"保存成功"提示
 */
export function shouldShowSuccessToast(
  context: {
    isFirstSave?: boolean
    hasVisualFeedback?: boolean
    isBackgroundSave?: boolean
  }
): boolean {
  // 如果是后台自动保存，不显示提示
  if (context.isBackgroundSave) {
    return false
  }
  
  // 如果UI已经有视觉反馈（如按钮状态变化），不显示提示
  if (context.hasVisualFeedback) {
    return false
  }
  
  // 首次保存时显示提示
  if (context.isFirstSave) {
    return true
  }
  
  // 默认不显示
  return false
}

/**
 * 批量操作的toast优化
 * 将多个操作合并为一个提示
 */
export function batchToast(
  operations: Array<{
    success: boolean
    message?: string
  }>
) {
  const successCount = operations.filter(op => op.success).length
  const failureCount = operations.filter(op => !op.success).length
  
  if (failureCount === 0) {
    // 全部成功
    toast.success(`成功完成 ${successCount} 个操作`)
  } else if (successCount === 0) {
    // 全部失败
    toast.error(`${failureCount} 个操作失败`)
  } else {
    // 部分成功
    toast.warning(
      `部分操作完成`,
      `成功: ${successCount}, 失败: ${failureCount}`
    )
  }
}