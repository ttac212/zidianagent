/**
 * 商家数据流式同步 API
 * POST /api/merchants/sync-stream - SSE 流式批量同步商家数据
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { updateMerchantVideos } from '@/lib/tikhub/sync-service'
import { unauthorized, validationError } from '@/lib/api/http-response'

export const maxDuration = 300 // 5分钟超时

/**
 * SSE 事件类型
 */
type SSEEvent =
  | { type: 'started'; data: { total: number } }
  | {
      type: 'progress'
      data: {
        current: number
        total: number
        merchantId: string
        merchantName: string
        success: boolean
        newVideos?: number
        updatedVideos?: number
        errors?: string[]
      }
    }
  | {
      type: 'done'
      data: {
        total: number
        success: number
        failed: number
        totalNewVideos: number
        totalUpdatedVideos: number
      }
    }
  | { type: 'error'; data: { message: string } }

/**
 * 发送 SSE 事件
 */
function sendSSE(controller: ReadableStreamDefaultController, event: SSEEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`
  controller.enqueue(new TextEncoder().encode(data))
}

/**
 * POST /api/merchants/sync-stream
 * 根据筛选条件批量同步商家数据（SSE 流式输出）
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户权限（仅管理员）
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return unauthorized('仅管理员可执行数据同步')
    }

    // 2. 解析请求体（筛选条件）
    const body = await request.json()
    const { filters, limit = 20 } = body

    // 3. 构建查询条件（复用商家列表的筛选逻辑）
    const where: any = {}

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
        { location: { contains: filters.search } },
      ]
    }

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId
    }

    if (filters?.location) {
      where.location = { contains: filters.location }
    }

    if (filters?.businessType) {
      where.businessType = filters.businessType
    }

    if (filters?.status) {
      where.status = filters.status
    }

    // 4. 查询符合条件的商家
    const merchants = await prisma.merchant.findMany({
      where,
      select: {
        id: true,
        name: true,
        uid: true,
      },
      take: 100, // 最多同步 100 个商家
    })

    if (merchants.length === 0) {
      return validationError('没有符合条件的商家需要同步')
    }

    // 5. 创建 SSE 流
    const stream = new ReadableStream({
      async start(controller) {
        // 创建中止信号监听器
        let isCancelled = false
        const handleAbort = () => {
          isCancelled = true
        }

        request.signal.addEventListener('abort', handleAbort)

        try {
          // 检查是否已取消
          if (request.signal.aborted) {
            sendSSE(controller, {
              type: 'error',
              data: { message: '同步已取消' },
            })
            controller.close()
            return
          }

          // 发送开始事件
          sendSSE(controller, {
            type: 'started',
            data: { total: merchants.length },
          })

          // 统计数据
          let successCount = 0
          let failedCount = 0
          let totalNewVideos = 0
          let totalUpdatedVideos = 0

          // 遍历同步每个商家
          for (let i = 0; i < merchants.length; i++) {
            // 检查是否已取消
            if (isCancelled || request.signal.aborted) {
              sendSSE(controller, {
                type: 'error',
                data: { message: `同步已取消（已完成 ${i}/${merchants.length}）` },
              })
              break
            }

            const merchant = merchants[i]

            try {
              // 执行同步
              const result = await updateMerchantVideos(merchant.id, { limit })

              // 同步后再次检查取消状态
              if (isCancelled || request.signal.aborted) {
                sendSSE(controller, {
                  type: 'error',
                  data: { message: `同步已取消（已完成 ${i + 1}/${merchants.length}）` },
                })
                break
              }

              if (result.success) {
                successCount++
                totalNewVideos += result.newVideos
                totalUpdatedVideos += result.updatedVideos
              } else {
                failedCount++
              }

              // 发送进度事件
              sendSSE(controller, {
                type: 'progress',
                data: {
                  current: i + 1,
                  total: merchants.length,
                  merchantId: merchant.id,
                  merchantName: merchant.name,
                  success: result.success,
                  newVideos: result.newVideos,
                  updatedVideos: result.updatedVideos,
                  errors: result.errors,
                },
              })

              // 添加延迟避免 API 限流（最后一个不需要延迟）
              if (i < merchants.length - 1) {
                // 在延迟期间也检查取消状态
                const delayPromise = new Promise<void>((resolve) => {
                  const timer = setTimeout(() => resolve(), 2000)
                  const checkAbort = () => {
                    clearTimeout(timer)
                    resolve()
                  }
                  request.signal.addEventListener('abort', checkAbort, { once: true })
                })
                await delayPromise
              }
            } catch (error: any) {
              failedCount++

              // 发送失败进度事件
              sendSSE(controller, {
                type: 'progress',
                data: {
                  current: i + 1,
                  total: merchants.length,
                  merchantId: merchant.id,
                  merchantName: merchant.name,
                  success: false,
                  errors: [error.message || '同步失败'],
                },
              })
            }
          }

          // 只有在未取消的情况下才发送完成事件
          if (!isCancelled && !request.signal.aborted) {
            sendSSE(controller, {
              type: 'done',
              data: {
                total: merchants.length,
                success: successCount,
                failed: failedCount,
                totalNewVideos,
                totalUpdatedVideos,
              },
            })
          }

          controller.close()
        } catch (error: any) {
          // 发送错误事件
          sendSSE(controller, {
            type: 'error',
            data: { message: error.message || '同步过程中发生错误' },
          })
          controller.close()
        } finally {
          // 清理监听器
          request.signal.removeEventListener('abort', handleAbort)
        }
      },
      cancel() {
        // 当客户端断开连接时调用
        console.info('[sync-stream] 客户端已断开连接')
      }
    })

    // 6. 返回 SSE 流
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('启动流式同步失败:', error)

    // 如果还没有开始流式传输，返回错误响应
    return new Response(
      JSON.stringify({
        error: true,
        message: error.message || '启动同步失败',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

export const dynamic = 'force-dynamic'
