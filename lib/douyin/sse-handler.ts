/**
 * 抖音Pipeline SSE处理器 - 消除重复代码
 *
 * 统一处理：
 * - 权限验证
 * - 配额预留/提交/释放
 * - 用户消息保存
 * - SSE流构建
 * - 助手消息保存
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { QuotaManager } from '@/lib/security/quota-manager'
import { calculateDouyinTokens } from '@/lib/constants/douyin-quota'
import { forbidden } from '@/lib/api/http-response'

/**
 * Pipeline结果类型
 */
interface PipelineResult {
  markdown?: string | null
}

/**
 * Pipeline事件类型
 */
type PipelineEvent =
  | { type: 'progress'; [key: string]: any }
  | { type: 'info'; [key: string]: any }
  | { type: 'partial'; [key: string]: any }
  | { type: 'done'; markdown: string; [key: string]: any }
  | { type: 'error'; [key: string]: any }

/**
 * Pipeline事件处理器
 */
type EventHandler = (event: PipelineEvent) => Promise<void>

/**
 * Pipeline函数类型
 */
type PipelineFunction = (
  shareLink: string,
  onEvent: EventHandler,
  options: { signal: AbortSignal }
) => Promise<PipelineResult>

/**
 * SSE处理器配置
 */
interface DouyinSSEHandlerConfig {
  shareLink: string
  userId: string
  conversationId?: string
  model: string
  estimatedTokens: number
  request: NextRequest
  userMessage: string

  // Pipeline特定配置
  pipeline: PipelineFunction
  eventPrefix: string  // 'douyin' or 'comments'
  featureName: string  // 用于日志标识
}

/**
 * 统一的抖音Pipeline SSE处理器
 * 消除视频提取和评论分析的重复代码
 */
export async function handleDouyinPipeline(
  config: DouyinSSEHandlerConfig
): Promise<Response> {
  const {
    shareLink,
    userId,
    conversationId,
    model,
    estimatedTokens,
    request,
    userMessage,
    pipeline,
    eventPrefix,
    featureName
  } = config

  // 1. 预留配额
  const quotaResult = await QuotaManager.reserveTokens(userId, estimatedTokens)
  if (!quotaResult.success) {
    return new Response(
      JSON.stringify({
        error: quotaResult.message || '配额不足'
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-Quota-Exceeded': 'true'
        }
      }
    )
  }

  // 2. 验证会话权限
  if (conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId }
    })

    if (!conversation) {
      // 释放预留的配额
      await QuotaManager.releaseTokens(userId, estimatedTokens)
      return forbidden('无权访问此对话')
    }

    // 3. 保存用户消息
    try {
      const userTokens = calculateDouyinTokens(userMessage, '')
      await QuotaManager.commitTokens(
        userId,
        { promptTokens: userTokens.promptTokens, completionTokens: 0 },
        Math.floor(estimatedTokens * 0.1), // 用户消息占估算的10%
        {
          conversationId,
          role: 'USER',
          content: userMessage,
          modelId: model
        }
      )
    } catch (dbError) {
      console.error(`[${featureName}] Failed to save user message:`, dbError)
    }
  }

  // 4. 创建SSE流
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
          // 连接已关闭时静默失败（ECONNRESET/客户端断开）
          const errorCode = (enqueueError as any)?.code
          if (errorCode === 'ECONNRESET' || errorCode === 'ERR_INVALID_STATE') {
            isClosed = true // 标记为已关闭，防止后续尝试
          } else {
            console.error(`[${featureName}] Failed to enqueue event:`, enqueueError)
          }
        }
      }

      const finishStream = () => {
        if (isClosed) return
        isClosed = true
        try {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (doneError) {
          // 连接已关闭时静默失败（ECONNRESET/客户端断开）
          const errorCode = (doneError as any)?.code
          if (errorCode !== 'ECONNRESET' && errorCode !== 'ERR_INVALID_STATE') {
            console.error(`[${featureName}] Failed to enqueue DONE marker:`, doneError)
          }
        } finally {
          try {
            controller.close()
          } catch (closeError) {
            // 连接已关闭时静默失败
            const errorCode = (closeError as any)?.code
            if (errorCode !== 'ECONNRESET' && errorCode !== 'ERR_INVALID_STATE') {
              console.error(`[${featureName}] Failed to close stream:`, closeError)
            }
          }
        }
      }

      const abortHandler = () => finishStream()
      request.signal.addEventListener('abort', abortHandler)

      try {
        let finalMarkdown: string | null = null

        // 5. 运行Pipeline
        const result = await pipeline(
          shareLink,
          async (event) => {
            switch (event.type) {
              case 'progress':
                sendEvent(`${eventPrefix}-progress`, event)
                break
              case 'info':
                sendEvent(`${eventPrefix}-info`, event)
                break
              case 'partial':
                sendEvent(`${eventPrefix}-partial`, event)
                break
              case 'done':
                finalMarkdown = event.markdown
                sendEvent(`${eventPrefix}-done`, event)
                break
              case 'error':
                sendEvent(`${eventPrefix}-error`, event)
                break
            }
          },
          { signal: request.signal }
        )

        if (!finalMarkdown && result?.markdown) {
          finalMarkdown = result.markdown
        }

        // 6. 保存助手消息
        if (conversationId && finalMarkdown) {
          try {
            const actualTokens = calculateDouyinTokens(shareLink, finalMarkdown)

            await QuotaManager.commitTokens(
              userId,
              {
                promptTokens: actualTokens.promptTokens,
                completionTokens: actualTokens.completionTokens
              },
              Math.floor(estimatedTokens * 0.9), // 助手消息占估算的90%
              {
                conversationId,
                role: 'ASSISTANT',
                content: finalMarkdown,
                modelId: model
              }
            )
          } catch (dbError) {
            console.error(`[${featureName}] Failed to save assistant message:`, dbError)
            // 保存失败时释放剩余配额
            await QuotaManager.releaseTokens(userId, Math.floor(estimatedTokens * 0.9))
          }
        }
      } catch (err) {
        // Pipeline失败，释放所有预留配额
        await QuotaManager.releaseTokens(userId, estimatedTokens)

        // 区分不同类型的错误以避免噪音日志
        const errorCode = (err as any)?.code
        const errorName = (err as Error)?.name

        if (errorName === 'AbortError' || errorCode === 'ABORT_ERR') {
          // 用户主动取消，正常情况
          console.info(`[${featureName}] Pipeline aborted by user`)
        } else if (errorCode === 'ECONNRESET' || errorCode === 'EPIPE') {
          // 客户端断开连接，正常情况（用户关闭页面/刷新）
          console.info(`[${featureName}] Client disconnected (${errorCode})`)
        } else {
          // 真正的错误
          console.error(`[${featureName}] Pipeline failed:`, err)
        }
      } finally {
        finishStream()
        request.signal.removeEventListener('abort', abortHandler)
      }
    }
  })

  // 7. 返回SSE响应
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
