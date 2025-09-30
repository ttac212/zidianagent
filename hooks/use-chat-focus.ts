/**
 * 聊天焦点管理 Hook
 * 负责输入框的焦点控制
 */

import { useRef, useCallback, useEffect } from 'react'

interface UseChatFocusProps {
  isLoading?: boolean
  autoFocus?: boolean
}

export function useChatFocus({ isLoading = false, autoFocus = true }: UseChatFocusProps = {}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /**
   * 聚焦输入框
   */
  const focusInput = useCallback(() => {
    // 加载中时不聚焦
    if (isLoading) return

    // 确保元素存在且可聚焦
    if (textareaRef.current && !textareaRef.current.disabled) {
      // 直接聚焦，避免测试问题
      textareaRef.current.focus()
    }
  }, [isLoading])

  /**
   * 加载完成后自动聚焦
   */
  useEffect(() => {
    if (!autoFocus || isLoading) return

    const timer = setTimeout(focusInput, 100)
    return () => clearTimeout(timer)
  }, [isLoading, autoFocus, focusInput])

  /**
   * 页面可见时聚焦
   */
  useEffect(() => {
    if (!autoFocus) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        focusInput()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [autoFocus, focusInput])

  /**
   * 初始化时聚焦
   */
  useEffect(() => {
    if (autoFocus) {
      focusInput()
    }
  }, [autoFocus, focusInput])

  /**
   * 错误发生时聚焦（让用户可以重试）
   */
  const focusOnError = useCallback(() => {
    focusInput()
  }, [focusInput])

  return {
    textareaRef,
    focusInput,
    focusOnError
  }
}