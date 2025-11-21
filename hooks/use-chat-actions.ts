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
import { getFriendlyErrorMessage, isUserCancellation } from '@/lib/chat/error-messages'

// 全局递增计数器确保 ID 唯一性
let messageIdCounter = 0

type RequestMode = 'standard' | 'retry'

interface ExecuteChatRequestParams {
  userMessage: ChatMessage
  contextMessages: ChatMessage[]
  dynamicConversationId?: string
  pendingAssistantId?: string
  mode?: RequestMode
  originUserMessageId?: string
  retryOfMessageId?: string
  retryCount?: number
}

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

  const executeChatRequest = useCallback(async ({
    userMessage,
    contextMessages,
    dynamicConversationId,
    pendingAssistantId: pendingOverride,
    mode = 'standard',
    originUserMessageId,
    retryOfMessageId,
    retryCount
  }: ExecuteChatRequestParams) => {
    if (!userMessage.content?.trim()) {
      return
    }

    const activeConversationId = dynamicConversationId ?? conversationId
    const timestamp = dt.timestamp()
    const counter = ++messageIdCounter
    const randomSuffix = Math.random().toString(36).slice(2)

    const requestId = `req_${timestamp}_${counter}_${randomSuffix}`
    const pendingAssistantId = pendingOverride ?? `pending_${timestamp}_${counter}_${randomSuffix}`

    const currentController = new AbortController()
    const previousController = abortRef.current
    abortRef.current = currentController
    previousController?.abort()

    resetPipelineSession()

    const resolvedOriginUserMessageId = originUserMessageId ?? userMessage.id

    try {
      onEvent?.({
        type: 'started',
        requestId,
        conversationId: activeConversationId,
        userMessage,
        pendingAssistantId,
        mode,
        originUserMessageId: resolvedOriginUserMessageId,
        retryOfMessageId,
        retryCount
      })

      const contextSnapshot = contextMessages.length ? [...contextMessages] : []
      const shouldAppendUser = mode !== 'retry'
      let fullContext = shouldAppendUser ? [...contextSnapshot, userMessage] : contextSnapshot
      if (!shouldAppendUser && fullContext[fullContext.length - 1]?.id !== userMessage.id) {
        fullContext = [...fullContext, userMessage]
      }

      const trimResult = trimForChatAPI(fullContext, model)

      if (trimResult.trimmed) {
        console.info(`[Chat] Context trimmed: ${trimResult.dropCount} messages dropped, estimated tokens: ${trimResult.estimatedTokens}`)
      }

      const lastMessage = trimResult.messages[trimResult.messages.length - 1]
      if (!lastMessage || lastMessage.id !== userMessage.id) {
        throw new Error('������������������˵��ζԻ���token���ơ��볢��������Ϣ���ݻ�ֶη��͡�')
      }

      const sanitizedMessages = trimResult.messages.filter(message => {
        const content = typeof message.content === 'string' ? message.content : ''
        return content.trim().length > 0
      })

      const requestBody: Record<string, any> = {
        conversationId: activeConversationId,
        messages: sanitizedMessages,
        model
      }

      if (settings?.reasoning_effort) {
        requestBody.reasoning_effort = settings.reasoning_effort
      }
      if (settings?.reasoning) {
        requestBody.reasoning = settings.reasoning
      }
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: currentController.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API���� ${response.status}: ${errorText}`)
      }

      const reader = response.body!.getReader()

      let streamingContent = ''
      let fullReasoning = ''
      let hasPipeline = false
      let pipelineFinalContent: string | null = null
      let pipelineError: string | null = null
      let pipelineStateId: string | null = null
      let pipelineSource: PipelineSource | null = null
      let pipelineResultMessageId: string | null = null

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
        throw new Error('��ˮ�ߴ���δ������Ч����')
      }

      const assistantMetadata: ChatMessage['metadata'] = {
        model,
        linkedUserMessageId: resolvedOriginUserMessageId,
        requestId
      }

      if (typeof retryCount === 'number') {
        assistantMetadata.retryCount = retryCount
      }
      if (retryOfMessageId) {
        assistantMetadata.retryOfMessageId = retryOfMessageId
      }

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

      onEvent?.({
        type: 'done',
        requestId,
        conversationId: activeConversationId,
        assistantMessage,
        finishedAt: dt.timestamp()
      })

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

            const userExists = existingMessages.some(msg => msg.id === userMessage.id)
            const assistantExists = existingMessages.some(msg => msg.id === assistantMessage.id)

            let mergedMessages = [...existingMessages]

            if (!userExists) {
              mergedMessages.push(userMessage)
            }

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
            const updateConv = (conv: any) => {
              if (conv.id !== activeConversationId) return conv

              const baseCount =
                conv.messageCount ??
                conv.metadata?.messageCount ??
                (conv.messages?.length ?? 0)

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
            }

            // 处理分页数据结构 { conversations, pagination }
            if (oldData && oldData.conversations && Array.isArray(oldData.conversations)) {
              return {
                ...oldData,
                conversations: oldData.conversations.map(updateConv)
              }
            }
            // 向后兼容：处理纯数组结构（不应该出现）
            if (Array.isArray(oldData)) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('[Cache] 检测到纯数组缓存格式，这不应该发生')
              }
              return oldData.map(updateConv)
            }
            return oldData
          }
        )
      }
    } catch (error) {
      if (abortRef.current === currentController) {
        abortRef.current = null
      }

      // 使用统一的错误处理
      const errorValue = error instanceof Error ? error : new Error(String(error))
      const isAbort = isUserCancellation(errorValue)
      const friendlyError = getFriendlyErrorMessage(errorValue)
      const errorMessage = error instanceof Error ? error.message : '发送消息失败'

      if (isAbort) {
        onEvent?.({
          type: 'error',
          requestId,
          pendingAssistantId,
          error: friendlyError.message,
          recoverable: false
        })
        return
      }

      onEvent?.({
        type: 'error',
        requestId,
        pendingAssistantId,
        error: errorMessage,
        recoverable: true
      })

      // 显示友好的错误提示
      toast.error(friendlyError.title, { description: friendlyError.message })
    }
  }, [conversationId, handlePipelineEvent, model, onEvent, queryClient, resetPipelineSession, settings])
  const sendMessage = useCallback(async (content: string, dynamicConversationId?: string) => {
    if (!content.trim()) return

    const timestamp = dt.timestamp()
    const counter = ++messageIdCounter
    const randomSuffix = Math.random().toString(36).slice(2)

    const userMessage: ChatMessage = {
      id: `msg_${timestamp}_${counter}_${randomSuffix}`,
      role: 'user',
      content,
      timestamp,
      status: 'completed'
    }

    await executeChatRequest({
      userMessage,
      contextMessages: messages,
      dynamicConversationId: dynamicConversationId ?? conversationId,
      mode: 'standard',
      originUserMessageId: userMessage.id
    })
  }, [conversationId, executeChatRequest, messages])

  const retryMessage = useCallback(async (messageId: string) => {
    if (!messageId) return

    const targetIndex = messages.findIndex((msg) => msg.id === messageId)
    if (targetIndex === -1) {
      toast.error('未找到需要重试的消息')
      return
    }

    const targetMessage = messages[targetIndex]
    if (targetMessage.role !== 'assistant') {
      toast.error('只能对助手回复进行重试')
      return
    }

    if (targetMessage.status === 'streaming' || targetMessage.status === 'pending') {
      toast.info('当前回复尚未结束，稍后再试')
      return
    }

    const linkedUserId = (
      targetMessage.metadata?.linkedUserMessageId ??
      (() => {
        for (let i = targetIndex - 1; i >= 0; i--) {
          if (messages[i].role === 'user') {
            return messages[i].id
          }
        }
        return null
      })()
    )

    if (!linkedUserId) {
      toast.error('找不到对应的提问，无法重试')
      return
    }

    const userMessage = messages.find((msg) => msg.id === linkedUserId)
    if (!userMessage) {
      toast.error('提问信息已缺失，无法重试')
      return
    }

    const trailingMessages = messages
      .slice(targetIndex + 1)
      .filter((msg) => !msg.metadata?.pipelineRole && msg.content.trim().length > 0)

    if (trailingMessages.length > 0) {
      toast.warning('仅支持对最新回复进行重试')
      return
    }

    const contextBeforeAssistant = messages.slice(0, targetIndex)
    const retryCount = (targetMessage.metadata?.retryCount ?? 0) + 1

    await executeChatRequest({
      userMessage,
      contextMessages: contextBeforeAssistant,
      dynamicConversationId: conversationId,
      pendingAssistantId: messageId,
      mode: 'retry',
      originUserMessageId: userMessage.id,
      retryOfMessageId: messageId,
      retryCount
    })
  }, [conversationId, executeChatRequest, messages])

  const stopGeneration = useCallback(() => {
    // 原子化停止生成 - 避免竞态条件
    const currentController = abortRef.current
    abortRef.current = null // 先清空引用再中止
    currentController?.abort()
  }, [])

  return {
    sendMessage,
    stopGeneration,
    retryMessage
  }
}
