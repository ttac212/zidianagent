/**
 * 商家创作档案流式生成 Hook
 * 使用SSE实时接收生成进度
 */

import { useState, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { profileKeys } from './use-merchant-profile'
import type { ProfileGenerateProgress } from '@/components/merchants/profile-generate-progress'
import { initialProgress } from '@/components/merchants/profile-generate-progress'
import type { ProfileGenerateEvent } from '@/lib/ai/profile-generator'

/**
 * 转录需求数据
 */
export interface TranscriptionRequiredData {
  total: number
  missingCount: number
  missingPercentage: number
  contentsToTranscribe: Array<{ id: string; title: string }>
}

/**
 * Hook返回类型
 */
interface UseGenerateProfileStreamResult {
  generate: () => Promise<void>
  cancel: () => void
  progress: ProfileGenerateProgress
  isGenerating: boolean
  transcriptionRequired: TranscriptionRequiredData | null
  resetProgress: () => void
}

/**
 * 流式生成商家档案Hook
 */
export function useGenerateProfileStream(merchantId: string): UseGenerateProfileStreamResult {
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<ProfileGenerateProgress>(initialProgress)
  const [transcriptionRequired, setTranscriptionRequired] = useState<TranscriptionRequiredData | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * 更新步骤状态
   */
  const updateStepStatus = useCallback((stepId: string, status: 'started' | 'completed' | 'failed', message?: string) => {
    setProgress(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === stepId ? { ...step, status, message } : step
      )
    }))
  }, [])

  /**
   * 更新内容分析进度
   */
  const updateContentAnalysis = useCallback((data: {
    current: number
    total: number
    contentId: string
    contentTitle: string
    status: 'started' | 'completed' | 'failed'
  }) => {
    setProgress(prev => {
      const existingItems = prev.contentAnalysis?.items || []
      const itemIndex = existingItems.findIndex(item => item.id === data.contentId)

      let newItems: typeof existingItems
      if (itemIndex >= 0) {
        newItems = existingItems.map((item, idx) =>
          idx === itemIndex ? { id: data.contentId, title: data.contentTitle, status: data.status } : item
        )
      } else {
        newItems = [...existingItems, { id: data.contentId, title: data.contentTitle, status: data.status }]
      }

      return {
        ...prev,
        contentAnalysis: {
          current: data.current,
          total: data.total,
          items: newItems
        }
      }
    })
  }, [])

  /**
   * 处理SSE事件
   */
  const handleEvent = useCallback((event: ProfileGenerateEvent) => {
    switch (event.type) {
      case 'started':
        setProgress(prev => ({
          ...prev,
          isGenerating: true,
          merchantName: event.data.merchantName
        }))
        break

      case 'step':
        updateStepStatus(event.data.step, event.data.status, event.data.message)
        break

      case 'content_analysis':
        updateContentAnalysis(event.data)
        break

      case 'profile_generating':
        updateStepStatus('profile_generating', 'started', event.data.message)
        break

      case 'transcription_required':
        setTranscriptionRequired(event.data)
        setProgress(prev => ({
          ...prev,
          isGenerating: false
        }))
        break

      case 'done':
        // 更新所有步骤为完成
        setProgress(prev => ({
          ...prev,
          isGenerating: false,
          steps: prev.steps.map(step => ({ ...step, status: 'completed' as const }))
        }))
        // 直接更新 React Query 缓存，使用 setQueryData 立即显示结果
        // 注意：不再调用 invalidateQueries，避免竞态条件
        if (event.data?.profile) {
          queryClient.setQueryData(
            profileKeys.detail(merchantId),
            (old: any) => {
              if (!old) {
                return {
                  profile: event.data.profile,
                  merchant: null
                }
              }
              return {
                ...old,
                profile: event.data.profile
              }
            }
          )
        }
        break

      case 'error':
        setProgress(prev => ({
          ...prev,
          isGenerating: false,
          error: event.data.message
        }))
        break
    }
  }, [merchantId, queryClient, updateStepStatus, updateContentAnalysis])

  /**
   * 开始生成
   */
  const generate = useCallback(async () => {
    // 重置状态
    setProgress({
      ...initialProgress,
      isGenerating: true
    })
    setTranscriptionRequired(null)

    // 创建AbortController
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch(`/api/merchants/${merchantId}/profile/generate/stream`, {
        method: 'POST',
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '请求失败' }))
        throw new Error(errorData.message || `请求失败: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('响应体为空')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // 解析SSE事件
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留不完整的行

        let currentEvent: string | null = null
        let currentData: string | null = null

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7)
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6)
          } else if (line === '' && currentEvent && currentData) {
            // 事件完成
            try {
              const eventData = JSON.parse(currentData)
              handleEvent({ type: currentEvent, data: eventData } as ProfileGenerateEvent)
            } catch (e) {
              console.error('[useGenerateProfileStream] 解析事件失败:', e)
            }
            currentEvent = null
            currentData = null
          }
        }
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        setProgress(prev => ({
          ...prev,
          isGenerating: false,
          error: '已取消生成'
        }))
      } else {
        setProgress(prev => ({
          ...prev,
          isGenerating: false,
          error: error.message || '生成失败'
        }))
      }
    } finally {
      abortControllerRef.current = null
    }
  }, [merchantId, handleEvent])

  /**
   * 取消生成
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  /**
   * 重置进度
   */
  const resetProgress = useCallback(() => {
    setProgress(initialProgress)
    setTranscriptionRequired(null)
  }, [])

  return {
    generate,
    cancel,
    progress,
    isGenerating: progress.isGenerating,
    transcriptionRequired,
    resetProgress
  }
}
