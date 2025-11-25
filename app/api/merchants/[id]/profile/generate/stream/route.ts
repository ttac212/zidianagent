/**
 * 商家创作档案生成API路由 - SSE流式版本
 * POST /api/merchants/[id]/profile/generate/stream - 生成档案并实时推送进度
 */

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { generateMerchantProfile, type ProfileGenerateEvent } from '@/lib/ai/profile-generator'
import { isTranscriptionRequiredError } from '@/lib/errors/transcription-errors'

/**
 * SSE事件编码器
 */
function encodeSSEEvent(event: ProfileGenerateEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
}

/**
 * 创建错误响应
 */
function createErrorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, message }),
    { status, headers: { 'Content-Type': 'application/json' } }
  )
}

/**
 * POST /api/merchants/[id]/profile/generate/stream
 * 流式生成档案，实时推送进度
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 认证检查
  const token = await getToken({ req: request as any })
  if (!token?.sub) {
    return createErrorResponse('未认证', 401)
  }

  // 权限检查
  if (token.role !== 'ADMIN') {
    return createErrorResponse('只有管理员可以执行此操作', 403)
  }

  // 获取商家ID
  const { id: merchantId } = await params
  if (!merchantId) {
    return createErrorResponse('商家ID不能为空', 400)
  }

  console.info('[ProfileStreamAPI] 开始流式生成档案:', merchantId)

  // 创建AbortController用于中断生成
  const abortController = new AbortController()

  // 创建SSE流
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      // 进度回调函数
      const onProgress = (event: ProfileGenerateEvent) => {
        // 检查是否已中断
        if (abortController.signal.aborted) {
          return
        }
        try {
          const sseData = encodeSSEEvent(event)
          controller.enqueue(encoder.encode(sseData))
        } catch (e) {
          console.error('[ProfileStreamAPI] 发送事件失败:', e)
        }
      }

      try {
        // 调用生成函数，传入进度回调和中断信号
        await generateMerchantProfile(merchantId, onProgress, abortController.signal)
      } catch (error: any) {
        // 如果是中断错误，不推送错误事件
        if (abortController.signal.aborted) {
          console.info('[ProfileStreamAPI] 生成被用户取消')
          return
        }

        console.error('[ProfileStreamAPI] 生成失败:', error)

        // 处理转录需求错误（已在onProgress中发送了transcription_required事件）
        if (!isTranscriptionRequiredError(error)) {
          // 发送错误事件（只在这里推送，避免重复）
          const errorEvent: ProfileGenerateEvent = {
            type: 'error',
            data: {
              message: error.message || '生成失败',
              code: error.code
            }
          }
          try {
            controller.enqueue(encoder.encode(encodeSSEEvent(errorEvent)))
          } catch (e) {
            // 忽略推送失败
          }
        }
      } finally {
        controller.close()
      }
    },

    cancel() {
      // 当客户端断开连接时触发
      console.info('[ProfileStreamAPI] 客户端断开连接，中断生成')
      abortController.abort()
    }
  })

  // 监听请求中断
  request.signal.addEventListener('abort', () => {
    console.info('[ProfileStreamAPI] 请求被中断')
    abortController.abort()
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // 禁用nginx缓冲
    }
  })
}
