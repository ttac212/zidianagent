/**
 * 批量分析商家TOP5视频评论 API
 * POST /api/merchants/[id]/analyze-top-videos
 *
 * 功能：
 * - 自动选择商家的TOP5视频（按总互动量排序）
 * - 串行分析每个视频的评论
 * - SSE 流式输出批量进度
 */

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { runMerchantCommentAnalysis } from '@/lib/merchant/merchant-comments-analysis-pipeline'
import { unauthorized, notFound } from '@/lib/api/http-response'
import { prisma } from '@/lib/prisma'

interface VideoToAnalyze {
  id: string
  title: string
  totalEngagement: number
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 认证检查
    const token = await getToken({ req: req as any })
    if (!token?.sub) {
      return unauthorized('未认证')
    }

    const { id: merchantId } = await params

    // 2. 验证商家存在
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, name: true }
    })

    if (!merchant) {
      return notFound('Merchant not found')
    }

    // 3. 解析请求参数
    const body = await req.json().catch(() => ({}))
    const {
      maxComments = 100,
      metric = 'totalEngagement', // 'totalEngagement' | 'diggCount' | 'commentCount'
      limit = 5
    } = body

    // 4. 获取TOP视频列表
    const orderByMap: Record<string, any> = {
      totalEngagement: { totalEngagement: 'desc' },
      diggCount: { diggCount: 'desc' },
      commentCount: { commentCount: 'desc' }
    }

    const topVideos = await prisma.merchantContent.findMany({
      where: {
        merchantId,
        commentCount: { gt: 0 } // 只分析有评论的视频
      },
      orderBy: orderByMap[metric] || orderByMap.totalEngagement,
      take: limit,
      select: {
        id: true,
        title: true,
        totalEngagement: true,
        commentCount: true
      }
    })

    if (topVideos.length === 0) {
      return new Response(
        JSON.stringify({
          error: '该商家没有可分析的视频（需要有评论数据）'
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 5. 创建 SSE 流
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false

        const sendEvent = (type: string, payload: unknown) => {
          if (isClosed) return

          try {
            const chunk = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`
            controller.enqueue(encoder.encode(chunk))
          } catch (error) {
            console.error('[Batch Analysis] Failed to enqueue event:', error)
          }
        }

        const finishStream = () => {
          if (isClosed) return
          isClosed = true
          try {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          } catch (error) {
            console.error('[Batch Analysis] Failed to enqueue DONE:', error)
          } finally {
            controller.close()
          }
        }

        const abortHandler = () => finishStream()
        req.signal.addEventListener('abort', abortHandler)

        // 发送批量开始事件
        sendEvent('batch-start', {
          total: topVideos.length,
          videos: topVideos.map(v => ({
            id: v.id,
            title: v.title,
            commentCount: v.commentCount
          }))
        })

        // 串行分析每个视频
        const results: any[] = []
        let completed = 0
        let failed = 0

        for (let i = 0; i < topVideos.length; i++) {
          if (req.signal.aborted) {
            console.warn('[Batch Analysis] Aborted by client')
            break
          }

          const video = topVideos[i]

          // 发送当前视频分析开始事件
          sendEvent('batch-progress', {
            current: i + 1,
            total: topVideos.length,
            contentId: video.id,
            contentTitle: video.title
          })

          try {
            // 分析单个视频
            const result = await runMerchantCommentAnalysis(
              video.id,
              async (event) => {
                // 转发每个视频的分析进度
                switch (event.type) {
                  case 'progress':
                    sendEvent('analysis-progress', {
                      contentId: video.id,
                      ...event
                    })
                    break
                  case 'partial':
                    sendEvent('analysis-partial', {
                      contentId: video.id,
                      ...event
                    })
                    break
                  case 'done':
                    sendEvent('analysis-done', {
                      contentId: video.id,
                      ...event
                    })
                    break
                  case 'error':
                    sendEvent('analysis-error', {
                      contentId: video.id,
                      ...event
                    })
                    break
                }
              },
              {
                signal: req.signal,
                maxComments
              }
            )

            results.push({
              contentId: video.id,
              contentTitle: video.title,
              status: 'success',
              analysisId: result.analysisId
            })
            completed++
          } catch (error) {
            console.error(`[Batch Analysis] Failed to analyze video ${video.id}:`, error)
            results.push({
              contentId: video.id,
              contentTitle: video.title,
              status: 'failed',
              error: error instanceof Error ? error.message : '未知错误'
            })
            failed++
          }

          // 视频之间间隔1秒（避免API限流）
          if (i < topVideos.length - 1 && !req.signal.aborted) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }

        // 发送批量完成事件
        sendEvent('batch-complete', {
          total: topVideos.length,
          completed,
          failed,
          results
        })

        finishStream()
        req.signal.removeEventListener('abort', abortHandler)
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch (error) {
    console.error('[Batch Analysis API] Error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : '未知错误'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
