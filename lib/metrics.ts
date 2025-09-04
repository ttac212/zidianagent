"use client"

// Lightweight Metrics SDK for Web Vitals + custom marks/measures
// - Sends via sendBeacon when available, otherwise fetch(keepalive)
// - Safely no-op on SSR

import type { Metric } from 'web-vitals'
import { onLCP, onCLS, onINP, onTTFB, onFCP } from 'web-vitals'

export type MetricPayload = {
  name: string
  value?: number
  ts?: number
  tags?: Record<string, string>
  detail?: any
}

export type MetricsInitOptions = {
  endpoint?: string
  sampleRate?: number // 0..1
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
  baseTags: {},
}

function now() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
}

function shouldSample() {
  return Math.random() < STATE.sampleRate
}

export function initMetrics(opts: MetricsInitOptions = {}) {
  if (STATE.inited) return
  STATE.endpoint = opts.endpoint || STATE.endpoint
  STATE.sampleRate = typeof opts.sampleRate === 'number' ? Math.max(0, Math.min(1, opts.sampleRate)) : STATE.sampleRate
  STATE.baseTags = {
    app: opts.app || 'zhidian-ai-platform',
    version: opts.version || (process.env.NEXT_PUBLIC_APP_VERSION || 'dev'),
    ...opts.tags,
  }
  STATE.inited = true
}

export function setUser(userId?: string) {
  if (!userId) return
  STATE.baseTags.userId = userId
}

export function send(payload: MetricPayload) {
  if (typeof window === 'undefined') return
  if (!STATE.inited) initMetrics()
  if (!shouldSample()) return
  const body = JSON.stringify({ ...payload, ts: payload.ts || Date.now(), tags: { ...STATE.baseTags, ...payload.tags } })
  try {
    if (navigator?.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon(STATE.endpoint, blob)
      return
    }
  } catch {}
  try {
    fetch(STATE.endpoint, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true })
  } catch {}
}

export function mark(name: string, tags?: Record<string, string>) {
  if (typeof performance !== 'undefined' && performance.mark) {
    try { performance.mark(name) } catch {}
  }
  send({ name: 'mark', value: 0, detail: { mark: name }, tags })
}

export function measure(name: string, startMark: string, endMark: string, extra?: { tags?: Record<string,string>, detail?: any }) {
  let duration: number | undefined
  try {
    if (performance.getEntriesByName && performance.measure) {
      // Clear existing measure if any
      try { performance.clearMeasures(name) } catch {}
      performance.measure(name, startMark, endMark)
      const entries = performance.getEntriesByName(name)
      duration = entries?.[entries.length - 1]?.duration
    }
  } catch {}
  send({ name, value: duration, detail: { startMark, endMark, ...(extra?.detail || {}) }, tags: extra?.tags })
}

export function setupWebVitals() {
  // Safety: only attach once per page
  if ((window as any).__webVitalsSetup) return
  ;(window as any).__webVitalsSetup = true
  const sendMetric = (metric: Metric) => {
    send({ name: metric.name, value: metric.value, detail: { id: metric.id, rating: (metric as any).rating } })
  }
  onLCP(sendMetric)
  onCLS(sendMetric)
  onINP(sendMetric)
  onTTFB(sendMetric)
  onFCP(sendMetric)
}

// Helpers for common flows
export function startEndTracker(baseName: string, tags?: Record<string,string>) {
  const start = () => mark(`${baseName}_shown`, tags)
  const end = (extra?: { tags?: Record<string,string> }) => {
    mark(`${baseName}_hidden`, { ...tags, ...extra?.tags })
    measure(`${baseName}_visible_dur`, `${baseName}_shown`, `${baseName}_hidden`, { tags: { ...tags, ...extra?.tags } })
  }
  return { start, end }
}

export const Metrics = {
  init: initMetrics,
  setUser,
  send,
  mark,
  measure,
  setupWebVitals,
  startEndTracker,
}

