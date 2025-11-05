"use client"

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import type { ReactNode } from 'react'
import type {
  ChatEvent,
  DouyinCommentsDoneEventPayload,
  DouyinCommentsInfoEventPayload,
  DouyinCommentsPartialEventPayload,
  DouyinCommentsProgressEventPayload,
  DouyinCommentsProgressState,
  DouyinDoneEventPayload,
  DouyinInfoEventPayload,
  DouyinPartialEventPayload,
  DouyinProgressEventPayload,
  DouyinProgressState,
  MessageStatus,
  PipelineSource,
  PipelineStage
} from '@/types/chat'
import type { UnifiedPipelineEvent } from '@/lib/chat/events'
import { DOUYIN_PIPELINE_STEPS, type DouyinPipelineStep } from '@/lib/douyin/pipeline-steps'
import { DOUYIN_COMMENTS_PIPELINE_STEPS, type DouyinCommentsPipelineStep } from '@/lib/douyin/comments-pipeline-steps'

interface DouyinVideoPipelineState {
  id: string
  source: 'douyin-video'
  progress: DouyinProgressState
  result?: DouyinDoneEventPayload
  updatedAt: number
}

interface DouyinCommentsPipelineState {
  id: string
  source: 'douyin-comments'
  progress: DouyinCommentsProgressState
  result?: DouyinCommentsDoneEventPayload
  updatedAt: number
}

export type PipelineStateRecord = DouyinVideoPipelineState | DouyinCommentsPipelineState

interface PipelineStateStore {
  byId: Record<string, PipelineStateRecord>
}

type PipelineStateAction =
  | { type: 'SET'; record: PipelineStateRecord }
  | { type: 'REMOVE'; id: string }

interface PipelineStateContextValue {
  state: PipelineStateStore
  dispatch: React.Dispatch<PipelineStateAction>
}

const PipelineStateContext = createContext<PipelineStateContextValue | null>(null)

const INITIAL_STORE: PipelineStateStore = {
  byId: {}
}

function pipelineStateReducer(state: PipelineStateStore, action: PipelineStateAction): PipelineStateStore {
  switch (action.type) {
    case 'SET': {
      return {
        byId: {
          ...state.byId,
          [action.record.id]: action.record
        }
      }
    }
    case 'REMOVE': {
      if (!state.byId[action.id]) {
        return state
      }

      const next = { ...state.byId }
      delete next[action.id]

      return { byId: next }
    }
    default:
      return state
  }
}

export function PipelineStateProvider({ children }: { children: ReactNode }) {
  const [store, dispatch] = useReducer(pipelineStateReducer, INITIAL_STORE)
  const value = useMemo(() => ({ state: store, dispatch }), [store])

  return createElement(PipelineStateContext.Provider, { value }, children)
}

function usePipelineStoreContext(): PipelineStateContextValue {
  const context = useContext(PipelineStateContext)
  if (!context) {
    throw new Error('usePipelineState must be used within PipelineStateProvider')
  }
  return context
}

export function usePipelineState(pipelineStateId?: string | null): PipelineStateRecord | null {
  const { state } = usePipelineStoreContext()
  if (!pipelineStateId) {
    return null
  }
  return state.byId[pipelineStateId] ?? null
}

export function usePipelineStates(): PipelineStateStore['byId'] {
  const { state } = usePipelineStoreContext()
  return state.byId
}

function now(): number {
  return Date.now()
}

// ===== 抖音视频进度辅助函数 =====

function createInitialDouyinProgressState(): DouyinProgressState {
  return {
    steps: DOUYIN_PIPELINE_STEPS.map(step => ({
      key: step.key,
      status: 'pending' as const
    })),
    percentage: 0,
    status: 'running',
    updatedAt: now()
  }
}

function cloneDouyinProgressState(state?: DouyinProgressState): DouyinProgressState {
  if (!state) {
    return createInitialDouyinProgressState()
  }

  return {
    ...state,
    updatedAt: now()
  }
}

function applyDouyinProgressUpdate(
  previous: DouyinProgressState | undefined,
  progress: DouyinProgressEventPayload
): DouyinProgressState {
  const next = cloneDouyinProgressState(previous)

  next.steps = next.steps.map((step, idx) => {
    const original = DOUYIN_PIPELINE_STEPS[idx]

    if (idx < progress.index) {
      return step.status === 'completed' ? step : { ...step, status: 'completed' }
    }

    if (idx === progress.index) {
      return {
        ...step,
        status: progress.status === 'completed' ? 'completed' : 'active',
        detail: progress.detail ?? step.detail,
        labelOverride: progress.label ?? step.labelOverride ?? original.label,
        descriptionOverride: progress.description ?? step.descriptionOverride ?? original.description
      }
    }

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
  next.updatedAt = now()

  return next
}

function applyDouyinInfoUpdate(
  previous: DouyinProgressState | undefined,
  info: DouyinInfoEventPayload
): DouyinProgressState {
  const next = cloneDouyinProgressState(previous)
  next.videoInfo = info.videoInfo
  next.updatedAt = now()
  return next
}

function applyDouyinPartialUpdate(
  previous: DouyinProgressState | undefined,
  partial: DouyinPartialEventPayload
): DouyinProgressState {
  const next = cloneDouyinProgressState(previous)

  if (partial.key === 'markdown') {
    next.markdownPreview = partial.append === false
      ? partial.data
      : `${next.markdownPreview ?? ''}${partial.data}`
  } else if (partial.key === 'transcript') {
    next.transcript = partial.append === false
      ? partial.data
      : `${next.transcript ?? ''}${partial.data}`
  }

  next.updatedAt = now()
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
  next.updatedAt = now()
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
    const original = DOUYIN_PIPELINE_STEPS[idx]

    if (idx === targetIndex) {
      return { ...step, status: 'error', detail: errorMessage || step.detail || original.description }
    }

    if (idx > targetIndex && step.status !== 'completed') {
      return { ...step, status: 'pending' }
    }

    return step
  })

  next.status = 'failed'
  next.error = errorMessage
  next.updatedAt = now()

  return next
}

// ===== 抖音评论进度辅助函数 =====

function createInitialCommentsProgressState(): DouyinCommentsProgressState {
  return {
    steps: DOUYIN_COMMENTS_PIPELINE_STEPS.map(step => ({
      key: step.key,
      status: 'pending' as const
    })),
    percentage: 0,
    status: 'running',
    updatedAt: now()
  }
}

function cloneCommentsProgressState(state?: DouyinCommentsProgressState | null): DouyinCommentsProgressState {
  if (!state) {
    return createInitialCommentsProgressState()
  }

  const stepMap = new Map((state.steps ?? []).map(step => [step.key, step]))

  return {
    ...state,
    steps:
      state.steps?.length === DOUYIN_COMMENTS_PIPELINE_STEPS.length
        ? state.steps
        : DOUYIN_COMMENTS_PIPELINE_STEPS.map(base => {
            const existing = stepMap.get(base.key)
            return existing ?? {
              key: base.key,
              status: 'pending' as const,
              detail: undefined
            }
          }),
    updatedAt: now()
  }
}

function applyCommentsProgressUpdate(
  previous: DouyinCommentsProgressState | undefined,
  progress: DouyinCommentsProgressEventPayload
): DouyinCommentsProgressState {
  const next = cloneCommentsProgressState(previous)

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

  next.updatedAt = now()
  return next
}

function applyCommentsInfoUpdate(
  previous: DouyinCommentsProgressState | undefined,
  info: DouyinCommentsInfoEventPayload
): DouyinCommentsProgressState {
  const next = cloneCommentsProgressState(previous)
  next.videoInfo = info.videoInfo
  next.statistics = info.statistics ?? next.statistics
  next.updatedAt = now()
  return next
}

function applyCommentsPartialUpdate(
  previous: DouyinCommentsProgressState | undefined,
  partial: DouyinCommentsPartialEventPayload
): DouyinCommentsProgressState {
  const next = cloneCommentsProgressState(previous)

  if (partial.key === 'analysis') {
    next.analysisPreview = partial.append === false
      ? partial.data
      : `${next.analysisPreview ?? ''}${partial.data}`
  }

  next.updatedAt = now()
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
  next.analysisPreview = payload.markdown
  next.updatedAt = now()
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
    const base = DOUYIN_COMMENTS_PIPELINE_STEPS[idx]

    if (idx === targetIndex) {
      return { ...step, status: 'error', detail: errorMessage || step.detail || base.description }
    }

    if (idx > targetIndex && step.status !== 'completed') {
      return { ...step, status: 'pending' }
    }

    return step
  })

  next.status = 'failed'
  next.error = errorMessage
  next.updatedAt = now()

  return next
}

function deriveMessageStatus(stage: PipelineStage, progressStatus: 'running' | 'completed' | 'failed'): MessageStatus {
  if (stage === 'error' || progressStatus === 'failed') {
    return 'error'
  }

  if (stage === 'done' || progressStatus === 'completed') {
    return 'completed'
  }

  return 'streaming'
}

export function computePipelineStateId(pendingAssistantId: string, source: PipelineSource): string {
  return `${pendingAssistantId}::${source}`
}

export function computeResultMessageId(pendingAssistantId: string, source: PipelineSource): string {
  return `${pendingAssistantId}_${source}_result`
}

interface PipelineEventContext {
  requestId: string
  pendingAssistantId: string
}

interface PipelineHandleResult {
  pipelineStateId: string
  source: PipelineSource
  stage: PipelineStage
  finalContent?: string
  error?: string
}

interface UsePipelineHandlerOptions {
  emitEvent?: (event: ChatEvent) => void
}

export function usePipelineHandler(options: UsePipelineHandlerOptions = {}) {
  const { state, dispatch } = usePipelineStoreContext()
  const storeRef = useRef(state)

  useEffect(() => {
    storeRef.current = state
  }, [state])

  const emitEvent = options.emitEvent
  const initializedResultMessagesRef = useRef<Set<string>>(new Set())
  const resetPipelineSession = useCallback(() => {
    initializedResultMessagesRef.current.clear()
  }, [])

  const handlePipelineEvent = useCallback((event: UnifiedPipelineEvent, context: PipelineEventContext): PipelineHandleResult => {
    const pipelineStateId = computePipelineStateId(context.pendingAssistantId, event.source)
    const resultMessageId = computeResultMessageId(context.pendingAssistantId, event.source)

    const current = storeRef.current.byId[pipelineStateId]
    let updatedRecord: PipelineStateRecord
    let finalContent: string | undefined
    let errorMessage: string | undefined

    if (event.source === 'douyin-video') {
      const base: DouyinVideoPipelineState = current && current.source === 'douyin-video'
        ? current
        : {
            id: pipelineStateId,
            source: 'douyin-video',
            progress: createInitialDouyinProgressState(),
            updatedAt: now()
          }

      switch (event.stage) {
        case 'progress':
          updatedRecord = {
            ...base,
            progress: applyDouyinProgressUpdate(base.progress, event.payload as DouyinProgressEventPayload),
            updatedAt: now()
          }
          break
        case 'info':
          updatedRecord = {
            ...base,
            progress: applyDouyinInfoUpdate(base.progress, event.payload as DouyinInfoEventPayload),
            updatedAt: now()
          }
          break
        case 'partial':
          updatedRecord = {
            ...base,
            progress: applyDouyinPartialUpdate(base.progress, event.payload as DouyinPartialEventPayload),
            updatedAt: now()
          }
          break
        case 'done': {
          const resultPayload = event.payload as DouyinDoneEventPayload
          updatedRecord = {
            ...base,
            progress: applyDouyinDoneUpdate(base.progress, resultPayload),
            result: resultPayload,
            updatedAt: now()
          }
          finalContent = resultPayload.markdown
          break
        }
        case 'error': {
          const payload = (event.payload || {}) as { message?: string; step?: DouyinPipelineStep }
          const message = payload.message || '抖音视频处理失败'
          updatedRecord = {
            ...base,
            progress: applyDouyinErrorUpdate(base.progress, message, payload.step),
            updatedAt: now()
          }
          errorMessage = message
          break
        }
        default:
          updatedRecord = { ...base }
      }
    } else {
      const base: DouyinCommentsPipelineState = current && current.source === 'douyin-comments'
        ? current
        : {
            id: pipelineStateId,
            source: 'douyin-comments',
            progress: createInitialCommentsProgressState(),
            updatedAt: now()
          }

      switch (event.stage) {
        case 'progress':
          updatedRecord = {
            ...base,
            progress: applyCommentsProgressUpdate(base.progress, event.payload as DouyinCommentsProgressEventPayload),
            updatedAt: now()
          }
          break
        case 'info':
          updatedRecord = {
            ...base,
            progress: applyCommentsInfoUpdate(base.progress, event.payload as DouyinCommentsInfoEventPayload),
            updatedAt: now()
          }
          break
        case 'partial':
          updatedRecord = {
            ...base,
            progress: applyCommentsPartialUpdate(base.progress, event.payload as DouyinCommentsPartialEventPayload),
            updatedAt: now()
          }
          break
        case 'done': {
          const resultPayload = event.payload as DouyinCommentsDoneEventPayload
          updatedRecord = {
            ...base,
            progress: applyCommentsDoneUpdate(base.progress, resultPayload),
            result: resultPayload,
            updatedAt: now()
          }
          finalContent = resultPayload.markdown
          break
        }
        case 'error': {
          const payload = (event.payload || {}) as { message?: string; step?: DouyinCommentsPipelineStep }
          const message = payload.message || '评论分析失败'
          updatedRecord = {
            ...base,
            progress: applyCommentsErrorUpdate(base.progress, message, payload.step),
            updatedAt: now()
          }
          errorMessage = message
          break
        }
        default:
          updatedRecord = { ...base }
      }
    }

    dispatch({ type: 'SET', record: updatedRecord })

    const progressStatus = updatedRecord.progress.status
    const statusForProgressMessage = deriveMessageStatus(event.stage, progressStatus)

    emitEvent?.({
      type: 'pipeline:update',
      requestId: context.requestId,
      pendingAssistantId: context.pendingAssistantId,
      targetMessageId: context.pendingAssistantId,
      pipelineStateId,
      source: event.source,
      stage: event.stage,
      status: statusForProgressMessage,
      error: errorMessage,
      linkedMessageId: resultMessageId
    })

    // 处理结果消息的流式和状态同步
    if (event.stage === 'partial') {
      // 统一处理两种 pipeline 的 partial 事件
      const payload = event.payload as DouyinPartialEventPayload | DouyinCommentsPartialEventPayload
      const expectedKey = event.source === 'douyin-video' ? 'markdown' : 'analysis'

      if (payload.key === expectedKey) {
        const chunk = typeof payload.data === 'string' ? payload.data : `${payload.data ?? ''}`
        if (chunk) {
          if (!initializedResultMessagesRef.current.has(resultMessageId)) {
            initializedResultMessagesRef.current.add(resultMessageId)
            emitEvent?.({
              type: 'pipeline:update',
              requestId: context.requestId,
              pendingAssistantId: context.pendingAssistantId,
              targetMessageId: resultMessageId,
              pipelineStateId,
              source: event.source,
              stage: event.stage,
              status: 'streaming',
              linkedMessageId: context.pendingAssistantId
            })
          }

          emitEvent?.({
            type: 'pipeline:result-stream',
            requestId: context.requestId,
            pendingAssistantId: context.pendingAssistantId,
            targetMessageId: resultMessageId,
            pipelineStateId,
            chunk,
            append: payload.append !== false
          })
        }
      }
    }

    if (event.stage === 'done') {
      const status: MessageStatus = 'completed'

      emitEvent?.({
        type: 'pipeline:result-finalize',
        requestId: context.requestId,
        pendingAssistantId: context.pendingAssistantId,
        targetMessageId: resultMessageId,
        pipelineStateId,
        content: finalContent ?? '',
        status,
        metadata: {
          pipelineStateId,
          pipelineSource: event.source,
          pipelineRole: 'result',
          pipelineLinkedMessageId: context.pendingAssistantId
        }
      })

      initializedResultMessagesRef.current.delete(resultMessageId)
    }

    if (event.stage === 'error') {
      emitEvent?.({
        type: 'pipeline:result-error',
        requestId: context.requestId,
        pendingAssistantId: context.pendingAssistantId,
        targetMessageId: resultMessageId,
        pipelineStateId,
        error: errorMessage ?? 'Pipeline error'
      })

      initializedResultMessagesRef.current.delete(resultMessageId)
    }

    return {
      pipelineStateId,
      source: event.source,
      stage: event.stage,
      finalContent,
      error: errorMessage
    }
  }, [emitEvent])

  return {
    handlePipelineEvent,
    resetPipelineSession
  }
}

export type PipelineHandler = ReturnType<typeof usePipelineHandler>
