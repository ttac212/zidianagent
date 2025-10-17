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

function createInitialChatState(initialState?: Partial<ChatState>): ChatState {
  const base: ChatState = {
    session: {
      ...DEFAULT_CHAT_STATE.session,
      sync: { ...DEFAULT_CHAT_STATE.session.sync }
    },
    history: {
      messages: [...DEFAULT_CHAT_STATE.history.messages],
      pagination: {
        hasMoreBefore: DEFAULT_CHAT_STATE.history.pagination.hasMoreBefore,
        cursor: DEFAULT_CHAT_STATE.history.pagination.cursor
          ? { ...DEFAULT_CHAT_STATE.history.pagination.cursor }
          : null
      }
    },
    composer: {
      ...DEFAULT_CHAT_STATE.composer,
      settings: { ...DEFAULT_CHAT_STATE.composer.settings }
    }
  }

  if (!initialState) {
    return base
  }

  if (initialState.session) {
    base.session = {
      ...base.session,
      ...initialState.session,
      sync: initialState.session.sync
        ? { ...base.session.sync, ...initialState.session.sync }
        : base.session.sync
    }
  }

  if (initialState.history) {
    base.history = {
      ...base.history,
      ...initialState.history,
      messages: initialState.history.messages
        ? initialState.history.messages.slice()
        : base.history.messages,
      pagination: initialState.history.pagination
        ? {
            hasMoreBefore: initialState.history.pagination.hasMoreBefore,
            cursor: initialState.history.pagination.cursor
              ? { ...initialState.history.pagination.cursor }
              : null
          }
        : base.history.pagination
    }
  }

  if (initialState.composer) {
    base.composer = {
      ...base.composer,
      ...initialState.composer,
      settings: initialState.composer.settings
        ? { ...base.composer.settings, ...initialState.composer.settings }
        : base.composer.settings
    }
  }

  return base
}

/**
 * 聊天状态管理 Hook
 * @param initialState 初始状态
 * @returns 状态和 dispatch 函数
 */
export function useChatState(initialState?: Partial<ChatState>): UseChatStateReturn {
  const [state, dispatch] = useReducer(
    chatReducer,
    initialState,
    createInitialChatState
  )

  return { state, dispatch }
}
