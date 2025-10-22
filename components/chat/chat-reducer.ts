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
  DouyinDoneEventPayload,
  DouyinInfoEventPayload,
  DouyinPartialEventPayload,
  DouyinProgressEventPayload,
  DouyinProgressState,
  DouyinCommentsDoneEventPayload,
  DouyinCommentsInfoEventPayload,
  DouyinCommentsPartialEventPayload,
  DouyinCommentsProgressEventPayload,
  DouyinCommentsProgressState
} from '@/types/chat'
import { DEFAULT_CHAT_STATE } from '@/types/chat'
import type { DouyinPipelineStep } from '@/lib/douyin/pipeline-steps'
import { DOUYIN_PIPELINE_STEPS } from '@/lib/douyin/pipeline-steps'
import type { DouyinCommentsPipelineStep } from '@/lib/douyin/comments-pipeline-steps'
import { DOUYIN_COMMENTS_PIPELINE_STEPS } from '@/lib/douyin/comments-pipeline-steps'
import * as dt from '@/lib/utils/date-toolkit'

function createInitialDouyinProgressState(): DouyinProgressState {
  return {
    steps: DOUYIN_PIPELINE_STEPS.map(step => ({
      key: step.key,
      status: 'pending' as const
    })),
    percentage: 0,
    status: 'running',
    updatedAt: Date.now()
  }
}

/**
 * 克隆抖音进度状态 - 优化版
 * 原则：只拷贝真正需要修改的部分，保持未修改部分的引用稳定
 */
function cloneDouyinProgressState(state?: DouyinProgressState): DouyinProgressState {
  if (!state) {
    return createInitialDouyinProgressState()
  }

  // 不再深拷贝steps，返回浅拷贝
  // 调用者负责只在需要时创建新的step对象
  return {
    ...state,
    updatedAt: Date.now()
  }
}

function applyDouyinProgressUpdate(
  previous: DouyinProgressState | undefined,
  progress: DouyinProgressEventPayload
): DouyinProgressState {
  const next = cloneDouyinProgressState(previous)

  // 优化：只拷贝需要修改的step，保持其他step的引用
  next.steps = next.steps.map((step, idx) => {
    if (idx < progress.index) {
      // 前面的步骤：只有状态不是completed时才需要更新
      return step.status === 'completed' ? step : { ...step, status: 'completed' }
    }

    if (idx === progress.index) {
      // 当前步骤：总是需要更新
      return {
        ...step,
        status: progress.status === 'completed' ? 'completed' : 'active',
        detail: progress.detail ?? step.detail,
        labelOverride: progress.label ?? step.labelOverride,
        descriptionOverride: progress.description ?? step.descriptionOverride
      }
    }

    // 后面的步骤：如果已完成保持不变，否则设为pending
    if (step.status === 'completed') {
      return step
    }

    return step.status === 'pending' ? step : { ...step, status: 'pending' }
  })

  next.percentage = Math.max(next.percentage, progress.percentage)
  next.status =
    progress.status === 'completed' && progress.index === progress.total - 1
      ? 'completed'
      : 'running'
  next.error = undefined
  next.updatedAt = Date.now()

  return next
}

function applyDouyinInfoUpdate(
  previous: DouyinProgressState | undefined,
  info: DouyinInfoEventPayload
): DouyinProgressState {
  const next = cloneDouyinProgressState(previous)
  next.videoInfo = info.videoInfo
  next.updatedAt = Date.now()
  return next
}

function applyDouyinPartialUpdate(
  previous: DouyinProgressState | undefined,
  partial: DouyinPartialEventPayload
): DouyinProgressState {
  const next = cloneDouyinProgressState(previous)
  if (partial.key === 'markdown') {
    next.markdownPreview = partial.append
      ? `${next.markdownPreview ?? ''}${partial.data}`
      : partial.data
  } else if (partial.key === 'transcript') {
    // 支持流式转录
    next.transcript = partial.append
      ? `${next.transcript ?? ''}${partial.data}`
      : partial.data
  }
  next.updatedAt = Date.now()
  return next
}

function applyDouyinDoneUpdate(
  previous: DouyinProgressState | undefined,
  result: DouyinDoneEventPayload
): DouyinProgressState {
  const next = cloneDouyinProgressState(previous)
  next.steps = next.steps.map(step => ({ ...step, status: 'completed' }))
  next.percentage = 100
  next.status = 'completed'
  next.error = undefined
  next.videoInfo = result.videoInfo
  next.transcript = result.transcript
  next.markdownPreview = result.markdown
  next.updatedAt = Date.now()
  return next
}

function applyDouyinErrorUpdate(
  previous: DouyinProgressState | undefined,
  errorMessage: string,
  failedStep?: DouyinPipelineStep
): DouyinProgressState {
  const next = cloneDouyinProgressState(previous)
  const steps = next.steps.map(step => ({ ...step }))

  let targetIndex = typeof failedStep !== 'undefined'
    ? steps.findIndex(step => step.key === failedStep)
    : -1

  if (targetIndex === -1) {
    targetIndex = steps.findIndex(step => step.status === 'active')
  }

  if (targetIndex === -1) {
    targetIndex = steps.findIndex(step => step.status !== 'completed')
  }

  next.steps = steps.map((step, idx) => {
    if (idx === targetIndex) {
      return { ...step, status: 'error', detail: errorMessage }
    }

    if (idx > targetIndex && step.status !== 'completed') {
      return { ...step, status: 'pending' }
    }

    return step
  })

  next.status = 'failed'
  next.error = errorMessage
  next.updatedAt = Date.now()

  return next
}

// ===== 抖音评论分析辅助函数 =====

function createInitialCommentsProgressState(): DouyinCommentsProgressState {
  return {
    steps: DOUYIN_COMMENTS_PIPELINE_STEPS.map(step => ({
      key: step.key,
      status: 'pending' as const
    })),
    percentage: 0,
    status: 'running',
    updatedAt: Date.now()
  }
}

/**
 * 克隆评论进度状态 - 优化版
 */
function cloneCommentsProgressState(
  state?: DouyinCommentsProgressState | null
): DouyinCommentsProgressState {
  if (!state) {
    return createInitialCommentsProgressState()
  }

  // 确保steps结构正确，但避免不必要的深拷贝
  const stepMap = new Map((state.steps ?? []).map(step => [step.key, step]))
  const baseSteps = DOUYIN_COMMENTS_PIPELINE_STEPS

  return {
    ...state,
    // 只在steps结构不完整时重建，否则保持引用
    steps: state.steps?.length === baseSteps.length
      ? state.steps
      : baseSteps.map(base => {
          const existing = stepMap.get(base.key)
          return existing ?? {
            key: base.key,
            status: 'pending' as const,
            detail: undefined
          }
        }),
    updatedAt: Date.now()
  }
}

function applyCommentsProgressUpdate(
  previous: DouyinCommentsProgressState | undefined,
  progress: DouyinCommentsProgressEventPayload
): DouyinCommentsProgressState {
  const next = cloneCommentsProgressState(previous)

  // 优化：只拷贝需要修改的step
  next.steps = next.steps.map((step, idx) => {
    if (idx < progress.index) {
      return step.status === 'completed' ? step : { ...step, status: 'completed' }
    }

    if (idx === progress.index) {
      const status =
        progress.status === 'error'
          ? 'error'
          : progress.status === 'completed'
            ? 'completed'
            : 'active'

      return {
        ...step,
        status,
        detail: progress.detail ?? step.detail,
        labelOverride: progress.label ?? step.labelOverride,
        descriptionOverride: progress.description ?? step.descriptionOverride
      }
    }

    if (step.status === 'completed') {
      return step
    }

    return step.status === 'pending' ? step : { ...step, status: 'pending' }
  })

  next.percentage = Math.max(next.percentage, progress.percentage ?? 0)

  if (progress.status === 'error') {
    next.status = 'failed'
    next.error = progress.detail
  } else if (progress.status === 'completed' && progress.index >= progress.total - 1) {
    next.status = 'completed'
    next.error = undefined
  } else {
    next.status = 'running'
    next.error = undefined
  }

  next.updatedAt = Date.now()
  return next
}

function applyCommentsInfoUpdate(
  previous: DouyinCommentsProgressState | undefined,
  info: DouyinCommentsInfoEventPayload
): DouyinCommentsProgressState {
  const next = cloneCommentsProgressState(previous)
  next.videoInfo = info.videoInfo
  next.statistics = info.statistics ?? next.statistics
  next.updatedAt = Date.now()
  return next
}

function applyCommentsPartialUpdate(
  previous: DouyinCommentsProgressState | undefined,
  partial: DouyinCommentsPartialEventPayload
): DouyinCommentsProgressState {
  const next = cloneCommentsProgressState(previous)

  if (partial.key === 'analysis') {
    next.analysisPreview = partial.append
      ? `${next.analysisPreview ?? ''}${partial.data}`
      : partial.data
  }

  next.updatedAt = Date.now()
  return next
}

function applyCommentsDoneUpdate(
  previous: DouyinCommentsProgressState | undefined,
  payload: DouyinCommentsDoneEventPayload
): DouyinCommentsProgressState {
  const next = cloneCommentsProgressState(previous)
  next.steps = next.steps.map(step => ({ ...step, status: 'completed' }))
  next.percentage = 100
  next.status = 'completed'
  next.error = undefined
  next.videoInfo = payload.videoInfo
  next.statistics = payload.statistics
  next.updatedAt = Date.now()
  return next
}

function applyCommentsErrorUpdate(
  previous: DouyinCommentsProgressState | undefined,
  errorMessage: string,
  failedStep?: DouyinCommentsPipelineStep
): DouyinCommentsProgressState {
  const next = cloneCommentsProgressState(previous)
  const steps = next.steps.map(step => ({ ...step }))

  let targetIndex = typeof failedStep !== 'undefined'
    ? steps.findIndex(step => step.key === failedStep)
    : -1

  if (targetIndex === -1) {
    targetIndex = steps.findIndex(step => step.status === 'active')
  }

  if (targetIndex === -1) {
    targetIndex = steps.findIndex(step => step.status !== 'completed')
  }

  next.steps = steps.map((step, idx) => {
    if (idx === targetIndex) {
      return { ...step, status: 'error', detail: errorMessage }
    }

    if (idx > targetIndex && step.status !== 'completed') {
      return { ...step, status: 'pending' }
    }

    return step
  })

  next.status = 'failed'
  next.error = errorMessage
  next.updatedAt = Date.now()

  return next
}

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
      const { messageId, content, delta, status, metadata } = action.payload

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

            if (status === 'completed') {
              updatedMessage.timestamp = now()
            }

            return updatedMessage
          })
        }
      }
    }

    case 'UPDATE_DOUYIN_PROGRESS': {
      return updateMessageById(state, action.payload.messageId, msg => {
        const nextProgress = applyDouyinProgressUpdate(
          msg.metadata?.douyinProgress,
          action.payload.progress
        )
        const nextStatus = nextProgress.status === 'failed'
          ? 'error'
          : nextProgress.status === 'completed'
            ? 'completed'
            : 'streaming'

        return {
          ...msg,
          metadata: { ...msg.metadata, douyinProgress: nextProgress },
          status: nextStatus
        }
      })
    }

    case 'UPDATE_DOUYIN_INFO':
      return updateMessageById(state, action.payload.messageId, msg => ({
        ...msg,
        metadata: {
          ...msg.metadata,
          douyinProgress: applyDouyinInfoUpdate(
            msg.metadata?.douyinProgress,
            action.payload.info
          )
        }
      }))

    case 'UPDATE_DOUYIN_PARTIAL':
      return updateMessageById(state, action.payload.messageId, msg => ({
        ...msg,
        metadata: {
          ...msg.metadata,
          douyinProgress: applyDouyinPartialUpdate(
            msg.metadata?.douyinProgress,
            action.payload.data
          )
        }
      }))

    case 'UPDATE_DOUYIN_DONE':
      return updateMessageById(state, action.payload.messageId, msg => ({
        ...msg,
        metadata: {
          ...msg.metadata,
          douyinProgress: applyDouyinDoneUpdate(
            msg.metadata?.douyinProgress,
            action.payload.result
          )
        },
        status: 'completed'
      }))

    case 'UPDATE_DOUYIN_ERROR':
      return updateMessageById(state, action.payload.messageId, msg => ({
        ...msg,
        metadata: {
          ...msg.metadata,
          douyinProgress: applyDouyinErrorUpdate(
            msg.metadata?.douyinProgress,
            action.payload.error,
            action.payload.step
          )
        },
        status: 'error'
      }))

    // ===== 评论分析 Actions =====

    case 'UPDATE_COMMENTS_PROGRESS': {
      return updateMessageById(state, action.payload.messageId, msg => {
        const nextProgress = applyCommentsProgressUpdate(
          msg.metadata?.commentsProgress,
          action.payload.progress
        )
        const nextStatus = nextProgress.status === 'failed'
          ? 'error'
          : nextProgress.status === 'completed'
            ? 'completed'
            : 'streaming'

        return {
          ...msg,
          metadata: { ...msg.metadata, commentsProgress: nextProgress },
          status: nextStatus
        }
      })
    }

    case 'UPDATE_COMMENTS_INFO':
      return updateMessageById(state, action.payload.messageId, msg => ({
        ...msg,
        metadata: {
          ...msg.metadata,
          commentsProgress: applyCommentsInfoUpdate(
            msg.metadata?.commentsProgress,
            action.payload.info
          )
        }
      }))

    case 'UPDATE_COMMENTS_PARTIAL':
      return updateMessageById(state, action.payload.messageId, msg => ({
        ...msg,
        metadata: {
          ...msg.metadata,
          commentsProgress: applyCommentsPartialUpdate(
            msg.metadata?.commentsProgress,
            action.payload.data
          )
        }
      }))

    case 'UPDATE_COMMENTS_DONE':
      return updateMessageById(state, action.payload.messageId, msg => ({
        ...msg,
        metadata: {
          ...msg.metadata,
          commentsProgress: applyCommentsDoneUpdate(
            msg.metadata?.commentsProgress,
            action.payload.result
          ),
          commentsResult: action.payload.result
        },
        status: 'completed'
      }))

    case 'UPDATE_COMMENTS_ERROR':
      return updateMessageById(state, action.payload.messageId, msg => ({
        ...msg,
        metadata: {
          ...msg.metadata,
          commentsProgress: applyCommentsErrorUpdate(
            msg.metadata?.commentsProgress,
            action.payload.error,
            action.payload.step
          )
        },
        status: 'error'
      }))

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
