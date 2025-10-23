/**
 * Chat API - Linus 版本
 * 简单、直接、有数据持久化
 */

import { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { prisma } from "@/lib/prisma"
import { selectApiKey } from "@/lib/ai/key-manager"
import {
  createSSETransformStream,
  isTransformStreamSupported,
  processSSEStream,
  type SSEMessage
} from "@/lib/utils/sse-parser"
import { checkRateLimit } from "@/lib/security/rate-limiter"
import { trimForChatAPI } from "@/lib/chat/context-trimmer"
import { DEFAULT_MODEL, isAllowed } from "@/lib/ai/models"
import { QuotaManager, QuotaExceededError } from "@/lib/security/quota-manager"
import { getModelContextConfig } from "@/lib/constants/message-limits"
import {
  error,
  validationError,
  forbidden,
  unauthorized
} from '@/lib/api/http-response'
import {
  detectDouyinLink,
  extractDouyinLink,
  isDouyinShareRequest,
  isDouyinVideoExtractionRequest
} from "@/lib/douyin/link-detector"
import { runDouyinPipeline } from "@/lib/douyin/pipeline"
import { runDouyinCommentsPipeline } from "@/lib/douyin/comments-pipeline"


const API_BASE = process.env.LLM_API_BASE || "https://api.302.ai/v1"

export async function POST(request: NextRequest) {
  try {
    // 1. 认证
    const token = await getToken({ req: request as any })
    if (!token?.sub) {
      return unauthorized('未认证')
    }

    const userId = String(token.sub)

  // 2. 速率限制检查（修复形同虚设问题）
  const rateLimitResult = await checkRateLimit(request, 'CHAT', userId)
  if (!rateLimitResult.allowed) {
    return error(
      rateLimitResult.error?.message || '请求过于频繁',
      { status: 429 }
    )
  }

  // 3. 原子性配额检查和预留（修复R2：真正的原子操作）
  const body = await request.json()
  const {
    conversationId,
    messages,
    model = DEFAULT_MODEL,
    temperature = 0.7,
    creativeMode = false  // 创作模式：启用长文本优化
  } = body

  // SECURITY: 强制模型白名单验证
  if (!isAllowed(model)) {
    return validationError(
      `Model '${model}' is not allowed. Check MODEL_ALLOWLIST configuration.`
    )
  }

  // 验证 messages 参数
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return validationError('messages 参数不能为空')
  }

  // === 抖音链接处理：默认评论分析，除非明确要求视频提取 ===
  const lastUserMessage = messages[messages.length - 1]

  if (lastUserMessage?.role === 'user' && detectDouyinLink(lastUserMessage.content)) {
    console.info('[Douyin] 检测到抖音链接')

    // 优先检查是否明确请求视频文案提取
    if (isDouyinVideoExtractionRequest(lastUserMessage.content)) {
      console.info('[Douyin] 明确请求视频文案提取')

      const shareLink = extractDouyinLink(lastUserMessage.content)
      if (!shareLink) {
        return validationError('无法提取抖音链接')
      }

      // SECURITY: 必须在保存消息前校验会话权限
      if (conversationId) {
        const conversation = await prisma.conversation.findFirst({
          where: { id: conversationId, userId }
        })

        if (!conversation) {
          return forbidden('无权访问此对话')
        }

        try {
          await QuotaManager.commitTokens(
            userId,
            { promptTokens: 0, completionTokens: 0 },
            0,
            {
              conversationId,
              role: 'USER',
              content: lastUserMessage.content,
              modelId: model
            }
          )
        } catch (dbError) {
          console.error('[Douyin] Failed to save user message:', dbError)
        }
      }

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          let isClosed = false

          const sendEvent = (type: string, payload: unknown) => {
            if (isClosed) return

            try {
              const chunk = `event: ${type}\n` +
                            `data: ${JSON.stringify(payload)}\n\n`
              controller.enqueue(encoder.encode(chunk))
            } catch (enqueueError) {
              console.error('[Douyin] Failed to enqueue event:', enqueueError)
            }
          }

          const finishStream = () => {
            if (isClosed) return
            isClosed = true
            try {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            } catch (doneError) {
              console.error('[Douyin] Failed to enqueue DONE marker:', doneError)
            } finally {
              controller.close()
            }
          }

          const abortHandler = () => finishStream()

          request.signal.addEventListener('abort', abortHandler)

          try {
            let finalMarkdown: string | null = null

            const result = await runDouyinPipeline(
              shareLink,
              async (event) => {
                switch (event.type) {
                  case 'progress':
                    sendEvent('douyin-progress', event)
                    break
                  case 'info':
                    sendEvent('douyin-info', event)
                    break
                  case 'partial':
                    sendEvent('douyin-partial', event)
                    break
                  case 'done':
                    finalMarkdown = event.markdown
                    sendEvent('douyin-done', event)
                    break
                  case 'error':
                    sendEvent('douyin-error', event)
                    break
                }
              },
              { signal: request.signal }
            )

            if (!finalMarkdown && result?.markdown) {
              finalMarkdown = result.markdown
            }

            // SECURITY: 助手消息保存时再次确认权限(防御性编程)
            if (conversationId && finalMarkdown) {
              try {
                await QuotaManager.commitTokens(
                  userId,
                  { promptTokens: 0, completionTokens: 0 },
                  0,
                  {
                    conversationId,
                    role: 'ASSISTANT',
                    content: finalMarkdown,
                    modelId: model
                  }
                )
              } catch (dbError) {
                console.error('[Douyin] Failed to save assistant message:', dbError)
              }
            }
          } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
              console.warn('[Douyin] Pipeline aborted by client')
            } else {
              console.error('[Douyin] Pipeline failed:', err)
            }
          } finally {
            finishStream()
            request.signal.removeEventListener('abort', abortHandler)
          }
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      })
    }

    // 默认：评论分析（只要是纯分享请求）
    if (isDouyinShareRequest(lastUserMessage.content)) {
      console.info('[Douyin Comments] 默认处理评论分析请求')

      const shareLink = extractDouyinLink(lastUserMessage.content)
      if (!shareLink) {
        return validationError('无法提取抖音链接')
      }

      // SECURITY: 必须在保存消息前校验会话权限
      if (conversationId) {
        const conversation = await prisma.conversation.findFirst({
          where: { id: conversationId, userId }
        })

        if (!conversation) {
          return forbidden('无权访问此对话')
        }

        try {
          await QuotaManager.commitTokens(
            userId,
            { promptTokens: 0, completionTokens: 0 },
            0,
            {
              conversationId,
              role: 'USER',
              content: lastUserMessage.content,
              modelId: model
            }
          )
        } catch (dbError) {
          console.error('[Douyin Comments] Failed to save user message:', dbError)
        }
      }

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          let isClosed = false

          const sendEvent = (type: string, payload: unknown) => {
            if (isClosed) return

            try {
              const chunk = `event: ${type}\n` + `data: ${JSON.stringify(payload)}\n\n`
              controller.enqueue(encoder.encode(chunk))
            } catch (enqueueError) {
              console.error('[Douyin Comments] Failed to enqueue event:', enqueueError)
            }
          }

          const finishStream = () => {
            if (isClosed) return
            isClosed = true
            try {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            } catch (doneError) {
              console.error('[Douyin Comments] Failed to enqueue DONE marker:', doneError)
            } finally {
              controller.close()
            }
          }

          const abortHandler = () => finishStream()
          request.signal.addEventListener('abort', abortHandler)

          try {
            let finalMarkdown: string | null = null

            const result = await runDouyinCommentsPipeline(
              shareLink,
              async (event) => {
                switch (event.type) {
                  case 'progress':
                    sendEvent('comments-progress', event)
                    break
                  case 'info':
                    sendEvent('comments-info', event)
                    break
                  case 'partial':
                    sendEvent('comments-partial', event)
                    break
                  case 'done':
                    finalMarkdown = event.markdown
                    sendEvent('comments-done', event)
                    break
                  case 'error':
                    sendEvent('comments-error', event)
                    break
                }
              },
              { signal: request.signal }
            )

            if (!finalMarkdown && result?.markdown) {
              finalMarkdown = result.markdown
            }

            // SECURITY: 助手消息保存时再次确认权限
            if (conversationId && finalMarkdown) {
              try {
                await QuotaManager.commitTokens(
                  userId,
                  { promptTokens: 0, completionTokens: 0 },
                  0,
                  {
                    conversationId,
                    role: 'ASSISTANT',
                    content: finalMarkdown,
                    modelId: model
                  }
                )
              } catch (dbError) {
                console.error('[Douyin Comments] Failed to save assistant message:', dbError)
              }
            }
          } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
              console.warn('[Douyin Comments] Pipeline aborted by client')
            } else {
              console.error('[Douyin Comments] Pipeline failed:', err)
            }
          } finally {
            finishStream()
            request.signal.removeEventListener('abort', abortHandler)
          }
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      })
    } else {
      console.info('[Douyin] 检测到抖音链接但不是纯分享请求,保持原样进入普通聊天')
    }
  }

  // 服务端统一裁剪（防止客户端绕过限制）- 基于实际模型上限
  const trimResult = trimForChatAPI(messages, model, creativeMode)
  const finalMessages = trimResult.messages

  // 估算本次请求需要的token数量（保守估计）
  const estimatedTokens = Math.max(trimResult.estimatedTokens * 1.5, 1000) // 预留50%缓冲

  // 原子性预留配额 - 真正的数据库事务
  const quotaResult = await QuotaManager.reserveTokens(userId, estimatedTokens)
  if (!quotaResult.success) {
    return error(
      quotaResult.message || '配额不足',
      {
        status: 429,
        details: {
          currentUsage: quotaResult.currentUsage,
          limit: quotaResult.limit
        }
      }
    )
  }

  if (trimResult.trimmed) {
    console.info(`[API] Server-side trim: ${trimResult.dropCount} messages dropped, tokens: ${trimResult.estimatedTokens}`)

    // SECURITY: 如果裁剪太多，返回友好错误而不是继续处理
    if (trimResult.dropCount > messages.length * 0.5) {
      // 释放预留的配额
      await QuotaManager.releaseTokens(userId, estimatedTokens)
      return error(
        `对话过长，已超出模型${model}的上下文限制。请考虑分段对话或总结之前的内容。`,
        {
          status: 400,
          details: {
            modelLimit: true,
            droppedMessages: trimResult.dropCount,
            totalMessages: messages.length
          }
        }
      )
    }
  }

  // 检查最新用户消息是否被裁剪掉（防止空上下文发送到模型）
  const originalLastMessage = messages[messages.length - 1]
  const trimmedLastMessage = finalMessages[finalMessages.length - 1]

  if (originalLastMessage?.role === 'user' &&
      (!trimmedLastMessage || trimmedLastMessage.id !== originalLastMessage.id)) {
    // 释放预留的配额
    await QuotaManager.releaseTokens(userId, estimatedTokens)
    return error(
      '输入内容过长，超出了单次对话的token限制。请尝试缩短消息内容或分段发送。',
      { status: 400 }
    )
  }

  // 3. 验证对话归属权（修复越权漏洞）
  if (conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId }
    })

    if (!conversation) {
      // 释放预留的配额
      await QuotaManager.releaseTokens(userId, estimatedTokens)
      return forbidden('无权访问此对话')
    }
  }

  // 4. 保存用户消息（权限已验证）- 使用真正的QuotaManager
  if (conversationId && messages.length > 0) {
    const userMessage = messages[messages.length - 1]
    if (userMessage.role === 'user') {
      try {
        // 使用QuotaManager保存用户消息（不计费）
        const success = await QuotaManager.commitTokens(
          userId,
          { promptTokens: 0, completionTokens: 0 }, // 用户消息不计费
          0, // 用户消息无预留消耗
          {
            conversationId,
            role: 'USER',
            content: userMessage.content,
            modelId: model
          }
        )

        if (!success) {
          console.error('[Chat] Failed to save user message')
          // 继续执行，不阻断用户体验
        }
      } catch (dbError) {
        console.error('[Chat] Failed to save user message:', dbError)
        // 继续执行，不阻断用户体验
      }
    }
  }

  // 5. 根据模型选择API Key
  const { apiKey, provider } = selectApiKey(model)

  if (!apiKey) {
    // 释放预留的配额
    await QuotaManager.releaseTokens(userId, estimatedTokens)
    return Response.json({
      error: `缺少${provider}模型的API Key，请在.env.local中配置对应的Key`
    }, { status: 500 })
  }

  // 6. 调用 AI - 添加max_tokens参数支持Extended Thinking模式和创作模式
  const modelConfig = getModelContextConfig(model, creativeMode)
  const maxTokens = modelConfig.outputMaxTokens || 8000

  // Prompt Caching支持（仅Claude模型）
  const isClaudeModel = model.includes('claude')
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }

  // 启用Prompt Caching（Claude模型且上下文较长时）
  if (isClaudeModel && finalMessages.length > 5) {
    headers["anthropic-beta"] = "prompt-caching-2024-07-31"
  }

  // 构建请求体
  const requestBody: Record<string, any> = {
    model,
    messages: finalMessages,
    temperature,
    max_tokens: maxTokens,
    stream: true
  }

  // Prompt Caching：标记可缓存的消息
  if (isClaudeModel && finalMessages.length > 10) {
    // 对于长对话，缓存前面的消息历史
    requestBody.messages = finalMessages.map((msg, index) => {
      // 缓存前N-5条消息（保留最近5条为动态内容）
      const shouldCache = index < finalMessages.length - 5
      if (shouldCache) {
        return {
          ...msg,
          cache_control: { type: "ephemeral" }
        }
      }
      return msg
    })
  }

  const aiResponse = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody)
  })

  if (!aiResponse.ok) {
    // 释放预留的配额
    await QuotaManager.releaseTokens(userId, estimatedTokens)
    return Response.json({ error: `AI错误: ${aiResponse.status}` }, { status: aiResponse.status })
  }

  // 7. 使用现成SSE解析工具，修复数据丢失问题
  const handleStreamCompletion = async (
    fullContent: string,
    usage?: SSEMessage["usage"]
  ) => {
    if (conversationId && fullContent) {
      try {
        const promptTokens = usage?.prompt_tokens || 0
        const completionTokens = usage?.completion_tokens || 0

        const success = await QuotaManager.commitTokens(
          userId,
          { promptTokens, completionTokens },
          estimatedTokens,
          {
            conversationId,
            role: 'ASSISTANT',
            content: fullContent,
            modelId: model
          }
        )

        if (!success) {
          console.error('[Chat] Failed to save assistant message')
          await QuotaManager.releaseTokens(userId, estimatedTokens)
        }
      } catch (dbError) {
        console.error('[Chat] Failed to save assistant message:', dbError)

        if (dbError instanceof QuotaExceededError) {
          console.error(`[Chat] Quota exceeded during commit: ${dbError.message}`)
        } else {
          await QuotaManager.releaseTokens(userId, estimatedTokens)
        }
      }
    } else {
      await QuotaManager.releaseTokens(userId, estimatedTokens)
    }
  }

  const responseBody = aiResponse.body

  if (!responseBody) {
    await QuotaManager.releaseTokens(userId, estimatedTokens)
    return error('AI响应无内容', { status: 502 })
  }

  const responseHeaders = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  } as const

  if (isTransformStreamSupported()) {
    const sseTransform = createSSETransformStream(
      undefined,
      handleStreamCompletion
    )

    return new Response(responseBody.pipeThrough(sseTransform), {
      headers: responseHeaders
    })
  }

  if (typeof responseBody.tee === 'function') {
    const [clientStream, processingStream] = responseBody.tee()
    let fallbackUsage: SSEMessage["usage"] | undefined

    processSSEStream(processingStream.getReader(), {
      onUsage(usage) {
        fallbackUsage = usage
      },
      onError(message) {
        console.error('[Chat] SSE fallback error:', message)
      }
    }).then(
      (fullContent) => handleStreamCompletion(fullContent, fallbackUsage),
      async (streamError) => {
        if (streamError instanceof Error && streamError.name === 'AbortError') {
          return
        }

        console.error('[Chat] SSE fallback processing failed:', streamError)
        await QuotaManager.releaseTokens(userId, estimatedTokens)
      }
    )

    return new Response(clientStream, {
      headers: responseHeaders
    })
  }

  console.warn('[Chat] Falling back to raw stream without TransformStream/tee support')
  await QuotaManager.releaseTokens(userId, estimatedTokens)

  return new Response(responseBody, {
    headers: responseHeaders
  })
  } catch (err) {
    console.error('[Chat] Unexpected error:', err)

    // 尝试获取 userId 和 estimatedTokens（如果已定义）
    const errorContext = {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    }

    console.error('[Chat] Error context:', errorContext)

    return error(
      '服务器内部错误，请稍后重试',
      { status: 500, details: errorContext }
    )
  }
}
