/**
 * 商家评论分析 Hook
 *
 * 功能：
 * - 触发单视频评论分析
 * - SSE 流式接收分析进度和结果
 * - 管理分析状态（idle/analyzing/completed/error）
 */

import { useCallback, useRef, useState } from 'react'
import { toast } from '@/lib/toast/toast'

export interface AnalysisProgress {
  step: string
  status: string
  percentage: number
  label: string
  detail?: string
}

export interface AnalysisResult {
  analysisId: string
  markdown: string
  commentCount: number
  commentSource: 'db' | 'tikhub'
}

type AnalysisStatus = 'idle' | 'analyzing' | 'completed' | 'error'

export function useMerchantCommentAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [progress, setProgress] = useState<AnalysisProgress | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [partialMarkdown, setPartialMarkdown] = useState<string>('')

  const abortRef = useRef<AbortController | null>(null)

  /**
   * 开始分析
   */
  const analyze = useCallback(async (
    merchantId: string,
    contentId: string,
    maxComments: number = 100
  ) => {
    // 中止之前的请求
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // 重置状态
    setStatus('analyzing')
    setProgress(null)
    setResult(null)
    setError(null)
    setPartialMarkdown('')

    try {
      const response = await fetch(
        `/api/merchants/${merchantId}/contents/${contentId}/analyze`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ maxComments }),
          signal: controller.signal
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      // 处理 SSE 流
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应流')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          if (line === 'data: [DONE]') continue

          // 解析 SSE 事件
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim()
            continue // 事件类型行，跳过
          }

          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6))

              // 根据不同事件类型处理
              switch (eventData.type) {
                case 'progress':
                  setProgress({
                    step: eventData.step,
                    status: eventData.status,
                    percentage: eventData.percentage,
                    label: eventData.label,
                    detail: eventData.detail
                  })
                  break

                case 'partial':
                  if (eventData.key === 'analysis' && eventData.append) {
                    setPartialMarkdown(prev => prev + eventData.data)
                  }
                  break

                case 'done':
                  setResult({
                    analysisId: eventData.analysisId,
                    markdown: eventData.markdown,
                    commentCount: eventData.commentCount,
                    commentSource: eventData.commentSource
                  })
                  setStatus('completed')
                  toast.success('评论分析完成')
                  break

                case 'error':
                  throw new Error(eventData.message || '分析失败')
              }
            } catch (parseError) {
              console.warn('[SSE] Failed to parse event data:', parseError)
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setStatus('idle')
          toast.info('分析已取消')
        } else {
          setError(err.message)
          setStatus('error')
          toast.error(`分析失败: ${err.message}`)
        }
      } else {
        setError('未知错误')
        setStatus('error')
        toast.error('分析失败')
      }
    } finally {
      abortRef.current = null
    }
  }, [])

  /**
   * 取消分析
   */
  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('idle')
  }, [])

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('idle')
    setProgress(null)
    setResult(null)
    setError(null)
    setPartialMarkdown('')
  }, [])

  return {
    status,
    progress,
    result,
    error,
    partialMarkdown,
    analyze,
    cancel,
    reset,
    isAnalyzing: status === 'analyzing',
    isCompleted: status === 'completed',
    hasError: status === 'error'
  }
}
