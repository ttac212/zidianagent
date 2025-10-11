/**
 * 批次状态 SSE 推送
 * GET /api/creative/batches/:batchId/events
 * 
 * 使用 statusVersion 实现增量更新和客户端去重
 */

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { unauthorized, notFound } from '@/lib/api/http-response'
import { hasMerchantAccess } from '@/lib/auth/merchant-access'

export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) {
    return unauthorized('未认证访问')
  }

  const { batchId } = params

  // 验证批次存在并获取商家ID
  const batch = await prisma.creativeBatch.findUnique({
    where: { id: batchId },
    select: { 
      id: true,
      merchantId: true,
      status: true
    }
  })

  if (!batch) {
    return notFound('批次不存在')
  }

  // 验证商家访问权限
  const accessible = await hasMerchantAccess(
    token.sub,
    batch.merchantId,
    (token as any).role
  )

  if (!accessible) {
    return notFound('批次不存在或无权访问')
  }

  // 创建 SSE 流
  const encoder = new TextEncoder()
  let intervalId: NodeJS.Timeout | null = null
  let lastStatusVersion = 0

  const stream = new ReadableStream({
    async start(controller) {
      // 发送初始事件
      const sendEvent = (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }

      // 心跳
      const sendHeartbeat = () => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
      }

      // 查询批次状态
      const checkBatchStatus = async () => {
        try {
          const currentBatch = await prisma.creativeBatch.findUnique({
            where: { id: batchId },
            select: {
              id: true,
              status: true,
              statusVersion: true,
              startedAt: true,
              completedAt: true,
              errorCode: true,
              errorMessage: true,
              tokenUsage: true,
              _count: {
                select: { copies: true }
              }
            }
          })

          if (!currentBatch) {
            sendEvent('error', { message: '批次已被删除' })
            controller.close()
            if (intervalId) clearInterval(intervalId)
            return
          }

          // 只在 statusVersion 变化时推送
          if (currentBatch.statusVersion > lastStatusVersion) {
            lastStatusVersion = currentBatch.statusVersion

            sendEvent('batch-status', {
              batchId: currentBatch.id,
              status: currentBatch.status,
              statusVersion: currentBatch.statusVersion,
              startedAt: currentBatch.startedAt,
              completedAt: currentBatch.completedAt,
              errorCode: currentBatch.errorCode,
              errorMessage: currentBatch.errorMessage,
              tokenUsage: currentBatch.tokenUsage,
              copyCount: currentBatch._count.copies,
              timestamp: new Date().toISOString()
            })

            // 如果已完成（SUCCEEDED/PARTIAL_SUCCESS/FAILED/ARCHIVED），关闭流
            if (['SUCCEEDED', 'PARTIAL_SUCCESS', 'FAILED', 'ARCHIVED'].includes(currentBatch.status)) {
              sendEvent('complete', { 
                batchId: currentBatch.id,
                finalStatus: currentBatch.status 
              })
              controller.close()
              if (intervalId) clearInterval(intervalId)
            }
          }
        } catch (error: any) {
          console.error('[SSE] Error checking batch status:', error)
          sendEvent('error', { message: error.message })
          controller.close()
          if (intervalId) clearInterval(intervalId)
        }
      }

      // 立即发送初始状态
      await checkBatchStatus()

      // 每秒轮询一次
      intervalId = setInterval(checkBatchStatus, 1000)

      // 每30秒发送心跳
      const heartbeatId = setInterval(sendHeartbeat, 30000)

      // 清理
      request.signal.addEventListener('abort', () => {
        if (intervalId) clearInterval(intervalId)
        clearInterval(heartbeatId)
        controller.close()
      })
    },

    cancel() {
      if (intervalId) clearInterval(intervalId)
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // 禁用 nginx 缓冲
    }
  })
}

export const dynamic = 'force-dynamic'
