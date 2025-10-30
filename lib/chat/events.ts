import type {
  PipelineSource,
  PipelineStage
} from '@/types/chat'
import type { SSEMessage } from '@/lib/utils/sse-parser'

export type UnifiedChatEvent =
  | {
      category: 'chat'
      type: 'chunk'
      payload: {
        delta: string
      }
      reasoning?: string
    }
  | {
      category: 'chat'
      type: 'warn'
      payload: {
        message: string
      }
    }
  | {
      category: 'chat'
      type: 'error'
      payload: {
        message: string
        recoverable?: boolean
      }
    }
  | {
      category: 'chat'
      type: 'done'
      payload?: Record<string, unknown>
    }
  | UnifiedPipelineEvent

export interface UnifiedPipelineEvent<TPayload = unknown> {
  category: 'pipeline'
  source: PipelineSource
  stage: PipelineStage
  payload: TPayload
}

const PIPELINE_EVENT_MAP: Record<string, { source: PipelineSource; stage: PipelineStage }> = {
  'douyin-progress': { source: 'douyin-video', stage: 'progress' },
  'douyin-info': { source: 'douyin-video', stage: 'info' },
  'douyin-partial': { source: 'douyin-video', stage: 'partial' },
  'douyin-done': { source: 'douyin-video', stage: 'done' },
  'douyin-error': { source: 'douyin-video', stage: 'error' },
  'comments-progress': { source: 'douyin-comments', stage: 'progress' },
  'comments-info': { source: 'douyin-comments', stage: 'info' },
  'comments-partial': { source: 'douyin-comments', stage: 'partial' },
  'comments-done': { source: 'douyin-comments', stage: 'done' },
  'comments-error': { source: 'douyin-comments', stage: 'error' }
}

function normalizePipelineEvent(eventName: string, raw: SSEMessage): UnifiedPipelineEvent | null {
  const mapping = PIPELINE_EVENT_MAP[eventName]
  if (!mapping) {
    return null
  }

  const payload = raw.payload ?? {}

  return {
    category: 'pipeline',
    source: mapping.source,
    stage: mapping.stage,
    payload
  }
}

export function normalizeEvent(raw: SSEMessage): UnifiedChatEvent | null {
  if (raw.event) {
    const pipelineEvent = normalizePipelineEvent(raw.event, raw)
    if (pipelineEvent) {
      return pipelineEvent
    }

    if (raw.event === 'warn') {
      const payload = typeof raw.payload === 'string'
        ? { message: raw.payload }
        : (raw.payload as Record<string, unknown>) ?? {}
      const message = typeof payload.message === 'string'
        ? payload.message
        : '警告：聊天流程收到未知提醒'
      return {
        category: 'chat',
        type: 'warn',
        payload: { message }
      }
    }

    if (raw.event === 'error') {
      const payload = typeof raw.payload === 'string'
        ? { message: raw.payload }
        : (raw.payload as Record<string, unknown>) ?? {}
      const message = typeof payload.message === 'string'
        ? payload.message
        : raw.error || '聊天流程发生错误'
      const recoverable = typeof payload.recoverable === 'boolean'
        ? payload.recoverable
        : true

      return {
        category: 'chat',
        type: 'error',
        payload: { message, recoverable }
      }
    }

    if (raw.event === 'done') {
      const payload = (raw.payload ?? {}) as Record<string, unknown>
      return {
        category: 'chat',
        type: 'done',
        payload
      }
    }
  }

  if (raw.error) {
    return {
      category: 'chat',
      type: 'error',
      payload: {
        message: raw.error,
        recoverable: false
      }
    }
  }

  // 处理内容块（content或reasoning任一存在即返回）
  if (raw.content !== undefined || raw.reasoning) {
    return {
      category: 'chat' as const,
      type: 'chunk' as const,
      payload: {
        delta: raw.content || ''
      },
      reasoning: raw.reasoning
    }
  }

  if (raw.finished) {
    return {
      category: 'chat',
      type: 'done'
    }
  }

  return null
}

export function isPipelineEvent(event: UnifiedChatEvent): event is UnifiedPipelineEvent {
  return event.category === 'pipeline'
}
