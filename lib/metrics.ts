import * as dt from '@/lib/utils/date-toolkit'

"use client"

// 简化的Metrics工具 - 移除web-vitals依赖

export type MetricPayload = {
  name: string
  value?: number
  ts?: number
  tags?: Record<string, string>
  detail?: any
}

export type MetricsInitOptions = {
  endpoint?: string
  sampleRate?: number
  app?: string
  version?: string
  tags?: Record<string, string>
}

const STATE: {
  inited: boolean
  endpoint: string
  sampleRate: number
  baseTags: Record<string, string>
} = {
  inited: false,
  endpoint: '/api/metrics',
  sampleRate: 1,
  baseTags: {}
}

export function initMetrics(opts: MetricsInitOptions = {}) {
  if (STATE.inited || typeof window === 'undefined') return

  STATE.endpoint = opts.endpoint || '/api/metrics'
  STATE.sampleRate = opts.sampleRate ?? 1
  STATE.baseTags = {
    ...(opts.tags || {}),
    app: opts.app || 'web',
    version: opts.version || 'unknown'
  }

  STATE.inited = true
}

export function sendMetric(payload: MetricPayload) {
  if (!STATE.inited || typeof window === 'undefined') return
  if (Math.random() > STATE.sampleRate) return

  const data = {
    ...payload,
    ts: payload.ts || dt.timestamp(),
    tags: { ...STATE.baseTags, ...payload.tags }
  }

  // 尝试使用sendBeacon，失败时降级到fetch
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const sent = navigator.sendBeacon?.(STATE.endpoint, blob)

  if (!sent) {
    fetch(STATE.endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true
    }).catch(() => {})
  }
}

export function mark(name: string, detail?: any) {
  sendMetric({ name, detail })
}

export function measure(name: string, value: number, detail?: any) {
  sendMetric({ name, value, detail })
}