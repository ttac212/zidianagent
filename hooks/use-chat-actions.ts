/**
 * 聊天 Hook - 事件协议版本
 * 实现 started/chunk/done/error 事件流
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@/lib/toast/toast'
import type { ChatMessage, ChatEvent, Conversation } from '@/types/chat'
import { useQueryClient } from '@tanstack/react-query'
import { processSSEStream } from '@/lib/utils/sse-parser'
import { trimForChatAPI } from '@/lib/chat/context-trimmer'
import * as dt from '@/lib/utils/date-toolkit'
import { DEFAULT_MODEL } from '@/lib/ai/models'

export function useChatActions({
  conversationId,
  onEvent,
  messages = [],
  model = DEFAULT_MODEL
}: {
  conversationId?: string
  onEvent?: (event: ChatEvent) => void
  messages?: ChatMessage[]
  model?: string
}) {
  const abortRef = useRef<AbortController | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const queryClient = useQueryClient()

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

    // 生成唯一 ID
    const requestId = `req_${dt.timestamp()}_${Math.random().toString(36).slice(2)}`
    const pendingAssistantId = `pending_${dt.timestamp()}_${Math.random().toString(36).slice(2)}`

    // 创建用户消息
    const userMessage: ChatMessage = {
      id: `msg_${dt.timestamp()}_${Math.random().toString(36).slice(2)}`,
      role: 'user',
      content,
      timestamp: dt.timestamp(),
      status: 'completed' // 用户消息立即完成
    }

    // 原子化中止上一个请求并创建新的控制器 - 修复竞态条件
    const currentController = new AbortController()
    const previousController = abortRef.current
    abortRef.current = currentController // 先设置新控制器再中止旧的
    previousController?.abort() // 中止之前的请求

    // 设置流状态
    setIsStreaming(true)

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

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversationId,
          messages: trimResult.messages,
          model
        }),
        signal: currentController.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API错误 ${response.status}: ${errorText}`)
      }

      // 使用现成SSE解析工具，修复跨chunk数据丢失问题
      const reader = response.body!.getReader()

      const fullContent = await processSSEStream(reader, {
        onContent: (delta, _fullContent) => {
          // 发送 chunk 事件
          onEvent?.({
            type: 'chunk',
            requestId,
            delta,
            pendingAssistantId
          })
        },
        onError: (error) => {
          // 处理流内部错误（如服务端警告）
          onEvent?.({
            type: 'warn',
            requestId,
            message: error
          })
        }
      })

      // 创建最终助手消息
      const assistantMessage: ChatMessage = {
        id: pendingAssistantId,
        role: 'assistant',
        content: fullContent,
        timestamp: dt.timestamp(),
        metadata: { model },
        status: 'completed' // 助手消息流式完成后设为completed
      }

      // 发送 done 事件
      onEvent?.({
        type: 'done',
        requestId,
        conversationId: activeConversationId,
        assistantMessage,
        finishedAt: dt.timestamp()
      })

      // 复位流状态和abort控制器（仅在是当前请求时清理）
      setIsStreaming(false)
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
            const messageExists = existingMessages.some(msg => msg.id === assistantMessage.id)
            const mergedMessages = messageExists
              ? existingMessages.map(msg => msg.id === assistantMessage.id ? assistantMessage : msg)
              : [...existingMessages, assistantMessage]

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

            const newTotalCount = messageExists ? totalCountBase : totalCountBase + 1

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
              const isSameAsLatest = conv.lastMessage?.id === assistantMessage.id
              const nextCount = isSameAsLatest ? baseCount : baseCount + 1

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
      // 复位流状态
      setIsStreaming(false)

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
  }, [conversationId, onEvent, messages, model, queryClient])

  const stopGeneration = useCallback(() => {
    // 原子化停止生成 - 避免竞态条件
    const currentController = abortRef.current
    abortRef.current = null // 先清空引用再中止
    currentController?.abort()
    setIsStreaming(false)
  }, [])

  return {
    sendMessage,
    stopGeneration,
    isStreaming
  }
}
