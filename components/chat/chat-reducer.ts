/**
 * 统一的聊天状态管理 Reducer
 * 精简版本 - 使用消息状态替代分离的预览内容
 */

import type {
  ChatState,
  ChatAction,
  ChatMessage,
  ChatSessionState,
  ChatSessionStatus,
  MessageMetadata
} from '@/types/chat'
import { DEFAULT_CHAT_STATE } from '@/types/chat'
import * as dt from '@/lib/utils/date-toolkit'

type LegacyResponsePhase = 'idle' | 'queueing' | 'organizing' | 'requesting' | 'responding'

const LEGACY_PHASE_STATUS_MAP: Record<LegacyResponsePhase, ChatSessionStatus> = {
  idle: 'idle',
  queueing: 'preparing',
  organizing: 'preparing',
  requesting: 'requesting',
  responding: 'streaming'
}

const now = () => dt.timestamp()

function mergeSessionState(
  current: ChatSessionState,
  updates: Partial<ChatSessionState>
): ChatSessionState {
  if (updates.sync) {
    const { sync, ...rest } = updates

    return {
      ...current,
      ...rest,
      sync: {
        ...current.sync,
        ...sync
      }
    }
  }

  return {
    ...current,
    ...updates
  }
}

function mapLegacyPhaseToStatus(phase: LegacyResponsePhase): ChatSessionStatus {
  return LEGACY_PHASE_STATUS_MAP[phase] ?? 'idle'
}

/**
 * 工具函数：更新指定消息，避免重复的 map 样板代码
 */
function updateMessageById(
  state: ChatState,
  messageId: string,
  updater: (msg: ChatMessage) => ChatMessage
): ChatState {
  return {
    ...state,
    history: {
      ...state.history,
      messages: state.history.messages.map(msg =>
        msg.id === messageId ? updater(msg) : msg
      )
    }
  }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SESSION_SET_CONVERSATION': {
      const nextId = action.payload.conversationId

      if (state.session.conversationId === nextId) {
        return state
      }

      return {
        ...state,
        session: mergeSessionState(state.session, {
          conversationId: nextId,
          status: 'idle',
          error: null,
          updatedAt: now(),
          sync: {
            conversationId: null,
            status: nextId ? 'idle' : 'synced'
          }
        }),
        history: {
          messages: [],
          pagination: {
            hasMoreBefore: false,
            cursor: null
          }
        },
        composer: {
          ...state.composer,
          input: '',
          editingTitle: false,
          tempTitle: ''
        }
      }
    }

    case 'SESSION_SYNC_STATE': {
      const { conversationId, status } = action.payload

      return {
        ...state,
        session: mergeSessionState(state.session, {
          sync: {
            conversationId,
            status
          },
          updatedAt: now()
        })
      }
    }

    case 'SESSION_TRANSITION': {
      const { status, error, updatedAt, conversationId } = action.payload
      const nextUpdates: Partial<ChatSessionState> = {
        status,
        error: typeof error !== 'undefined'
          ? error
          : status === 'error'
            ? state.session.error
            : null,
        updatedAt: updatedAt ?? now()
      }

      if (typeof conversationId !== 'undefined') {
        nextUpdates.conversationId = conversationId
      }

      return {
        ...state,
        session: mergeSessionState(state.session, nextUpdates)
      }
    }

    case 'SESSION_SET_ERROR': {
      const err = action.payload

      if (!err) {
        const nextStatus = state.session.status === 'error' ? 'idle' : state.session.status

        return {
          ...state,
          session: mergeSessionState(state.session, {
            error: null,
            status: nextStatus,
            updatedAt: now()
          })
        }
      }

      return {
        ...state,
        session: mergeSessionState(state.session, {
          error: err,
          status: 'error',
          updatedAt: now()
        })
      }
    }

    case 'SESSION_RESET': {
      const keepConversation = action.payload?.keepConversation ?? false
      const keepComposer = action.payload?.keepComposer ?? true

      const sessionUpdates: Partial<ChatSessionState> = keepConversation
        ? {
            conversationId: state.session.conversationId,
            sync: {
              conversationId: null,
              status: 'idle'
            }
          }
        : {}

      return {
        session: mergeSessionState(DEFAULT_CHAT_STATE.session, sessionUpdates),
        history: {
          messages: [],
          pagination: {
            hasMoreBefore: false,
            cursor: null
          }
        },
        composer: {
          ...DEFAULT_CHAT_STATE.composer,
          settings: { ...state.composer.settings },
          input: keepComposer ? '' : DEFAULT_CHAT_STATE.composer.input
        }
      }
    }

    case 'SET_INPUT':
      return {
        ...state,
        composer: {
          ...state.composer,
          input: action.payload
        }
      }

    case 'SET_SETTINGS':
      return {
        ...state,
        composer: {
          ...state.composer,
          settings: {
            ...state.composer.settings,
            ...action.payload
          }
        }
      }

    case 'SET_EDITING_TITLE':
      return {
        ...state,
        composer: {
          ...state.composer,
          editingTitle: action.payload
        }
      }

    case 'SET_TEMP_TITLE':
      return {
        ...state,
        composer: {
          ...state.composer,
          tempTitle: action.payload
        }
      }

    case 'ADD_MESSAGE': {
      const exists = state.history.messages.some(message => message.id === action.payload.id)
      const messages = exists
        ? state.history.messages.map(message =>
            message.id === action.payload.id ? action.payload : message
          )
        : [...state.history.messages, action.payload]

      return {
        ...state,
        history: {
          ...state.history,
          messages
        },
        session: mergeSessionState(state.session, { error: null })
      }
    }

    case 'UPDATE_MESSAGE':
      return {
        ...state,
        history: {
          ...state.history,
          messages: state.history.messages.map(message =>
            message.id === action.payload.id
              ? { ...message, ...action.payload.updates }
              : message
          )
        }
      }

    case 'SET_MESSAGES':
      return {
        ...state,
        history: {
          ...state.history,
          messages: action.payload.slice()
        }
      }

    case 'PREPEND_MESSAGES': {
      if (!action.payload.length) {
        return state
      }

      const existingIds = new Set(state.history.messages.map(message => message.id))
      const uniqueMessages = action.payload.filter(message => !existingIds.has(message.id))

      if (!uniqueMessages.length) {
        return state
      }

      return {
        ...state,
        history: {
          ...state.history,
          messages: [...uniqueMessages, ...state.history.messages]
        }
      }
    }

    case 'CLEAR_MESSAGES':
      return {
        ...state,
        history: {
          ...state.history,
          messages: []
        }
      }

    case 'REMOVE_MESSAGE': {
      const nextMessages = state.history.messages.filter(
        message => message.id !== action.payload.messageId
      )

      if (nextMessages.length === state.history.messages.length) {
        return state
      }

      return {
        ...state,
        history: {
          ...state.history,
          messages: nextMessages
        },
        session: mergeSessionState(state.session, {
          status: state.session.status === 'error' ? 'error' : 'idle',
          updatedAt: now()
        })
      }
    }

    case 'SET_HISTORY_PAGINATION': {
      const { hasMoreBefore, cursor } = action.payload
      const nextCursor =
        typeof cursor === 'undefined'
          ? state.history.pagination.cursor
          : cursor
            ? { beforeId: cursor.beforeId ?? null }
            : null

      return {
        ...state,
        history: {
          ...state.history,
          pagination: {
            hasMoreBefore,
            cursor: nextCursor
          }
        }
      }
    }

    case 'UPDATE_MESSAGE_STREAM': {
      const { messageId, content, delta, status, metadata, reasoning } = action.payload

      return {
        ...state,
        history: {
          ...state.history,
          messages: state.history.messages.map(message => {
            if (message.id !== messageId) {
              return message
            }

            const updatedMessage: ChatMessage = { ...message, status }

            if (content !== undefined) {
              updatedMessage.content = content
            } else if (delta !== undefined && status === 'streaming') {
              updatedMessage.content = (message.content || '') + delta
            }

            if (metadata) {
              updatedMessage.metadata = { ...message.metadata, ...metadata }
            }

             if (reasoning !== undefined) {
               updatedMessage.reasoning = reasoning
             }

            if (status === 'completed') {
              updatedMessage.timestamp = now()
            }

            return updatedMessage
          })
        }
      }
    }

    case 'UPDATE_PIPELINE_STATE': {
      const { messageId, pipelineStateId, source, role, status, error, linkedMessageId } = action.payload

      return updateMessageById(state, messageId, msg => {
        const nextMetadata: MessageMetadata = {
          ...(msg.metadata ?? {})
        }

        if (pipelineStateId !== undefined) {
          if (pipelineStateId === null) {
            delete nextMetadata.pipelineStateId
          } else {
            nextMetadata.pipelineStateId = pipelineStateId
          }
        }

        if (source !== undefined) {
          nextMetadata.pipelineSource = source
        }

        if (role !== undefined) {
          nextMetadata.pipelineRole = role
        }

        if (linkedMessageId !== undefined) {
          if (linkedMessageId === null) {
            delete nextMetadata.pipelineLinkedMessageId
          } else {
            nextMetadata.pipelineLinkedMessageId = linkedMessageId
          }
        }

        if (error !== undefined) {
          if (error === null) {
            delete nextMetadata.error
          } else {
            nextMetadata.error = error
          }
        }

        const nextMessage: ChatMessage = {
          ...msg,
          status: status ?? msg.status
        }

        if (Object.keys(nextMetadata).length > 0) {
          nextMessage.metadata = nextMetadata
        } else if (nextMessage.metadata) {
          delete nextMessage.metadata
        }

        return nextMessage
      })
    }

    case 'SET_LOADING': {
      const isLoading = action.payload
      const nextStatus = isLoading
        ? state.session.status === 'streaming'
          ? 'streaming'
          : 'preparing'
        : state.session.status === 'error'
          ? 'error'
          : 'idle'

      return {
        ...state,
        session: mergeSessionState(state.session, {
          status: nextStatus,
          error: isLoading ? null : state.session.error,
          updatedAt: now()
        })
      }
    }

    case 'SET_ERROR':
      return chatReducer(state, { type: 'SESSION_SET_ERROR', payload: action.payload })

    case 'SET_RESPONSE_PHASE': {
      const status = mapLegacyPhaseToStatus(action.payload)

      return {
        ...state,
        session: mergeSessionState(state.session, {
          status,
          error: status === 'idle' ? state.session.error : null,
          updatedAt: now()
        })
      }
    }

    case 'RESET_STATE':
      return chatReducer(state, { type: 'SESSION_RESET', payload: { keepComposer: true } })

    default:
      return state
  }
}
