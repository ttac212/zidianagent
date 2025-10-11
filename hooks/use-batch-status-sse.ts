/**
 * 批次状态 SSE Hook
 * 
 * 使用 statusVersion 实现客户端去重
 */

import { useEffect, useRef, useState } from 'react'

export interface BatchStatusEvent {
  batchId: string
  status: string
  statusVersion: number
  startedAt: string | null
  completedAt: string | null
  errorCode: string | null
  errorMessage: string | null
  tokenUsage: any
  copyCount: number
  timestamp: string
}

export interface UseBatchStatusSSEOptions {
  batchId: string
  enabled?: boolean
  onStatusUpdate?: (event: BatchStatusEvent) => void
  onComplete?: (event: { batchId: string; finalStatus: string }) => void
  onError?: (error: Error) => void
}

export function useBatchStatusSSE({
  batchId,
  enabled = true,
  onStatusUpdate,
  onComplete,
  onError
}: UseBatchStatusSSEOptions) {
  const [status, setStatus] = useState<BatchStatusEvent | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const eventSourceRef = useRef<EventSource | null>(null)
  const lastStatusVersionRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled || !batchId) return

    console.log('[SSE] Connecting to batch:', batchId)

    const eventSource = new EventSource(
      `/api/creative/batches/${batchId}/events`
    )

    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log('[SSE] Connected')
      setIsConnected(true)
      setError(null)
    }

    eventSource.addEventListener('batch-status', (e: MessageEvent) => {
      try {
        const data: BatchStatusEvent = JSON.parse(e.data)
        
        // 客户端去重：只处理新的 statusVersion
        if (data.statusVersion <= lastStatusVersionRef.current) {
          console.log('[SSE] Ignoring duplicate event, version:', data.statusVersion)
          return
        }

        lastStatusVersionRef.current = data.statusVersion

        console.log('[SSE] Status update:', data.status, 'version:', data.statusVersion)
        
        setStatus(data)
        onStatusUpdate?.(data)
      } catch (err: any) {
        console.error('[SSE] Failed to parse batch-status:', err)
      }
    })

    eventSource.addEventListener('complete', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        console.log('[SSE] Batch complete:', data.finalStatus)
        onComplete?.(data)
        eventSource.close()
      } catch (err: any) {
        console.error('[SSE] Failed to parse complete event:', err)
      }
    })

    eventSource.addEventListener('error', (e: MessageEvent) => {
      try {
        const data = JSON.parse((e as any).data || '{}')
        const err = new Error(data.message || 'SSE connection error')
        console.error('[SSE] Error event:', err.message)
        setError(err)
        onError?.(err)
      } catch {
        const err = new Error('SSE connection error')
        setError(err)
        onError?.(err)
      }
    })

    eventSource.onerror = (e) => {
      console.error('[SSE] Connection error')
      setIsConnected(false)
      
      // 如果连接被服务器关闭（readyState = 2），不算错误
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log('[SSE] Connection closed by server')
        return
      }

      const err = new Error('SSE connection failed')
      setError(err)
      onError?.(err)
    }

    return () => {
      console.log('[SSE] Cleaning up connection')
      eventSource.close()
      eventSourceRef.current = null
      setIsConnected(false)
    }
  }, [batchId, enabled])

  return {
    status,
    isConnected,
    error,
    disconnect: () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      setIsConnected(false)
    }
  }
}
