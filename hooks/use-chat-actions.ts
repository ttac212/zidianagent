import { useCallback, useEffect, useRef } from 'react'
import { toast } from '@/lib/toast/toast'
import type {
  ChatMessage,
  ChatEvent,
  Conversation,
  ChatSettings,
  PipelineSource
} from '@/types/chat'
import { useQueryClient } from '@tanstack/react-query'
import { processSSEStream } from '@/lib/utils/sse-parser'
import { trimForChatAPI } from '@/lib/chat/context-trimmer'
import * as dt from '@/lib/utils/date-toolkit'
import { DEFAULT_MODEL } from '@/lib/ai/models'
import { createBatchStreamThrottle } from '@/lib/utils/stream-throttle'
import { normalizeEvent, isPipelineEvent } from '@/lib/chat/events'
import { usePipelineHandler, computeResultMessageId } from '@/hooks/use-pipeline-handler'

// 全局递增计数器确保 ID 唯一性
let messageIdCounter = 0

export function useChatActions({
  conversationId,
  onEvent,
  messages = [],
  model = DEFAULT_MODEL,
  settings
}: {
  conversationId?: string
  onEvent?: (event: ChatEvent) => void
  messages?: ChatMessage[]
  model?: string
  settings?: ChatSettings
}) {
  const abortRef = useRef<AbortController | null>(null)
  const queryClient = useQueryClient()
  const { handlePipelineEvent, resetPipelineSession } = usePipelineHandler({ emitEvent: onEvent })

  // 组件卸载时清理 AbortController，防止内存泄漏
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  const sendMessage = useCallback(async (content: string, dynamicConversationId?: string) => {
    if (!content.trim()) return

    // 使用动态提供的conversationId，否则使用props中的
    const activeConversationId = dynamicConversationId ?? conversationId

    // 生成唯一 ID (时间戳 + 递增计数器 + 随机数，确保全局唯一)
    const timestamp = dt.timestamp()
    const counter = ++messageIdCounter
    const randomSuffix = Math.random().toString(36).slice(2)

    const requestId = `req_${timestamp}_${counter}_${randomSuffix}`
    const pendingAssistantId = `pending_${timestamp}_${counter}_${randomSuffix}`

    // 创建用户消息
    const userMessage: ChatMessage = {
      id: `msg_${timestamp}_${counter}_${randomSuffix}`,
      role: 'user',
      content,
      timestamp,
      status: 'completed' // 用户消息立即完成
    }

    // 原子化中止上一个请求并创建新的控制器 - 修复竞态条件
    const currentController = new AbortController()
    const previousController = abortRef.current
    abortRef.current = currentController // 先设置新控制器再中止旧的
    previousController?.abort() // 中止之前的请求

    resetPipelineSession()

    try {
      // 发送 started 事件
      onEvent?.({
        type: 'started',
        requestId,
        conversationId: activeConversationId,
        userMessage,
        pendingAssistantId
      })

      // 使用统一裁剪器准备上下文消息（修复上下文无界问题）- 基于实际模型上限
      const fullContext = [...messages, userMessage]
      const trimResult = trimForChatAPI(fullContext, model)

      if (trimResult.trimmed) {
        console.info(`[Chat] Context trimmed: ${trimResult.dropCount} messages dropped, estimated tokens: ${trimResult.estimatedTokens}`)
      }

      // 检查最新用户消息是否被裁剪掉（修复回复错对象问题）
      const lastMessage = trimResult.messages[trimResult.messages.length - 1]
      if (!lastMessage || lastMessage.id !== userMessage.id) {
        throw new Error('您的输入过长，超出了单次对话的token限制。请尝试缩短消息内容或分段发送。')
      }

      // 过滤掉历史中被创建为占位符的空消息，防止下游API报错
      const sanitizedMessages = trimResult.messages.filter(message => {
        const content = typeof message.content === 'string' ? message.content : ''
        return content.trim().length > 0
      })

      // 构建API请求体
      const requestBody: Record<string, any> = {
        conversationId: activeConversationId,
        messages: sanitizedMessages,
        model
      }

      // 添加推理参数（如果设置了）
      if (settings?.reasoning_effort) {
        requestBody.reasoning_effort = settings.reasoning_effort
      }
      if (settings?.reasoning) {
        requestBody.reasoning = settings.reasoning
      }

      // 添加创作模式参数
      if (settings?.creativeMode) {
        requestBody.creativeMode = settings.creativeMode
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: currentController.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API错误 ${response.status}: ${errorText}`)
      }

      // 使用现成SSE解析工具，修复跨chunk数据丢失问题
      const reader = response.body!.getReader()

      let streamingContent = ''
      let fullReasoning = ''
      let hasPipeline = false
      let pipelineFinalContent: string | null = null
      let pipelineError: string | null = null
      let pipelineStateId: string | null = null
      let pipelineSource: PipelineSource | null = null
      let pipelineResultMessageId: string | null = null

      // 使用批量节流器同时处理 content 和 reasoning 的更新
      const streamThrottle = createBatchStreamThrottle<'content' | 'reasoning'>((updates) => {
        onEvent?.({
          type: 'chunk',
          requestId,
          content: updates.content || streamingContent,
          reasoning: updates.reasoning || undefined,
          pendingAssistantId
        })
      }, { maxWait: 16 })

      const fullContent = await processSSEStream(reader, {
        onMessage: (message) => {
          const unified = normalizeEvent(message)
          if (!unified) {
            return
          }

          if (isPipelineEvent(unified)) {
            hasPipeline = true
            const outcome = handlePipelineEvent(unified, {
              requestId,
              pendingAssistantId
            })
            pipelineStateId = outcome.pipelineStateId
            pipelineSource = outcome.source
            pipelineResultMessageId = computeResultMessageId(pendingAssistantId, outcome.source)
            if (outcome.finalContent) {
              pipelineFinalContent = outcome.finalContent
            }
            if (outcome.error) {
              pipelineError = outcome.error
            }
            return
          }

          switch (unified.type) {
            case 'chunk': {
              const delta = unified.payload?.delta ?? ''
              const hasDelta = Boolean(delta)
              const hasReasoning = Boolean(unified.reasoning)

              if (hasDelta) {
                streamingContent += delta
                streamThrottle.update('content', streamingContent)
              }

              if (hasReasoning) {
                fullReasoning += unified.reasoning!
                streamThrottle.update('reasoning', fullReasoning)
              }

              break
            }
            case 'warn': {
              onEvent?.({
                type: 'warn',
                requestId,
                message: unified.payload.message
              })
              break
            }
            case 'error': {
              onEvent?.({
                type: 'error',
                requestId,
                pendingAssistantId,
                error: unified.payload.message,
                recoverable: unified.payload.recoverable ?? true
              })
              break
            }
            case 'done':
              break
          }
        },
        onError: (error) => {
          onEvent?.({
            type: 'warn',
            requestId,
            message: error
          })
        }
      })

      streamThrottle.flush()

      if (pipelineError) {
        throw new Error(pipelineError)
      }

      const finalContent = pipelineFinalContent ?? fullContent

      if (hasPipeline && !finalContent) {
        throw new Error('流水线处理未返回有效内容')
      }

      const assistantMetadata: ChatMessage['metadata'] = { model }

      if (pipelineStateId && pipelineSource) {
        assistantMetadata.pipelineStateId = pipelineStateId
        assistantMetadata.pipelineSource = pipelineSource
        assistantMetadata.pipelineRole = 'result'
        assistantMetadata.pipelineLinkedMessageId = pendingAssistantId
      }

      const targetAssistantId = hasPipeline && pipelineSource
        ? (pipelineResultMessageId ?? computeResultMessageId(pendingAssistantId, pipelineSource))
        : pendingAssistantId

      const assistantMessage: ChatMessage = {
        id: targetAssistantId,
        role: 'assistant',
        content: finalContent,
        reasoning: fullReasoning || undefined,
        timestamp: dt.timestamp(),
        metadata: assistantMetadata,
        status: 'completed'
      }

      // 发送 done 事件
      onEvent?.({
        type: 'done',
        requestId,
        conversationId: activeConversationId,
        assistantMessage,
        finishedAt: dt.timestamp()
      })

      // 清理 abort 控制器（仅在是当前请求时复位）
      if (abortRef.current === currentController) {
        abortRef.current = null
      }

      if (activeConversationId) {
        const { matchesConversationDetailKey } = await import('@/hooks/api/use-conversations-query')

        queryClient.setQueriesData(
          {
            predicate: (query) => matchesConversationDetailKey(query.queryKey, activeConversationId)
          },
          (oldData: Conversation | null | undefined) => {
            if (!oldData) return oldData

            const existingMessages = oldData.messages || []

            // 【关键修复】同时添加用户消息和助手消息
            const userExists = existingMessages.some(msg => msg.id === userMessage.id)
            const assistantExists = existingMessages.some(msg => msg.id === assistantMessage.id)

            let mergedMessages = [...existingMessages]

            // 添加用户消息(如果不存在)
            if (!userExists) {
              mergedMessages.push(userMessage)
            }

            // 添加或更新助手消息
            if (assistantExists) {
              mergedMessages = mergedMessages.map(msg =>
                msg.id === assistantMessage.id ? assistantMessage : msg
              )
            } else {
              mergedMessages.push(assistantMessage)
            }

            mergedMessages.sort((a, b) => a.timestamp - b.timestamp)

            const targetWindow =
              oldData.messagesWindow?.request?.take ??
              oldData.messagesWindow?.size ??
              mergedMessages.length

            let adjustedMessages = mergedMessages
            if (targetWindow && adjustedMessages.length > targetWindow) {
              adjustedMessages = adjustedMessages.slice(adjustedMessages.length - targetWindow)
            }

            const updatedWindow = oldData.messagesWindow
              ? {
                  ...oldData.messagesWindow,
                  size: adjustedMessages.length,
                  newestMessageId: assistantMessage.id,
                  oldestMessageId: adjustedMessages.length > 0 ? adjustedMessages[0].id : null
                }
              : oldData.messagesWindow

            const totalCountBase =
              oldData.messageCount ??
              oldData.metadata?.messageCount ??
              adjustedMessages.length

            // 【修复】正确计算新增消息数(用户消息+助手消息)
            let newMessagesAdded = 0
            if (!userExists) newMessagesAdded++
            if (!assistantExists) newMessagesAdded++

            const newTotalCount = totalCountBase + newMessagesAdded

            const updatedMetadata = {
              ...oldData.metadata,
              messageCount: newTotalCount,
              lastMessage: {
                id: assistantMessage.id,
                role: 'assistant' as const,
                content: assistantMessage.content,
                timestamp: assistantMessage.timestamp
              }
            }

            return {
              ...oldData,
              messages: adjustedMessages,
              messageCount: newTotalCount,
              metadata: updatedMetadata,
              messagesWindow: updatedWindow
            }
          }
        )

        queryClient.setQueriesData(
          {
            predicate: (query) => {
              const key = query.queryKey
              return Array.isArray(key) &&
                     key[0] === 'conversations' &&
                     key[1] === 'list'
            }
          },
          (oldData: any) => {
            if (!Array.isArray(oldData)) {
              return oldData
            }

            return oldData.map((conv: any) => {
              if (conv.id !== activeConversationId) return conv

              const baseCount =
                conv.messageCount ??
                conv.metadata?.messageCount ??
                (conv.messages?.length ?? 0)

              // 【修复】检查用户消息和助手消息是否已存在
              const existingMessages = conv.messages || []
              const userAlreadyExists = existingMessages.some((m: any) => m.id === userMessage.id)
              const assistantAlreadyExists = conv.lastMessage?.id === assistantMessage.id

              let added = 0
              if (!userAlreadyExists) added++
              if (!assistantAlreadyExists) added++

              const nextCount = baseCount + added

              return {
                ...conv,
                updatedAt: assistantMessage.timestamp,
                messageCount: nextCount,
                lastMessage: {
                  ...(conv.lastMessage || {}),
                  id: assistantMessage.id,
                  role: 'assistant',
                  content: assistantMessage.content,
                  createdAt: new Date(assistantMessage.timestamp).toISOString()
                },
                metadata: {
                  ...conv.metadata,
                  messageCount: nextCount,
                  lastActivity: assistantMessage.timestamp,
                  lastMessage: {
                    id: assistantMessage.id,
                    role: 'assistant',
                    content: assistantMessage.content,
                    timestamp: assistantMessage.timestamp
                  }
                }
              }
            })
          }
        )
    }

    } catch (error) {
      // 检查是否是当前请求被中止（避免清理新请求的控制器）
      if (abortRef.current === currentController) {
        abortRef.current = null
      }

      // 类型安全的错误处理
      const isAbortError = error instanceof Error && error.name === 'AbortError'
      const errorMessage = error instanceof Error ? error.message : '发送消息失败'

      if (isAbortError) {
        // 中止时发送 error 事件进行清理
        onEvent?.({
          type: 'error',
          requestId,
          pendingAssistantId,
          error: '生成已取消',
          recoverable: false
        })
        return
      }

      // 发送 error 事件，包含 pendingAssistantId 用于匹配占位消息
      onEvent?.({
        type: 'error',
        requestId,
        pendingAssistantId,
        error: errorMessage,
        recoverable: true
      })

      toast.error(errorMessage)
    }
  }, [conversationId, onEvent, messages, model, settings, queryClient, handlePipelineEvent, resetPipelineSession])

  const stopGeneration = useCallback(() => {
    // 原子化停止生成 - 避免竞态条件
    const currentController = abortRef.current
    abortRef.current = null // 先清空引用再中止
    currentController?.abort()
  }, [])

  return {
    sendMessage,
    stopGeneration
  }
}
