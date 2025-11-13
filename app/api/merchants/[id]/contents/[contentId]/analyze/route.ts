/**
 * 单视频评论分析 API
 * POST /api/merchants/[id]/contents/[contentId]/analyze
 *
 * 功能：
 * - 分析单个视频的评论数据
 * - SSE 流式输出分析进度
 * - 结果保存到数据库
 */

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { runMerchantCommentAnalysis } from '@/lib/merchant/merchant-comments-analysis-pipeline'
import { unauthorized, validationError, notFound, success } from '@/lib/api/http-response'
import { prisma } from '@/lib/prisma'

/**
 * 查询分析结果
 * GET /api/merchants/[id]/contents/[contentId]/analyze
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contentId: string }> }
) {
  try {
    // 1. 认证检查
    const token = await getToken({ req: req as any })
    if (!token?.sub) {
      return unauthorized('未认证')
    }

    const { id: merchantId, contentId } = await params

    // 2. 验证内容存在且属于该商家
    const content = await prisma.merchantContent.findUnique({
      where: { id: contentId },
      select: { merchantId: true }
    })

    if (!content) {
      return notFound('Content not found')
    }

    if (content.merchantId !== merchantId) {
      return validationError('Content does not belong to this merchant')
    }

    // 3. 查询分析结果
    const analysis = await prisma.merchantContentAnalysis.findUnique({
      where: { contentId }
    })

    if (!analysis) {
      return notFound('Analysis not found')
    }

    return success({
      id: analysis.id,
      contentId: analysis.contentId,
      sentimentAnalysis: analysis.sentimentAnalysis ? JSON.parse(analysis.sentimentAnalysis) : null,
      coreTopics: analysis.coreTopics ? JSON.parse(analysis.coreTopics) : null,
      userProfile: analysis.userProfile ? JSON.parse(analysis.userProfile) : null,
      suggestions: analysis.suggestions ? JSON.parse(analysis.suggestions) : null,
      rawMarkdown: analysis.rawMarkdown,
      commentCount: analysis.commentCount,
      commentSource: analysis.commentSource,
      analyzedAt: analysis.analyzedAt.toISOString(),
      modelUsed: analysis.modelUsed,
      tokenUsed: analysis.tokenUsed
    })
  } catch (error) {
    console.error('[Merchant Analysis GET API] Error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : '未知错误'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contentId: string }> }
) {
  try {
    // 1. 认证检查
    const token = await getToken({ req: req as any })
    if (!token?.sub) {
      return unauthorized('未认证')
    }

    const { id: merchantId, contentId } = await params

    // 2. 验证内容存在且属于该商家
    const content = await prisma.merchantContent.findUnique({
      where: { id: contentId },
      select: { merchantId: true, title: true }
    })

    if (!content) {
      return notFound('Content not found')
    }

    if (content.merchantId !== merchantId) {
      return validationError('Content does not belong to this merchant')
    }

    // 3. 解析请求参数
    const body = await req.json().catch(() => ({}))
    const { maxComments = 100 } = body

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
            console.error('[Merchant Analysis] Failed to enqueue event:', error)
          }
        }

        const finishStream = () => {
          if (isClosed) return
          isClosed = true
          try {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          } catch (error) {
            console.error('[Merchant Analysis] Failed to enqueue DONE:', error)
          } finally {
            controller.close()
          }
        }

        const abortHandler = () => finishStream()
        req.signal.addEventListener('abort', abortHandler)

        try {
          await runMerchantCommentAnalysis(
            contentId,
            async (event) => {
              switch (event.type) {
                case 'progress':
                  sendEvent('analysis-progress', event)
                  break
                case 'info':
                  sendEvent('analysis-info', event)
                  break
                case 'partial':
                  sendEvent('analysis-partial', event)
                  break
                case 'done':
                  sendEvent('analysis-done', event)
                  break
                case 'error':
                  sendEvent('analysis-error', event)
                  break
              }
            },
            {
              signal: req.signal,
              maxComments
            }
          )
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            console.warn('[Merchant Analysis] Pipeline aborted by client')
          } else {
            console.error('[Merchant Analysis] Pipeline failed:', err)
            sendEvent('analysis-error', {
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
    console.error('[Merchant Analysis API] Error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : '未知错误'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
