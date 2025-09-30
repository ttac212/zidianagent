/**
 * 聊天状态管理 Hook
 * 使用统一的 chatReducer，消除重复定义
 */

import { useReducer } from 'react'
import type {
  ChatState,
  ChatAction,
  UseChatStateReturn
} from '@/types/chat'
import { DEFAULT_CHAT_STATE } from '@/types/chat'
import { chatReducer } from '@/components/chat/chat-reducer'

/**
 * 聊天状态管理 Hook
 * @param initialState 初始状态
 * @returns 状态和 dispatch 函数
 */
export function useChatState(initialState?: Partial<ChatState>): UseChatStateReturn {
  const [state, dispatch] = useReducer(
    chatReducer,
    { ...DEFAULT_CHAT_STATE, ...initialState }
  )

  return { state, dispatch }
}