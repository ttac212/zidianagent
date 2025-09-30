/**
 * 统一的聊天状态管理 Reducer
 * 精简版本 - 使用消息状态替代分离的预览内容
 */

import type { ChatState, ChatAction, ChatMessage } from '@/types/chat'
import { DEFAULT_CHAT_STATE } from '@/types/chat'
import * as dt from '@/lib/utils/date-toolkit'

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_INPUT':
      return { ...state, input: action.payload }

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false }

    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        error: null
      }

    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(m =>
          m.id === action.payload.id
            ? { ...m, ...action.payload.updates }
            : m
        )
      }

    case 'SET_MESSAGES':
      return { ...state, messages: action.payload }

    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] }

    case 'SET_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload }
      }

    case 'SET_EDITING_TITLE':
      return { ...state, editingTitle: action.payload }

    case 'SET_TEMP_TITLE':
      return { ...state, tempTitle: action.payload }

    case 'SET_RESPONSE_PHASE':
      return { ...state, responsePhase: action.payload }

    // 新的统一流式更新 action
    case 'UPDATE_MESSAGE_STREAM':
      const { messageId, content, delta, status, metadata } = action.payload

      return {
        ...state,
        messages: state.messages.map(m => {
          if (m.id !== messageId) return m

          const updatedMessage: ChatMessage = { ...m }

          // 更新状态
          updatedMessage.status = status

          // 更新内容：如果提供了完整content则使用，否则追加delta
          if (content !== undefined) {
            updatedMessage.content = content
          } else if (delta !== undefined && status === 'streaming') {
            updatedMessage.content = (m.content || '') + delta
          }

          // 更新元数据
          if (metadata) {
            updatedMessage.metadata = { ...m.metadata, ...metadata }
          }

          // 完成时更新时间戳
          if (status === 'completed') {
            updatedMessage.timestamp = dt.timestamp()
          }

          return updatedMessage
        })
      }

    // 向后兼容：发送用户消息
    case 'SEND_USER_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        isLoading: true,
        responsePhase: 'responding',
        error: null,
        input: ''
      }

    // 向后兼容：移除消息
    case 'REMOVE_MESSAGE':
      return {
        ...state,
        messages: state.messages.filter(m => m.id !== action.payload.messageId),
        isLoading: false,
        responsePhase: 'idle'
      }

    case 'RESET_STATE':
      return { ...DEFAULT_CHAT_STATE, settings: state.settings }

    default:
      return state
  }
}