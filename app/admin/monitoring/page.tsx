"use client"

import { Header } from "@/components/header"
import { usePageTracking } from "@/lib/analytics"
import dynamic from 'next/dynamic'
import { Suspense } from 'react'

// 懒加载重型监控组件
const SystemMonitor = dynamic(() => import("@/components/monitoring/system-monitor").then(mod => ({ default: mod.SystemMonitor })), {
  loading: () => (
    <div className="space-y-6">
      <div className="h-64 bg-muted animate-pulse rounded-lg"></div>
      <div className="h-48 bg-muted animate-pulse rounded-lg"></div>
      <div className="h-32 bg-muted animate-pulse rounded-lg"></div>
    </div>
  ),
  ssr: false // 监控组件不需要SSR
})

export default function MonitoringPage() {
  usePageTracking("admin-monitoring")

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="max-w-7xl mx-auto">
          {/* 页面标题 */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">系统监控</h1>
            <p className="text-muted-foreground">实时监控系统性能和健康状态</p>
          </div>

          <Suspense fallback={
            <div className="space-y-6">
              <div className="h-64 bg-muted animate-pulse rounded-lg"></div>
              <div className="h-48 bg-muted animate-pulse rounded-lg"></div>
            </div>
          }>
            <SystemMonitor />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
