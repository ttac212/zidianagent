/**
 * 抖音评论分析 API
 * 完整的评论数据采集和 LLM 智能分析
 */

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { runDouyinCommentsPipeline } from '@/lib/douyin/comments-pipeline'
import { unauthorized, validationError } from '@/lib/api/http-response'

export async function POST(req: NextRequest) {
  try {
    // 1. 认证检查
    const token = await getToken({ req: req as any })
    if (!token?.sub) {
      return unauthorized('未认证')
    }

    // 2. 解析请求参数
    const body = await req.json()
    const { shareLink } = body

    if (!shareLink) {
      return validationError('缺少分享链接参数')
    }

    // 3. 创建 SSE 流
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
        req.signal.addEventListener('abort', abortHandler)

        try {
          await runDouyinCommentsPipeline(
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
                  sendEvent('comments-done', event)
                  break
                case 'error':
                  sendEvent('comments-error', event)
                  break
              }
            },
            { signal: req.signal }
          )
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            console.warn('[Douyin Comments] Pipeline aborted by client')
          } else {
            console.error('[Douyin Comments] Pipeline failed:', err)
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
        Connection: 'keep-alive'
      }
    })
  } catch (error) {
    console.error('[Douyin Comments API] Error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : '未知错误'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
