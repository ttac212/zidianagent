/**
 * 内联反馈组件
 * 用于替代Toast的轻量级反馈方案
 */

import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Check, AlertCircle, Info, Loader2, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export type FeedbackType = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'idle'

export interface InlineFeedbackProps {
  type?: FeedbackType
  message?: string
  duration?: number  // 自动隐藏时间（毫秒）
  className?: string
  onDismiss?: () => void
  show?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const iconMap = {
  success: Check,
  error: AlertCircle,
  warning: AlertCircle,
  info: Info,
  loading: Loader2,
  idle: null,
}

const colorMap = {
  success: 'text-green-600 bg-green-50 border-green-200',
  error: 'text-red-600 bg-red-50 border-red-200',
  warning: 'text-amber-600 bg-amber-50 border-amber-200',
  info: 'text-blue-600 bg-blue-50 border-blue-200',
  loading: 'text-gray-600 bg-gray-50 border-gray-200',
  idle: '',
}

const sizeMap = {
  sm: 'text-xs py-1 px-2',
  md: 'text-sm py-1.5 px-3',
  lg: 'text-base py-2 px-4',
}

/**
 * 内联反馈组件
 * 在操作按钮附近显示简短的状态反馈
 */
export function InlineFeedback({
  type = 'idle',
  message,
  duration = 3000,
  className,
  onDismiss,
  show = true,
  size = 'md',
}: InlineFeedbackProps) {
  const [visible, setVisible] = useState(show && type !== 'idle')
  
  useEffect(() => {
    setVisible(show && type !== 'idle')
    
    if (show && type !== 'idle' && type !== 'loading' && duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false)
        onDismiss?.()
      }, duration)
      
      return () => clearTimeout(timer)
    }
  }, [show, type, duration, onDismiss])
  
  const Icon = iconMap[type]
  const colorClass = colorMap[type]
  const sizeClass = sizeMap[size]
  
  return (
    <AnimatePresence>
      {visible && message && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15 }}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border font-medium',
            colorClass,
            sizeClass,
            className
          )}
        >
          {Icon && (
            <Icon
              className={cn(
                'shrink-0',
                size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5',
                type === 'loading' && 'animate-spin'
              )}
            />
          )}
          <span>{message}</span>
          {type !== 'loading' && onDismiss && (
            <button
              onClick={() => {
                setVisible(false)
                onDismiss()
              }}
              className="ml-1 hover:opacity-70 transition-opacity"
            >
              <X className={cn(
                'shrink-0',
                size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-3.5 w-3.5' : 'h-4 w-4'
              )} />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * 按钮内联反馈Hook
 * 管理按钮的反馈状态
 */
export function useInlineFeedback(initialType: FeedbackType = 'idle') {
  const [feedback, setFeedback] = useState<{
    type: FeedbackType
    message?: string
  }>({
    type: initialType,
    message: undefined,
  })
  
  const showFeedback = (type: FeedbackType, message?: string, duration = 3000) => {
    setFeedback({ type, message })
    
    if (type !== 'loading' && type !== 'idle' && duration > 0) {
      setTimeout(() => {
        setFeedback({ type: 'idle', message: undefined })
      }, duration)
    }
  }
  
  const clearFeedback = () => {
    setFeedback({ type: 'idle', message: undefined })
  }
  
  return {
    feedback,
    showFeedback,
    clearFeedback,
    isLoading: feedback.type === 'loading',
    hasError: feedback.type === 'error',
    
    // 便捷方法
    showSuccess: (message?: string) => showFeedback('success', message),
    showError: (message?: string) => showFeedback('error', message),
    showWarning: (message?: string) => showFeedback('warning', message),
    showInfo: (message?: string) => showFeedback('info', message),
    showLoading: (message?: string) => showFeedback('loading', message, 0),
  }
}

/**
 * 带反馈的按钮组件
 * 集成了内联反馈的按钮
 */
export interface FeedbackButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  feedbackType?: FeedbackType
  feedbackMessage?: string
  feedbackDuration?: number
  feedbackPosition?: 'top' | 'bottom' | 'left' | 'right'
}

export function FeedbackButton({
  children,
  feedbackType = 'idle',
  feedbackMessage,
  feedbackDuration = 3000,
  feedbackPosition = 'top',
  className,
  disabled,
  ...props
}: FeedbackButtonProps) {
  const positionClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2',
  }
  
  return (
    <div className="relative inline-flex">
      <button
        className={cn(
          'transition-all',
          feedbackType === 'loading' && 'opacity-70 cursor-not-allowed',
          className
        )}
        disabled={disabled || feedbackType === 'loading'}
        {...props}
      >
        {feedbackType === 'loading' ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {children}
          </span>
        ) : (
          children
        )}
      </button>
      
      {feedbackType !== 'idle' && feedbackMessage && (
        <div className={cn('absolute z-10', positionClasses[feedbackPosition])}>
          <InlineFeedback
            type={feedbackType}
            message={feedbackMessage}
            duration={feedbackDuration}
            size="sm"
          />
        </div>
      )}
    </div>
  )
}