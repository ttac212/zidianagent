/**
 * 聊天滚动管理 Hook
 * 负责消息列表的滚动行为
 */

import { useRef, useCallback, useEffect } from 'react'

interface UseChatScrollProps {
  messages: any[]
  isLoading?: boolean
}

export function useChatScroll({ messages, isLoading }: UseChatScrollProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const lastMessageCountRef = useRef(messages.length)
  const autoScrollEnabledRef = useRef(true)

  /**
   * 滚动到底部
   */
  const scrollToBottom = useCallback((smooth = true) => {
    if (!scrollAreaRef.current) return

    const scrollContainer = scrollAreaRef.current.querySelector(
      "[data-radix-scroll-area-viewport]"
    )

    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      })
    }
  }, [])

  /**
   * 检查是否在底部附近
   */
  const isNearBottom = useCallback(() => {
    if (!scrollAreaRef.current) return true

    const scrollContainer = scrollAreaRef.current.querySelector(
      "[data-radix-scroll-area-viewport]"
    )

    if (!scrollContainer) return true

    const threshold = 100
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer
    return scrollTop + clientHeight >= scrollHeight - threshold
  }, [])

  /**
   * 自动滚动到底部（新消息时）
   */
  useEffect(() => {
    const currentMessageCount = messages.length
    const hasNewMessage = currentMessageCount > lastMessageCountRef.current

    if (hasNewMessage && autoScrollEnabledRef.current) {
      // 延迟滚动，确保DOM更新
      const timer = setTimeout(() => scrollToBottom(), 100)
      lastMessageCountRef.current = currentMessageCount

      return () => clearTimeout(timer)
    }

    lastMessageCountRef.current = currentMessageCount
  }, [messages.length, scrollToBottom])

  /**
   * 监听用户滚动，判断是否禁用自动滚动
   */
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    )

    if (!scrollContainer) return

    const handleScroll = () => {
      // 如果用户主动滚动到非底部，禁用自动滚动
      autoScrollEnabledRef.current = isNearBottom()
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [isNearBottom])

  /**
   * 窗口大小变化时重新滚动
   */
  useEffect(() => {
    let resizeTimer: NodeJS.Timeout

    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => scrollToBottom(false), 100)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimer)
    }
  }, [scrollToBottom])

  return {
    scrollAreaRef,
    scrollToBottom,
    isNearBottom
  }
}