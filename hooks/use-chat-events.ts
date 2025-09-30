/**
 * 聊天外部事件 Hook
 * 处理模板注入、文本选择等外部事件
 */

import { useEffect, useCallback } from 'react'
import type { ChatAction } from '@/types/chat'

interface UseChatEventsProps {
  dispatch: React.Dispatch<ChatAction>
  onFocusInput?: () => void
  onTextSelected?: (text: string) => void
}

export function useChatEvents({
  dispatch,
  onFocusInput,
  onTextSelected
}: UseChatEventsProps) {
  /**
   * 处理模板注入事件
   */
  const handleTemplateInject = useCallback((e: CustomEvent) => {
    if (!e?.detail?.content) return

    // 更新输入框内容
    dispatch({
      type: 'SET_INPUT',
      payload: String(e.detail.content)
    })

    // 聚焦输入框
    onFocusInput?.()
  }, [dispatch, onFocusInput])

  /**
   * 处理文本选择
   */
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection()
    const selectedText = selection?.toString().trim()

    // 有效选择：非空且长度合理
    if (selectedText && selectedText.length > 0 && selectedText.length < 1000) {
      onTextSelected?.(selectedText)
    }
  }, [onTextSelected])

  /**
   * 注册模板注入事件监听
   */
  useEffect(() => {
    const listener = handleTemplateInject as EventListener
    window.addEventListener('inject-chat-input', listener)
    return () => window.removeEventListener('inject-chat-input', listener)
  }, [handleTemplateInject])

  /**
   * 注册文本选择事件监听
   */
  useEffect(() => {
    // 鼠标和键盘都可能触发选择
    document.addEventListener('mouseup', handleTextSelection)
    document.addEventListener('keyup', handleTextSelection)

    return () => {
      document.removeEventListener('mouseup', handleTextSelection)
      document.removeEventListener('keyup', handleTextSelection)
    }
  }, [handleTextSelection])

  /**
   * 触发模板注入（供外部调用）
   */
  const injectTemplate = useCallback((content: string) => {
    const event = new CustomEvent('inject-chat-input', {
      detail: { content }
    })
    window.dispatchEvent(event)
  }, [])

  return {
    injectTemplate,
    handleTemplateInject,
    handleTextSelection
  }
}