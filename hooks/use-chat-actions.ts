/**
 * 聊天 Hook - 事件协议版本
 * 实现 started/chunk/done/error 事件流
 */

import { useCallback, useRef } from 'react'
import { toast } from '@/lib/toast/toast'
import type { ChatMessage, ChatEvent } from '@/types/chat'
import { useQueryClient } from '@tanstack/react-query'
import { processSSEStream } from '@/lib/utils/sse-parser'
import { trimForChatAPI } from '@/lib/chat/context-trimmer'

export function useChatActions({
  conversationId,
  onEvent,
  messages = [],
  model = 'claude-opus-4-1-20250805'
}: {
  conversationId?: string
  onEvent?: (event: ChatEvent) => void
  messages?: ChatMessage[]
  model?: string
}) {
  const abortRef = useRef<AbortController | null>(null)
  const queryClient = useQueryClient()

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return

    // 生成唯一 ID
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const pendingAssistantId = `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`

    // 创建用户消息
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      role: 'user',
      content,
      timestamp: Date.now()
    }

    // 中止上一个请求
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      // 发送 started 事件
      onEvent?.({
        type: 'started',
        requestId,
        conversationId,
        userMessage,
        pendingAssistantId
      })

      // 使用统一裁剪器准备上下文消息（修复上下文无界问题）
      const fullContext = [...messages, userMessage]
      const trimResult = trimForChatAPI(fullContext)

      if (trimResult.trimmed) {
        console.log(`[Chat] Context trimmed: ${trimResult.dropCount} messages dropped, estimated tokens: ${trimResult.estimatedTokens}`)
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
          conversationId,
          messages: trimResult.messages,
          model
        }),
        signal: abortRef.current.signal
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
        timestamp: Date.now(),
        metadata: { model }
      }

      // 发送 done 事件
      onEvent?.({
        type: 'done',
        requestId,
        conversationId,
        assistantMessage,
        finishedAt: Date.now()
      })

      // 触发缓存失效 - 使用正确的 query keys
      if (conversationId) {
        const { conversationKeys } = await import('@/hooks/api/use-conversations-query')

        // 刷新对话详情
        await queryClient.invalidateQueries({
          queryKey: conversationKeys.detail(conversationId)
        })

        // 刷新对话列表（更新最后消息/时间戳）
        await queryClient.invalidateQueries({
          queryKey: conversationKeys.lists()
        })

        // 刷新对话摘要（包含所有分页和过滤参数）
        await queryClient.invalidateQueries({
          queryKey: [...conversationKeys.lists(), 'summary']
        })
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
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

      const errorMessage = error.message || '发送消息失败'

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
    abortRef.current?.abort()
  }, [])

  return {
    sendMessage,
    stopGeneration,
    isStreaming: !!abortRef.current
  }
}