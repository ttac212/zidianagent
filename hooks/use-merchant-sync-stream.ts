/**
 * 商家数据流式同步 Hook
 * 使用 SSE 实时接收同步进度
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from '@/lib/toast/toast'
import type { MerchantFilters } from '@/types/merchant'
import { processSSEStream } from '@/lib/utils/sse-parser'

/**
 * 同步进度状态
 */
export interface SyncProgress {
  current: number
  total: number
  merchantId: string
  merchantName: string
  success: boolean
  newVideos?: number
  updatedVideos?: number
  errors?: string[]
}

/**
 * 同步状态
 */
export type SyncStatus = 'idle' | 'syncing' | 'done' | 'error'

/**
 * 同步结果
 */
export interface SyncResult {
  total: number
  success: number
  failed: number
  totalNewVideos: number
  totalUpdatedVideos: number
}

/**
 * Hook 返回值
 */
export interface UseMerchantSyncStreamReturn {
  status: SyncStatus
  progress: SyncProgress | null
  result: SyncResult | null
  error: string | null
  startSync: (filters?: MerchantFilters, limit?: number) => Promise<void>
  cancelSync: () => void
}

/**
 * 使用商家流式同步
 */
export function useMerchantSyncStream(): UseMerchantSyncStreamReturn {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * 开始同步
   */
  const startSync = useCallback(
    async (filters?: MerchantFilters, limit: number = 20) => {
      // 如果正在同步，先取消
      if (status === 'syncing') {
        abortControllerRef.current?.abort()
      }

      // 重置状态
      setStatus('syncing')
      setProgress(null)
      setResult(null)
      setError(null)

      // 创建中断控制器
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        // 发起 SSE 请求
        const response = await fetch('/api/merchants/sync-stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filters, limit }),
          signal: abortController.signal,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || `HTTP ${response.status}`)
        }

        // 检查是否是 SSE 流
        const contentType = response.headers.get('content-type')
        if (!contentType?.includes('text/event-stream')) {
          throw new Error('响应不是 SSE 流')
        }

        // 修复：使用统一的 processSSEStream 替代手写解析
        // 优势：支持多行数据、正确处理分块、统一错误处理、支持 event: 类型
        const reader = response.body!.getReader()
        await processSSEStream(reader, {
          onMessage: (message) => {
            // 解析 payload 中的事件
            if (message.payload && typeof message.payload === 'object') {
              const event = message.payload as Record<string, any>

              switch (event.type) {
                case 'started':
                  console.log('[MerchantSync] 同步开始:', event.data)
                  break

                case 'progress':
                  setProgress(event.data)
                  console.log(
                    `[MerchantSync] 进度 ${event.data.current}/${event.data.total}: ${event.data.merchantName}`
                  )
                  break

                case 'done':
                  setStatus('done')
                  setResult(event.data)
                  toast.success(
                    `同步完成！成功 ${event.data.success} 个，失败 ${event.data.failed} 个`
                  )
                  console.log('[MerchantSync] 同步完成:', event.data)
                  break

                case 'error':
                  setStatus('error')
                  setError(event.data.message)
                  toast.error(`同步失败: ${event.data.message}`)
                  console.error('[MerchantSync] 同步错误:', event.data.message)
                  break

                default:
                  // 兜底：记录未知事件类型，方便后续排查新增的 warning/heartbeat 等事件
                  console.warn('[MerchantSync] 未知事件类型:', event.type, event)
                  break
              }
            }
          },
          onError: (errorMsg) => {
            console.error('[MerchantSync] SSE解析错误:', errorMsg)
          }
        })
      } catch (err: any) {
        // 用户主动取消不算错误
        if (err.name === 'AbortError') {
          setStatus('idle')
          toast.info('同步已取消')
          console.log('[MerchantSync] 同步被用户取消')
          return
        }

        // 其他错误
        setStatus('error')
        const errorMessage = err.message || '同步失败'
        setError(errorMessage)
        toast.error(errorMessage)
        console.error('[MerchantSync] 同步失败:', err)
      } finally {
        abortControllerRef.current = null
      }
    },
    [status]
  )

  /**
   * 取消同步
   */
  const cancelSync = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  /**
   * 修复：组件卸载时清理 AbortController
   * 防止内存泄漏和 "Can't perform a React state update on an unmounted component" 警告
   */
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [])

  return {
    status,
    progress,
    result,
    error,
    startSync,
    cancelSync,
  }
}
