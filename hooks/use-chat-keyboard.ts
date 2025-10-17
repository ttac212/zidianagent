/**
 * 聊天键盘快捷键 Hook
 * 负责处理所有键盘快捷键
 */

import { useCallback, useEffect } from 'react'
import type { ChatState } from '@/types/chat'
import { selectComposerInput, selectIsSessionBusy } from '@/lib/chat/chat-state-selectors'

interface UseChatKeyboardProps {
  state: ChatState
  onSendMessage?: () => void
  onStopGeneration?: () => void
  onCreateConversation?: () => void
  onClearMessages?: () => void
  onFocusInput?: () => void
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
}

interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  description: string
  action: () => void
}

export function useChatKeyboard({
  state,
  onSendMessage,
  onStopGeneration,
  onCreateConversation,
  onClearMessages,
  onFocusInput,
  textareaRef
}: UseChatKeyboardProps) {
  const inputValue = selectComposerInput(state)
  const isBusy = selectIsSessionBusy(state)

  /**
   * 处理键盘快捷键
   */
  const handleKeyboardShortcuts = useCallback((e: KeyboardEvent) => {
    // 跳过中文输入法
    if (e.isComposing) return

    const shortcuts: KeyboardShortcut[] = [
      {
        key: 'Enter',
        ctrl: true,
        description: '发送消息',
        action: () => {
          // 通过表单提交，避免重复发送
          const form = textareaRef?.current?.closest('form')
          if (form && inputValue.trim() && !isBusy) {
            form.requestSubmit()
          }
        }
      },
      {
        key: 'Escape',
        description: '停止生成',
        action: () => {
          if (isBusy && onStopGeneration) {
            onStopGeneration()
          }
        }
      },
      {
        key: 'n',
        ctrl: true,
        description: '新建对话',
        action: () => onCreateConversation?.()
      },
      {
        key: 'l',
        ctrl: true,
        description: '聚焦输入框',
        action: () => onFocusInput?.()
      },
      {
        key: 'k',
        ctrl: true,
        description: '清空消息',
        action: () => {
          if (confirm('确定要清空所有消息吗？')) {
            onClearMessages?.()
          }
        }
      }
    ]

    // 查找匹配的快捷键
    const shortcut = shortcuts.find(s => {
      if (s.key.toLowerCase() !== e.key.toLowerCase()) return false
      if (s.ctrl !== undefined && s.ctrl !== e.ctrlKey) return false
      if (s.alt !== undefined && s.alt !== e.altKey) return false
      if (s.shift !== undefined && s.shift !== e.shiftKey) return false
      return true
    })

    if (shortcut) {
      e.preventDefault()
      shortcut.action()
    }
  }, [
    inputValue,
    isBusy,
    onSendMessage,
    onStopGeneration,
    onCreateConversation,
    onClearMessages,
    onFocusInput,
    textareaRef
  ])

  /**
   * 注册键盘事件监听
   */
  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts)
    return () => document.removeEventListener('keydown', handleKeyboardShortcuts)
  }, [handleKeyboardShortcuts])

  // 快捷键列表（用于帮助文档）
  const shortcuts: Omit<KeyboardShortcut, 'action'>[] = [
    { key: 'Enter', ctrl: true, description: '发送消息' },
    { key: 'Escape', description: '停止生成' },
    { key: 'N', ctrl: true, description: '新建对话' },
    { key: 'L', ctrl: true, description: '聚焦输入框' },
    { key: 'K', ctrl: true, description: '清空消息' }
  ]

  return {
    handleKeyboardShortcuts,
    shortcuts
  }
}
