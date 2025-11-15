/**
 * 商家客群分析 API
 * POST /api/merchants/[id]/analyze-audience
 *
 * 功能：
 * - 分析商家的客群画像（基于TOP N视频的评论数据）
 * - SSE 流式输出分析进度
 * - 结果保存到数据库
 *
 * GET /api/merchants/[id]/analyze-audience
 * - 查询已有的客群分析结果
 */

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { runAudienceAnalysisPipeline } from '@/lib/merchant/audience-analysis-pipeline'
import { unauthorized, validationError, notFound, success } from '@/lib/api/http-response'
import { prisma } from '@/lib/prisma'

// 客群分析可能耗时较长（LLM分析大量评论数据），设置5分钟超时
export const maxDuration = 300

/**
 * 查询客群分析结果
 * GET /api/merchants/[id]/analyze-audience
 */
export async function GET(
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
      select: { id: true }
    })

    if (!merchant) {
      return notFound('Merchant not found')
    }

    // 3. 查询分析结果
    const analysis = await prisma.merchantAudienceAnalysis.findUnique({
      where: { merchantId }
    })

    if (!analysis) {
      return notFound('Audience analysis not found')
    }

    // 4. 解析JSON字段并返回
    return success({
      id: analysis.id,
      merchantId: analysis.merchantId,
      videosAnalyzed: analysis.videosAnalyzed,
      commentsAnalyzed: analysis.commentsAnalyzed,
      videoIds: JSON.parse(analysis.videoIds),
      locationStats: analysis.locationStats ? JSON.parse(analysis.locationStats) : null,
      audienceProfile: analysis.audienceProfile ? JSON.parse(analysis.audienceProfile) : null,
      demographics: analysis.demographics ? JSON.parse(analysis.demographics) : null,
      behaviors: analysis.behaviors ? JSON.parse(analysis.behaviors) : null,
      interests: analysis.interests ? JSON.parse(analysis.interests) : null,
      painPoints: analysis.painPoints ? JSON.parse(analysis.painPoints) : null,
      suggestions: analysis.suggestions ? JSON.parse(analysis.suggestions) : null,
      rawMarkdown: analysis.rawMarkdown,
      analyzedAt: analysis.analyzedAt.toISOString(),
      modelUsed: analysis.modelUsed,
      tokenUsed: analysis.tokenUsed
    })
  } catch (error) {
    console.error('[Audience Analysis GET API] Error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : '未知错误'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * 执行客群分析
 * POST /api/merchants/[id]/analyze-audience
 */
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
    const { topN = 5, maxCommentsPerVideo = 100 } = body

    // 参数校验
    if (topN < 1 || topN > 20) {
      return validationError('topN must be between 1 and 20')
    }

    if (maxCommentsPerVideo < 10 || maxCommentsPerVideo > 500) {
      return validationError('maxCommentsPerVideo must be between 10 and 500')
    }

    // 4. 创建 SSE 流
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
            console.error('[Audience Analysis] Failed to enqueue event:', error)
          }
        }

        const finishStream = () => {
          if (isClosed) return
          isClosed = true
          try {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          } catch (error) {
            console.error('[Audience Analysis] Failed to enqueue DONE:', error)
          } finally {
            controller.close()
          }
        }

        const abortHandler = () => finishStream()
        req.signal.addEventListener('abort', abortHandler)

        try {
          await runAudienceAnalysisPipeline(
            merchantId,
            async (event) => {
              switch (event.type) {
                case 'progress':
                  sendEvent('audience-progress', event)
                  break
                case 'info':
                  sendEvent('audience-info', event)
                  break
                case 'partial':
                  sendEvent('audience-partial', event)
                  break
                case 'done':
                  sendEvent('audience-done', event)
                  break
                case 'error':
                  sendEvent('audience-error', event)
                  break
              }
            },
            {
              signal: req.signal,
              topN,
              maxCommentsPerVideo
            }
          )
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            console.warn('[Audience Analysis] Pipeline aborted by client')
          } else {
            console.error('[Audience Analysis] Pipeline failed:', err)
            sendEvent('audience-error', {
              message: err instanceof Error ? err.message : '分析失败'
            })
          }
        } finally {
          finishStream()
          req.signal.removeEventListener('abort', abortHandler)
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
  } catch (error) {
    console.error('[Audience Analysis API] Error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : '未知错误'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
