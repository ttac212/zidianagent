'use client'

import { useEffect, useState } from 'react'

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<{
    fcp?: number
    lcp?: number
    fid?: number
    cls?: number
    ttfb?: number
  }>({})

  useEffect(() => {
    if (typeof window === 'undefined') return

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'paint') {
          if (entry.name === 'first-contentful-paint') {
            setMetrics(prev => ({ ...prev, fcp: entry.startTime }))
          }
        }
        if (entry.entryType === 'largest-contentful-paint') {
          setMetrics(prev => ({ ...prev, lcp: entry.startTime }))
        }
      }
    })

    observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] })

    // 获取TTFB
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (navigation) {
      setMetrics(prev => ({ ...prev, ttfb: navigation.responseStart - navigation.fetchStart }))
    }

    return () => observer.disconnect()
  }, [])

  // 仅在开发环境显示
  if (process.env.NODE_ENV !== 'development') return null

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-2 rounded text-xs font-mono z-50">
      <div className="text-yellow-400 mb-1">⚡ Performance</div>
      {metrics.fcp && <div>FCP: {metrics.fcp.toFixed(0)}ms</div>}
      {metrics.lcp && <div>LCP: {metrics.lcp.toFixed(0)}ms</div>}
      {metrics.ttfb && <div>TTFB: {metrics.ttfb.toFixed(0)}ms</div>}
    </div>
  )
}