/**
 * 批量转录视频内容 API (SSE 实时进度版本)
 * GET /api/merchants/[id]/contents/batch-transcribe/stream?contentIds=id1,id2&mode=missing
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { processSSEStream } from '@/lib/utils/sse-parser'

// 移除maxDuration限制，允许长视频转录任务自然完成
// 之前设置的300秒限制会导致长视频转录被Next.js强制终止
// export const maxDuration = 300

/**
 * 发送 SSE 事件（改进版：添加状态检查）
 */
function sendSSE(
  controller: ReadableStreamDefaultController,
  event: string,
  data: any
): boolean {
  try {
    // 检查controller是否仍然打开
    if (controller.desiredSize === null) {
      console.warn('[批量转录] Controller已关闭，跳过事件:', event)
      return false
    }

    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    controller.enqueue(new TextEncoder().encode(message))
    return true
  } catch (error) {
    console.error('[批量转录] SSE发送失败:', event, error)
    return false
  }
}

/**
 * 转录单个视频内容
 */
async function transcribeContent(
  contentId: string,
  merchantId: string,
  apiKey: string
): Promise<{
  contentId: string
  status: 'success' | 'failed' | 'skipped'
  transcript?: string
  textLength?: number
  reason?: string
  error?: string
}> {
  const startTime = Date.now()
  console.log(`[批量转录] 开始处理视频: ${contentId}`)

  try {
    // 1. 获取内容详情（只需要 shareUrl）
    const content = await prisma.merchantContent.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        shareUrl: true,
        merchantId: true,
        title: true,
      },
    })

    if (!content) {
      return {
        contentId,
        status: 'failed',
        error: '内容不存在',
      }
    }

    if (content.merchantId !== merchantId) {
      return {
        contentId,
        status: 'failed',
        error: '内容不属于该商家',
      }
    }

    if (!content.shareUrl) {
      return {
        contentId,
        status: 'failed',
        error: '缺少分享链接',
      }
    }

    // 2. 调用对话模块的转录API
    console.log(`[批量转录] 调用转录API, shareUrl: ${content.shareUrl.substring(0, 60)}...`)

    // 修复：构建完整URL，避免localhost硬编码
    // 优先使用环境变量，回退到请求的origin（在route handler中不可用），最后使用localhost开发
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007'
    const apiUrl = new URL('/api/douyin/extract-text', baseUrl).toString()

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shareLink: content.shareUrl,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '未知错误' }))
      throw new Error(errorData.error || `转录API返回错误: ${response.status}`)
    }

    if (!response.body) {
      throw new Error('转录API未返回响应体')
    }

    // 3. 使用统一的 SSE 解析器 (支持 ZenMux 和标准格式)
    let finalText = ''
    const reader = response.body.getReader()

    await processSSEStream(reader, {
      onMessage: (message) => {
        // 查找 type === 'done' 的事件
        if (message.payload && typeof message.payload === 'object') {
          const data = message.payload as Record<string, any>
          if (data.type === 'done' && data.text) {
            finalText = data.text
          } else if (data.type === 'error' && data.message) {
            throw new Error(data.message)
          }
        }
      },
      onError: (error) => {
        console.error('[批量转录] SSE错误:', error)
      }
    })

    if (!finalText) {
      throw new Error('转录API未返回文本')
    }

    console.log(`[批量转录] 转录完成，文本长度: ${finalText.length}`)

    // 4. 更新数据库
    await prisma.merchantContent.update({
      where: { id: contentId },
      data: {
        transcript: finalText,
        hasTranscript: true,
      },
    })

    console.log(`[批量转录] 视频处理成功，总耗时: ${Date.now() - startTime}ms`)

    return {
      contentId,
      status: 'success',
      transcript: finalText,
      textLength: finalText.length,
    }
  } catch (error: any) {
    console.error(`[批量转录] 视频处理失败 (${Date.now() - startTime}ms):`, error)
    return {
      contentId,
      status: 'failed',
      error: error.message || '未知错误',
    }
  }
}

/**
 * GET /api/merchants/[id]/contents/batch-transcribe/stream
 * 批量转录视频内容（SSE 实时进度）
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. 权限验证（仅管理员）
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return new Response('Unauthorized', { status: 401 })
  }

  const { id: merchantId } = await params

  // 2. 解析查询参数
  const searchParams = req.nextUrl.searchParams
  const contentIdsParam = searchParams.get('contentIds')
  const mode = (searchParams.get('mode') || 'missing') as 'missing' | 'all' | 'force'
  const concurrent = parseInt(searchParams.get('concurrent') || '100')

  if (!contentIdsParam) {
    return new Response('Missing contentIds parameter', { status: 400 })
  }

  const contentIds = contentIdsParam.split(',').filter(Boolean)

  if (contentIds.length === 0) {
    return new Response('contentIds cannot be empty', { status: 400 })
  }

  // 3. 创建 SSE 流
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 发送开始事件
        sendSSE(controller, 'start', {
          total: contentIds.length,
          mode,
          concurrent,
        })

        // 4. 验证商家存在
        const merchant = await prisma.merchant.findUnique({
          where: { id: merchantId },
        })

        if (!merchant) {
          sendSSE(controller, 'error', { message: '商家不存在' })
          controller.close()
          return
        }

        // 5. 获取API Key
        const apiKey = process.env.LLM_API_KEY
        if (!apiKey) {
          sendSSE(controller, 'error', { message: '未配置API Key' })
          controller.close()
          return
        }

        // 6. 根据mode过滤内容
        let targetContents = await prisma.merchantContent.findMany({
          where: {
            id: { in: contentIds },
            merchantId,
          },
          select: {
            id: true,
            transcript: true,
            hasTranscript: true,
            title: true,
          },
        })

        // 过滤逻辑
        if (mode === 'missing') {
          // missing 模式：只处理没有转录的内容
          targetContents = targetContents.filter(
            (c) => !c.transcript || !c.hasTranscript
          )
        } else if (mode === 'all') {
          // all 模式：处理所有内容，但后续会跳过已有转录的
          // 不需要过滤
        } else if (mode === 'force') {
          // force 模式：强制处理所有内容
          // 不需要过滤
        }

        sendSSE(controller, 'filtered', {
          total: targetContents.length,
          skipped: contentIds.length - targetContents.length,
        })

        if (targetContents.length === 0) {
          sendSSE(controller, 'done', {
            summary: {
              total: contentIds.length,
              processed: 0,
              skipped: contentIds.length,
              failed: 0,
            },
          })
          controller.close()
          return
        }

        // 7. 批量处理（并发控制）
        let processed = 0
        let succeeded = 0
        let failed = 0

        // 分批处理
        for (let i = 0; i < targetContents.length; i += concurrent) {
          const batch = targetContents.slice(i, i + concurrent)

          const promises = batch.map(async (content) => {
            // 根据不同mode处理已有转录的内容
            if (content.transcript && content.hasTranscript) {
              if (mode === 'all') {
                // all 模式：跳过已有转录的内容
                return {
                  contentId: content.id,
                  status: 'skipped' as const,
                  reason: 'already_has_transcript',
                  title: content.title,
                }
              } else if (mode === 'force') {
                // force 模式：强制转录，即使已有转录也重新处理
                // 继续执行下面的转录逻辑
              }
            }

            // 发送处理中事件
            sendSSE(controller, 'processing', {
              contentId: content.id,
              title: content.title,
            })

            const result = await transcribeContent(content.id, merchantId, apiKey)
            return { ...result, title: content.title }
          })

          const batchResults = await Promise.allSettled(promises)

          batchResults.forEach((result, index) => {
            processed++

            let itemResult
            if (result.status === 'fulfilled') {
              itemResult = result.value
            } else {
              itemResult = {
                contentId: batch[index].id,
                status: 'failed' as const,
                error: result.reason?.message || '未知错误',
                title: batch[index].title,
              }
            }

            // 统计
            if (itemResult.status === 'success') {
              succeeded++
            } else if (itemResult.status === 'failed') {
              failed++
            }

            // 发送单项完成事件
            sendSSE(controller, 'item', {
              ...itemResult,
              progress: {
                processed,
                total: targetContents.length,
                succeeded,
                failed,
              },
            })
          })

          // 批次间延迟
          if (i + concurrent < targetContents.length) {
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
        }

        // 8. 发送完成事件
        sendSSE(controller, 'done', {
          summary: {
            total: contentIds.length,
            processed: succeeded,
            skipped: contentIds.length - targetContents.length,
            failed,
          },
        })

        controller.close()
      } catch (error: any) {
        console.error('批量转录失败:', error)
        sendSSE(controller, 'error', { message: error.message })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

export const dynamic = 'force-dynamic'
