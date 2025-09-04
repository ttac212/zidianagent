/**
 * 聊天副作用管理 Hook
 * 处理滚动、焦点、键盘快捷键等副作用
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import type {
  ChatState,
  ChatAction,
  UseChatEffectsReturn
} from '@/types/chat'

interface UseChatEffectsProps {
  state: ChatState
  dispatch: React.Dispatch<ChatAction>
  onSendMessage: (content: string) => void
  onStopGeneration: () => void
  onCreateConversation?: () => void
}

/**
 * 聊天副作用管理 Hook
 */
export function useChatEffects({
  state,
  dispatch,
  onSendMessage,
  onStopGeneration,
  onCreateConversation
}: UseChatEffectsProps): UseChatEffectsReturn {
  
  // DOM 引用
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastMessageCountRef = useRef(state.messages.length)

  /**
   * 滚动到底部
   */
  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto'
        })
      }
    }
  }, [])

  /**
   * 聚焦输入框
   */
  const focusInput = useCallback(() => {
    if (textareaRef.current && !state.isLoading) {
      textareaRef.current.focus()
    }
  }, [state.isLoading])

  /**
   * 处理键盘快捷键
   */
  const handleKeyboardShortcuts = useCallback((e: KeyboardEvent) => {
    // 检查是否在输入框中
    const isInInput = document.activeElement === textareaRef.current
    
    // Ctrl+Enter 或 Enter (在输入框中且不按 Shift)
    if ((e.ctrlKey && e.key === 'Enter') || 
        (isInInput && e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault()
      if (state.input.trim() && !state.isLoading) {
        onSendMessage(state.input)
        dispatch({ type: 'SET_INPUT', payload: '' })
      }
      return
    }

    // Escape - 停止生成
    if (e.key === 'Escape') {
      e.preventDefault()
      if (state.isLoading) {
        onStopGeneration()
      }
      return
    }

    // Ctrl+N - 新建对话
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault()
      onCreateConversation?.()
      return
    }

    // Ctrl+L - 聚焦输入框
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault()
      focusInput()
      return
    }



    // Ctrl+K - 清空消息
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault()
      if (confirm('确定要清空所有消息吗？')) {
        dispatch({ type: 'CLEAR_MESSAGES' })
      }
      return
    }
  }, [state.input, state.isLoading, dispatch, onSendMessage, onStopGeneration, onCreateConversation, focusInput])

  /**
   * 自动滚动到底部（当有新消息时）
   */
  useEffect(() => {
    const currentMessageCount = state.messages.length
    const hasNewMessage = currentMessageCount > lastMessageCountRef.current
    
    if (hasNewMessage) {
      // 延迟滚动，确保 DOM 已更新
      setTimeout(() => scrollToBottom(), 100)
    }
    
    lastMessageCountRef.current = currentMessageCount
  }, [state.messages.length, scrollToBottom])

  /**
   * 自动聚焦输入框（当加载完成时）
   */
  useEffect(() => {
    if (!state.isLoading) {
      // 延迟聚焦，避免与其他操作冲突
      setTimeout(() => focusInput(), 100)
    }
  }, [state.isLoading, focusInput])

  /**
   * 键盘事件监听
   */
  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts)
    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts)
    }
  }, [handleKeyboardShortcuts])

  /**
   * 模板注入事件监听
   */
  useEffect(() => {
    const handleTemplateInject = (e: CustomEvent) => {
      if (!e?.detail?.content) return
      dispatch({ type: 'SET_INPUT', payload: String(e.detail.content) })
      focusInput()
    }

    window.addEventListener('inject-chat-input', handleTemplateInject as EventListener)
    return () => {
      window.removeEventListener('inject-chat-input', handleTemplateInject as EventListener)
    }
  }, [dispatch, focusInput])

  /**
   * 选中文本处理
   */
  useEffect(() => {
    const handleTextSelection = () => {
      const selection = window.getSelection()
      const selectedText = selection?.toString().trim()
      
      if (selectedText && selectedText.length > 0 && selectedText.length < 1000) {
        // 可以在这里触发快捷操作提示
        // 暂时不自动设置输入，让用户主动选择操作
      }
    }

    document.addEventListener('mouseup', handleTextSelection)
    document.addEventListener('keyup', handleTextSelection)
    
    return () => {
      document.removeEventListener('mouseup', handleTextSelection)
      document.removeEventListener('keyup', handleTextSelection)
    }
  }, [])

  /**
   * 页面可见性变化处理
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 页面重新可见时，聚焦输入框
        focusInput()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [focusInput])

  /**
   * 窗口大小变化处理
   */
  useEffect(() => {
    const handleResize = () => {
      // 窗口大小变化时，重新滚动到底部
      setTimeout(() => scrollToBottom(false), 100)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [scrollToBottom])

  /**
   * 错误处理副作用
   */
  useEffect(() => {
    if (state.error) {
      // 错误发生时，聚焦输入框让用户可以重试
      focusInput()

      // 可以在这里添加错误上报逻辑
      console.error('Chat error:', state.error)
    }
  }, [state.error, focusInput])

  /**
   * 性能监控
   */
  useEffect(() => {
    // 监控消息渲染性能
    if (state.messages.length > 0) {
      const startTime = performance.now()
      
      // 使用 requestAnimationFrame 确保 DOM 更新完成
      requestAnimationFrame(() => {
        const endTime = performance.now()
        const renderTime = endTime - startTime

        // 如果渲染时间过长，可以考虑优化
        if (renderTime > 100) {
          console.warn(`Message rendering took ${renderTime}ms, consider optimization`)
        }
      })
    }
  }, [state.messages])

  return {
    scrollToBottom,
    focusInput,
    handleKeyboardShortcuts,
    scrollAreaRef,
    textareaRef
  }
}

/**
 * 防抖 Hook
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * 节流 Hook
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(Date.now())

  return useCallback((...args: Parameters<T>) => {
    if (Date.now() - lastRun.current >= delay) {
      callback(...args)
      lastRun.current = Date.now()
    }
  }, [callback, delay]) as T
}
