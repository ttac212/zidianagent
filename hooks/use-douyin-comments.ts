/**
 * 抖音评论分析 Hook
 * 支持实时进度跟踪和SSE流式响应
 */

import { useState, useCallback, useRef } from 'react'
import type {
  DouyinCommentsProgress,
  DouyinCommentsVideoInfo,
  DouyinCommentsStatistics
} from '@/lib/douyin/comments-pipeline-steps'

export interface CommentsAnalysisProgress {
  percentage: number
  currentStep: string
  stepLabel: string
  stepDescription: string
  detail?: string
  videoInfo?: DouyinCommentsVideoInfo
  statistics?: DouyinCommentsStatistics
}

export interface CommentsAnalysisResult {
  markdown: string
  videoInfo: DouyinCommentsVideoInfo
  statistics: DouyinCommentsStatistics
  analysis: {
    sentiment: any
    coreTopics: any
    userProfile: any
    suggestions: any
  }
}

export interface UseDouyinCommentsReturn {
  // 状态
  isAnalyzing: boolean
  progress: CommentsAnalysisProgress | null
  analysisPreview: string
  result: CommentsAnalysisResult | null
  error: string | null

  // 操作
  analyzeComments: (shareLink: string) => Promise<void>
  cancel: () => void
  reset: () => void
}

export function useDouyinComments(): UseDouyinCommentsReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState<CommentsAnalysisProgress | null>(null)
  const [analysisPreview, setAnalysisPreview] = useState('')
  const [result, setResult] = useState<CommentsAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  const analyzeComments = useCallback(async (shareLink: string) => {
    // 重置状态
    setIsAnalyzing(true)
    setProgress({
      percentage: 0,
      currentStep: 'parse-link',
      stepLabel: '解析链接',
      stepDescription: '正在解析抖音分享链接',
    })
    setAnalysisPreview('')
    setResult(null)
    setError(null)

    // 创建AbortController用于取消
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/douyin/analyze-comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shareLink }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP错误: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('响应体为空')
      }

      // 处理SSE流
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        // 解码数据
        buffer += decoder.decode(value, { stream: true })

        // 处理多个SSE消息
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留不完整的行

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim()
            continue
          }

          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim()

            if (dataStr === '[DONE]') {
              continue
            }

            try {
              const data = JSON.parse(dataStr)
              handleSSEEvent(data)
            } catch (e) {
              console.error('解析SSE数据失败:', e, 'Data:', dataStr)
            }
          }
        }
      }

      setIsAnalyzing(false)
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setError('分析已取消')
        setProgress((prev) => prev ? { ...prev, detail: '操作已取消' } : null)
      } else {
        const errorMessage = error instanceof Error ? error.message : '未知错误'
        setError(errorMessage)
        setProgress((prev) => prev ? { ...prev, detail: errorMessage } : null)
      }
      setIsAnalyzing(false)
    }
  }, [])

  const handleSSEEvent = useCallback((data: any) => {
    const eventType = data.type

    switch (eventType) {
      case 'progress':
        setProgress({
          percentage: data.percentage || 0,
          currentStep: data.step,
          stepLabel: data.label || '',
          stepDescription: data.description || '',
          detail: data.detail,
        })
        break

      case 'info':
        setProgress((prev) => ({
          ...prev!,
          videoInfo: data.videoInfo,
          statistics: data.statistics,
        }))
        break

      case 'partial':
        if (data.key === 'analysis' && data.data) {
          if (data.append) {
            setAnalysisPreview((prev) => prev + data.data)
          } else {
            setAnalysisPreview(data.data)
          }
        }
        break

      case 'done':
        setResult({
          markdown: data.markdown,
          videoInfo: data.videoInfo,
          statistics: data.statistics,
          analysis: data.analysis,
        })
        setProgress({
          percentage: 100,
          currentStep: 'analyze-comments',
          stepLabel: '分析完成',
          stepDescription: '评论分析已完成',
          videoInfo: data.videoInfo,
          statistics: data.statistics,
        })
        break

      case 'error':
        const errorMessage = data.message || '评论分析失败'
        setError(errorMessage)
        setProgress((prev) => prev ? { ...prev, detail: errorMessage } : null)
        break

      default:
        console.log('未知事件类型:', eventType, data)
    }
  }, [])

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    setIsAnalyzing(false)
    setProgress(null)
    setAnalysisPreview('')
    setResult(null)
    setError(null)
  }, [])

  return {
    isAnalyzing,
    progress,
    analysisPreview,
    result,
    error,
    analyzeComments,
    cancel,
    reset,
  }
}
