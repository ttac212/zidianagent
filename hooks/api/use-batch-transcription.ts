/**
 * 批量转录 Hook
 * 使用 SSE 流式处理批量视频转录，实时展示进度
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'

/**
 * 转录进度信息
 */
export interface TranscriptionProgress {
  current: number    // 当前处理数量
  total: number      // 总数量
  message?: string   // 进度消息
}

/**
 * 转录失败项
 */
export interface FailedTranscriptionItem {
  id: string
  title?: string
  error?: string
}

/**
 * 转录完成摘要
 */
export interface TranscriptionSummary {
  total: number
  processed: number
  failed: number
  skipped: number
  failedItems: FailedTranscriptionItem[]
}

/**
 * Hook 返回值
 */
export interface UseBatchTranscriptionReturn {
  /** 开始批量转录 */
  startTranscription: (contentIds: string[]) => Promise<TranscriptionSummary>
  /** 取消转录 */
  cancelTranscription: () => void
  /** 是否正在转录 */
  isTranscribing: boolean
  /** 转录进度 */
  progress: TranscriptionProgress
  /** 错误信息 */
  error: string | null
}

/**
 * 批量转录 Hook
 *
 * @param merchantId - 商家ID
 * @param options - 配置选项
 * @returns Hook 返回值
 *
 * @example
 * ```tsx
 * const { startTranscription, cancelTranscription, isTranscribing, progress } =
 *   useBatchTranscription(merchantId)
 *
 * const handleTranscribe = async () => {
 *   try {
 *     const summary = await startTranscription(contentIds)
 *     console.log('转录完成:', summary)
 *   } catch (err) {
 *     console.error('转录失败:', err)
 *   }
 * }
 * ```
 */
export function useBatchTranscription(
  merchantId: string,
  options?: {
    /** 转录模式：force=强制重新转录，skip=跳过已转录 */
    mode?: 'force' | 'skip'
    /** 并发数 */
    concurrent?: number
    /** 显示toast提示 */
    showToast?: boolean
  }
): UseBatchTranscriptionReturn {
  const { mode = 'force', concurrent = 100, showToast = true } = options || {}

  const [isTranscribing, setIsTranscribing] = useState(false)
  const [progress, setProgress] = useState<TranscriptionProgress>({
    current: 0,
    total: 0
  })
  const [error, setError] = useState<string | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const resolveRef = useRef<((summary: TranscriptionSummary) => void) | null>(null)
  const rejectRef = useRef<((error: Error) => void) | null>(null)
  const failedItemsRef = useRef<FailedTranscriptionItem[]>([])

  /**
   * 清理资源
   */
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsTranscribing(false)
  }, [])

  /**
   * 组件卸载时清理
   */
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  /**
   * 取消转录
   */
  const cancelTranscription = useCallback(() => {
    cleanup()
    if (rejectRef.current) {
      rejectRef.current(new Error('用户取消转录'))
      rejectRef.current = null
      resolveRef.current = null
    }
    failedItemsRef.current = []
    setError(null)
    setProgress({ current: 0, total: 0 })
    if (showToast) {
      toast.info('已取消转录')
    }
  }, [cleanup, showToast])

  /**
   * 开始批量转录
   */
  const startTranscription = useCallback(
    (contentIds: string[]): Promise<TranscriptionSummary> => {
      // 验证参数
      if (!merchantId) {
        return Promise.reject(new Error('merchantId 不能为空'))
      }
      if (!contentIds || contentIds.length === 0) {
        return Promise.reject(new Error('contentIds 不能为空'))
      }

      // 如果正在转录，先取消
      if (isTranscribing) {
        cleanup()
      }

      return new Promise((resolve, reject) => {
        setIsTranscribing(true)
        setError(null)
        setProgress({ current: 0, total: 0 })
        failedItemsRef.current = []

        resolveRef.current = resolve
        rejectRef.current = reject

        // 构建 SSE URL
        const params = new URLSearchParams({
          contentIds: contentIds.join(','),
          mode,
          concurrent: concurrent.toString()
        })
        const url = `/api/merchants/${merchantId}/contents/batch-transcribe/stream?${params}`

        // 创建 EventSource
        const es = new EventSource(url)
        eventSourceRef.current = es

        let closed = false
        const safeCleanup = () => {
          if (closed) return
          closed = true
          cleanup()
        }

        // 监听 start 事件
        es.addEventListener('start', (e) => {
          try {
            const data = JSON.parse(e.data)
            setProgress({ current: 0, total: data.total })
            if (showToast) {
              toast.info(`检测到 ${data.total} 条内容需要转录`)
            }
          } catch (err) {
            console.error('[BatchTranscription] 解析start事件失败:', err)
          }
        })

        // 监听 item 事件（每个内容转录完成）
        es.addEventListener('item', (e) => {
          try {
            const data = JSON.parse(e.data)
            setProgress({
              current: data.progress.processed,
              total: data.progress.total,
              message: `正在转录: ${data.title || data.contentId}`
            })

            // 记录失败项
            if (data.status === 'failed') {
              failedItemsRef.current.push({
                id: data.contentId,
                title: data.title,
                error: data.error
              })
            }
          } catch (err) {
            console.error('[BatchTranscription] 解析item事件失败:', err)
          }
        })

        // 监听 done 事件（全部完成）
        es.addEventListener('done', (e) => {
          try {
            const data = JSON.parse(e.data)
            const summary: TranscriptionSummary = {
              total: data.summary.total,
              processed: data.summary.processed,
              failed: data.summary.failed,
              skipped: data.summary.skipped,
              failedItems: failedItemsRef.current
            }

            safeCleanup()

            if (showToast) {
              if (summary.failed > 0) {
                const preview = summary.failedItems
                  .slice(0, 3)
                  .map((item) => item.title || item.id)
                  .join('、')
                toast.info(
                  `转录完成，成功: ${summary.processed}, 失败: ${summary.failed}, 跳过: ${summary.skipped}${preview ? `。失败示例：${preview}` : ''}`
                )
              } else {
                toast.success(`转录完成，成功: ${summary.processed}, 跳过: ${summary.skipped}`)
              }
            }

            if (resolveRef.current) {
              resolveRef.current(summary)
              resolveRef.current = null
              rejectRef.current = null
            }
          } catch (err) {
            console.error('[BatchTranscription] 解析done事件失败:', err)
            const errorMessage = err instanceof Error ? err.message : '解析结果失败'
            setError(errorMessage)
            safeCleanup()
            if (rejectRef.current) {
              rejectRef.current(new Error(errorMessage))
              rejectRef.current = null
              resolveRef.current = null
            }
          }
        })

        // 监听 error 事件（服务端发送的错误）
        es.addEventListener('error', (e: any) => {
          try {
            const data = e.data ? JSON.parse(e.data) : { message: '转录过程中发生错误' }
            const errorMessage = data.message || '转录失败'
            setError(errorMessage)
            safeCleanup()
            if (showToast) {
              toast.error(`转录失败: ${errorMessage}`)
            }
            if (rejectRef.current) {
              rejectRef.current(new Error(errorMessage))
              rejectRef.current = null
              resolveRef.current = null
            }
          } catch (err) {
            console.error('[BatchTranscription] 解析error事件失败:', err)
            const fallbackError = '转录失败：服务端返回了无法识别的错误'
            setError(fallbackError)
            safeCleanup()
            if (showToast) {
              toast.error(fallbackError)
            }
            if (rejectRef.current) {
              rejectRef.current(new Error(fallbackError))
              rejectRef.current = null
              resolveRef.current = null
            }
          }
        })

        // 监听连接错误（网络错误、连接中断等）
        es.onerror = () => {
          const errorMessage = '转录连接中断'
          setError(errorMessage)
          safeCleanup()
          if (showToast) {
            toast.error(errorMessage)
          }
          if (rejectRef.current) {
            rejectRef.current(new Error(errorMessage))
            rejectRef.current = null
            resolveRef.current = null
          }
        }
      })
    },
    [merchantId, mode, concurrent, showToast, cleanup, isTranscribing]
  )

  return {
    startTranscription,
    cancelTranscription,
    isTranscribing,
    progress,
    error
  }
}
