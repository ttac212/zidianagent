/**
 * 商家客群分析 Hook
 *
 * 功能：
 * - 触发商家客群分析（基于TOP N视频的评论数据）
 * - SSE 流式接收分析进度和结果
 * - 管理分析状态（idle/analyzing/completed/error）
 */

import { useCallback, useRef, useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from '@/lib/toast/toast'
import { unwrapApiResponse } from '@/lib/api/http-response'
import type { MerchantAudienceAnalysisVersion } from '@/types/merchant'

export interface AudienceAnalysisProgress {
  step: string
  status: string
  percentage: number
  label: string
  detail?: string
}

export interface LocationStat {
  location: string
  count: number
  percentage: number
}

type AudienceAnalysisStructuredFields = {
  audienceProfile: Record<string, any> | null
  demographics: Record<string, any> | null
  behaviors: Record<string, any> | null
  interests: Record<string, any> | null
  painPoints: Record<string, any> | null
  suggestions: Record<string, any> | null
}

export interface AudienceAnalysisResult extends AudienceAnalysisStructuredFields {
  analysisId: string
  markdown: string
  rawMarkdown: string  // ✅ 添加：与 markdown 相同，保持字段一致性
  videosAnalyzed: number
  commentsAnalyzed: number
  locationStats: LocationStat[]
  modelUsed: string  // ✅ 添加：使用的模型
  tokenUsed: number  // ✅ 添加：Token 消耗
  analyzedAt: string  // ✅ 添加：分析时间
}

export interface AudienceAnalysisData extends AudienceAnalysisStructuredFields {
  id: string
  merchantId: string
  videosAnalyzed: number
  commentsAnalyzed: number
  videoIds: string[]
  locationStats: LocationStat[] | null
  rawMarkdown: string | null
  analyzedAt: string
  modelUsed: string
  tokenUsed: number
}

type AnalysisStatus = 'idle' | 'analyzing' | 'completed' | 'error'

// Query keys
export const audienceAnalysisKeys = {
  all: ['merchant-audience-analysis'] as const,
  detail: (merchantId: string) => [...audienceAnalysisKeys.all, merchantId] as const
}

/**
 * 查询客群分析结果
 */
export function useMerchantAudienceData(merchantId: string) {
  return useQuery({
    queryKey: audienceAnalysisKeys.detail(merchantId),
    queryFn: async () => {
      const response = await fetch(`/api/merchants/${merchantId}/analyze-audience`)

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()

      // 解包 API 响应（处理 { success: true, data: {...} } 格式）
      const unwrapped = unwrapApiResponse<AudienceAnalysisData>(result)

      return unwrapped
    },
    staleTime: 5 * 60 * 1000,    // 5分钟内数据新鲜
    gcTime: 10 * 60 * 1000,       // 10分钟后清除缓存
    retry: 1,
    enabled: Boolean(merchantId)
  })
}

/**
 * 执行客群分析
 */
export function useMerchantAudienceAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [progress, setProgress] = useState<AudienceAnalysisProgress | null>(null)
  const [result, setResult] = useState<AudienceAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [partialMarkdown, setPartialMarkdown] = useState<string>('')

  const abortRef = useRef<AbortController | null>(null)
  const queryClient = useQueryClient()

  /**
   * 开始分析
   */
  const analyze = useCallback(async (
    merchantId: string,
    options?: {
      topN?: number                 // 分析TOP N个视频，默认5
      maxCommentsPerVideo?: number  // 每个视频最多采集评论数，默认100
    }
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
        `/api/merchants/${merchantId}/analyze-audience`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            topN: options?.topN || 5,
            maxCommentsPerVideo: options?.maxCommentsPerVideo || 100
          }),
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

                case 'info':
                  // 可选：显示分析信息
                  console.log('[客群分析] 信息:', eventData)
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
                    rawMarkdown: eventData.markdown,  // ✅ 保持字段一致
                    videosAnalyzed: eventData.videosAnalyzed,
                    commentsAnalyzed: eventData.commentsAnalyzed,
                    locationStats: eventData.locationStats,
                    modelUsed: eventData.modelUsed,  // ✅ 从 SSE 事件获取
                    tokenUsed: eventData.tokenUsed,  // ✅ 从 SSE 事件获取
                    analyzedAt: eventData.analyzedAt,  // ✅ 从 SSE 事件获取
                    audienceProfile: eventData.audienceProfile ?? null,
                    demographics: eventData.demographics ?? null,
                    behaviors: eventData.behaviors ?? null,
                    interests: eventData.interests ?? null,
                    painPoints: eventData.painPoints ?? null,
                    suggestions: eventData.suggestions ?? null
                  })
                  setStatus('completed')
                  toast.success('客群分析完成')

                  // 刷新查询缓存
                  queryClient.invalidateQueries({
                    queryKey: audienceAnalysisKeys.detail(merchantId)
                  })
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
          toast.error(`客群分析失败: ${err.message}`)
        }
      } else {
        setError('未知错误')
        setStatus('error')
        toast.error('客群分析失败')
      }
    } finally {
      abortRef.current = null
    }
  }, [queryClient])

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

/**
 * 人工修订客群分析
 */
export function useUpdateAudienceManual(merchantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { manualMarkdown?: string; manualInsights?: Record<string, any> | null }) => {
      const res = await fetch(`/api/merchants/${merchantId}/audience/manual`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || '更新失败')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: audienceAnalysisKeys.detail(merchantId) })
      toast.success('客群分析已保存')
    },
    onError: (err) => {
      toast.error('保存失败', { description: err instanceof Error ? err.message : '未知错误' })
    }
  })
}

/**
 * 客群分析版本历史
 */
export function useAudienceVersions(merchantId?: string) {
  return useQuery({
    queryKey: ['merchant-audience-versions', merchantId],
    queryFn: async () => {
      if (!merchantId) throw new Error('merchantId is required')
      const res = await fetch(`/api/merchants/${merchantId}/audience/versions`)
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || '获取版本历史失败')
      }
      const data = await res.json()
      return data.data.versions as MerchantAudienceAnalysisVersion[]
    },
    enabled: Boolean(merchantId),
    staleTime: 60 * 1000
  })
}
