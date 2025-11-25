/**
 * 抖音Pipeline SSE处理器 - 重构版
 *
 * 2025年重构改进：
 * - 使用 QuotaAdjuster 统一配额调整，消除分叉逻辑
 * - 使用 abort-utils 统一取消/超时处理
 * - 拆分为三个阶段：认证预留、运行Pipeline、收尾
 * - 统一事件发送策略：只有配额调整成功才发送 done 事件
 *
 * 配额管理流程：
 * 1. 预留配额（estimatedTokens）
 * 2. 运行Pipeline（不提交配额，只收集结果）
 * 3. 收尾：调用 QuotaAdjuster 一次性处理配额调整和消息保存
 * 4. 根据结果发送 done/error 事件
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { QuotaManager } from '@/lib/security/quota-manager'
import { adjustQuota } from '@/lib/security/quota-adjuster'
import { calculateDouyinTokens } from '@/lib/constants/douyin-quota'
import { forbidden } from '@/lib/api/http-response'
import { AbortError, ensureNotAborted } from '@/lib/utils/abort-utils'

// ============================================================================
// 类型定义
// ============================================================================

interface PipelineResult {
  markdown?: string | null
}

/**
 * Pipeline 事件类型（宽松定义，兼容各种 Pipeline 实现）
 */
interface PipelineEventBase {
  type: string
  [key: string]: unknown
}

interface PipelineDoneEvent extends PipelineEventBase {
  type: 'done'
  markdown: string
}

type PipelineEvent = PipelineEventBase | PipelineDoneEvent

type EventHandler = (event: PipelineEvent) => Promise<void>

/**
 * Pipeline 函数类型（宽松定义，兼容 runDouyinPipeline 和 runDouyinCommentsPipeline）
 */
type PipelineFunction = (
  shareLink: string,
  onEvent: (event: any) => Promise<void>,
  options?: { signal?: AbortSignal }
) => Promise<PipelineResult>

interface DouyinSSEHandlerConfig {
  shareLink: string
  userId: string
  conversationId?: string
  model: string
  estimatedTokens: number
  request: NextRequest
  userMessage: string
  pipeline: PipelineFunction
  eventPrefix: string
  featureName: string
}

// ============================================================================
// SSE 事件发送器
// ============================================================================

interface SSEController {
  send: (type: string, payload: unknown) => void
  finish: () => void
  isClosed: () => boolean
}

function createSSEController(
  controller: ReadableStreamDefaultController<Uint8Array>,
  featureName: string
): SSEController {
  const encoder = new TextEncoder()
  let closed = false

  return {
    send(type: string, payload: unknown) {
      if (closed) return

      try {
        const chunk = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`
        controller.enqueue(encoder.encode(chunk))
      } catch (error) {
        const code = (error as { code?: string })?.code
        if (code === 'ECONNRESET' || code === 'ERR_INVALID_STATE') {
          closed = true
        } else {
          console.error(`[${featureName}] Failed to send event:`, error)
        }
      }
    },

    finish() {
      if (closed) return
      closed = true

      try {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch {
        // 忽略关闭时的错误
      }

      try {
        controller.close()
      } catch {
        // 忽略关闭时的错误
      }
    },

    isClosed() {
      return closed
    }
  }
}

async function releaseReservedTokens(userId: string, estimatedTokens: number) {
  if (estimatedTokens > 0) {
    await QuotaManager.releaseTokens(userId, estimatedTokens)
  }
}

// ============================================================================
// 阶段1：认证和预留
// ============================================================================

type AuthResult =
  | { success: true }
  | { success: false; response: Response }

async function authenticateAndReserve(
  config: DouyinSSEHandlerConfig
): Promise<AuthResult> {
  const { userId, conversationId, estimatedTokens } = config

  // 1. 预留配额
  const quotaResult = await QuotaManager.reserveTokens(userId, estimatedTokens)
  if (!quotaResult.success) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: quotaResult.message || '配额不足' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-Quota-Exceeded': 'true'
          }
        }
      )
    }
  }

  // 2. 验证会话权限
  if (conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId }
    })

    if (!conversation) {
      await QuotaManager.releaseTokens(userId, estimatedTokens)
      return {
        success: false,
        response: forbidden('无权访问此对话')
      }
    }
  }

  return { success: true }
}

// ============================================================================
// 阶段2：运行 Pipeline
// ============================================================================

interface PipelineRunResult {
  markdown: string | null
  pendingDoneEvent: PipelineEvent | null
  aborted: boolean
  error?: Error
}

async function runPipelinePhase(
  config: DouyinSSEHandlerConfig,
  sse: SSEController
): Promise<PipelineRunResult> {
  const { shareLink, pipeline, eventPrefix, request } = config

  let markdown: string | null = null
  let pendingDoneEvent: PipelineEvent | null = null

  try {
    ensureNotAborted(request.signal)

    const result = await pipeline(
      shareLink,
      async (event) => {
        switch (event.type) {
          case 'progress':
          case 'info':
          case 'partial':
            sse.send(`${eventPrefix}-${event.type}`, event)
            break
          case 'done':
            // 缓存 done 事件，等配额调整成功后再发送
            markdown = event.markdown
            pendingDoneEvent = event
            break
          case 'error':
            sse.send(`${eventPrefix}-error`, event)
            break
        }
      },
      { signal: request.signal }
    )

    // Pipeline 可能通过返回值返回 markdown
    if (!markdown && result?.markdown) {
      markdown = result.markdown
    }

    return { markdown, pendingDoneEvent, aborted: false }
  } catch (error) {
    const isAbort =
      error instanceof AbortError ||
      (error as { name?: string })?.name === 'AbortError' ||
      (error as { code?: string })?.code === 'ABORT_ERR'

    return {
      markdown: null,
      pendingDoneEvent: null,
      aborted: isAbort,
      error: error instanceof Error ? error : new Error(String(error))
    }
  }
}

// ============================================================================
// 阶段3：收尾（配额调整 + 事件发送）
// ============================================================================

async function finalizePhase(
  config: DouyinSSEHandlerConfig,
  sse: SSEController,
  pipelineResult: PipelineRunResult
): Promise<void> {
  const {
    userId,
    conversationId,
    model,
    estimatedTokens,
    userMessage,
    eventPrefix,
    featureName
  } = config

  const { markdown, pendingDoneEvent, aborted, error } = pipelineResult

  // 情况1：用户中止
  if (aborted) {
    await releaseReservedTokens(userId, estimatedTokens)
    console.info(`[${featureName}] Aborted by user, quota released: ${estimatedTokens}`)
    return
  }

  // 情况2：Pipeline 错误
  if (error && !markdown) {
    await releaseReservedTokens(userId, estimatedTokens)

    const errorCode = (error as { code?: string })?.code
    if (errorCode === 'ECONNRESET' || errorCode === 'EPIPE') {
      console.info(`[${featureName}] Client disconnected, quota released: ${estimatedTokens}`)
    } else {
      console.error(`[${featureName}] Pipeline failed:`, error)
    }
    return
  }

  // 情况3：Pipeline 完成但无结果
  if (!markdown) {
    await releaseReservedTokens(userId, estimatedTokens)
    console.warn(`[${featureName}] Pipeline completed without result, quota released`)
    return
  }

  // 情况4：Pipeline 成功，调用 QuotaAdjuster 处理配额
  const actualTokens = calculateDouyinTokens(userMessage, markdown)

  const adjustResult = await adjustQuota({
    userId,
    estimatedTokens,
    actualTokens,
    conversationId,
    modelId: model,
    userMessage,
    assistantMessage: markdown
  })

  // 根据调整结果发送事件
  switch (adjustResult.status) {
    case 'success':
      // 完全成功：发送 done 事件
      sse.send(
        `${eventPrefix}-done`,
        pendingDoneEvent ?? { type: 'done', markdown }
      )
      console.info(
        `[${featureName}] Success: estimated=${estimatedTokens}, ` +
        `actual=${adjustResult.totalActualTokens}, charged=${adjustResult.chargedTokens}`
      )
      break

    case 'partial':
      // 部分成功：内容已生成，配额按预估值计费，超额部分未计费
      // 重要：仍然发送 done 事件（附带警告），让前端能正确保存消息
      // 如果只发 error，前端会丢失 finalContent，导致消息无法保存
      sse.send(`${eventPrefix}-done`, {
        ...(pendingDoneEvent ?? { type: 'done', markdown }),
        quotaWarning: adjustResult.message || '配额不足：实际用量超出预估，本次已按预估值计费'
      })
      console.warn(`[${featureName}] Partial: ${adjustResult.message || '配额不足'}`)
      break

    case 'failed':
      // 完全失败：需要释放配额并发送错误
      await releaseReservedTokens(userId, estimatedTokens)
      sse.send(`${eventPrefix}-error`, {
        type: 'error',
        message: adjustResult.message || '配额调整失败，请重试'
      })
      console.error(`[${featureName}] Failed: ${adjustResult.message || '未知错误'}`)
      break
  }
}

// ============================================================================
// 主入口
// ============================================================================

/**
 * 统一的抖音Pipeline SSE处理器
 */
export async function handleDouyinPipeline(
  config: DouyinSSEHandlerConfig
): Promise<Response> {
  const { request, featureName } = config

  // 阶段1：认证和预留
  const authResult = await authenticateAndReserve(config)
  if (!authResult.success) {
    return authResult.response
  }

  // 创建 SSE 流
  const stream = new ReadableStream({
    async start(controller) {
      const sse = createSSEController(controller, featureName)

      // 设置中止处理
      const handleAbort = async () => {
        if (!sse.isClosed()) {
          sse.finish()
        }
      }
      request.signal.addEventListener('abort', handleAbort, { once: true })

      try {
        // 阶段2：运行 Pipeline
        const pipelineResult = await runPipelinePhase(config, sse)

        // 阶段3：收尾
        await finalizePhase(config, sse, pipelineResult)
      } finally {
        sse.finish()
        request.signal.removeEventListener('abort', handleAbort)
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
}
