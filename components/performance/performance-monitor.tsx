"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Activity, Zap, Clock } from "lucide-react"

interface PerformanceMetrics {
  loadTime: number
  renderTime: number
  memoryUsage: number
  networkLatency: number
  fps: number
  bundleSize: number
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const collectMetrics = () => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming
      const memory = (performance as any).memory

      const loadTime = navigation.loadEventEnd - navigation.startTime
      const renderTime = navigation.domContentLoadedEventEnd - navigation.startTime
      const memoryUsage = memory ? memory.usedJSHeapSize / 1024 / 1024 : 0
      const networkLatency = navigation.responseStart - navigation.requestStart

      setMetrics({
        loadTime: Math.round(loadTime),
        renderTime: Math.round(renderTime),
        memoryUsage: Math.round(memoryUsage * 100) / 100,
        networkLatency: Math.round(networkLatency),
        fps: 60, // 模拟FPS数据
        bundleSize: 2.5, // 模拟Bundle大小(MB)
      })
    }

    // 页面加载完成后收集指标
    if (document.readyState === "complete") {
      collectMetrics()
    } else {
      window.addEventListener("load", collectMetrics)
    }

    // 键盘快捷键显示/隐藏性能监控
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === "P") {
        event.preventDefault()
        setIsVisible(!isVisible)
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("load", collectMetrics)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isVisible])

  if (!isVisible || !metrics) return null

  const getPerformanceLevel = (value: number, thresholds: [number, number]) => {
    if (value <= thresholds[0]) return { level: "excellent", color: "text-green-600" }
    if (value <= thresholds[1]) return { level: "good", color: "text-yellow-600" }
    return { level: "poor", color: "text-red-600" }
  }

  const loadTimeLevel = getPerformanceLevel(metrics.loadTime, [1000, 3000])
  const memoryLevel = getPerformanceLevel(metrics.memoryUsage, [50, 100])

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card className="shadow-lg border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">性能监控</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              实时
            </Badge>
          </div>
          <CardDescription className="text-xs">按 Ctrl+Shift+P 切换显示</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">页面加载</span>
                <span className={loadTimeLevel.color}>{metrics.loadTime}ms</span>
              </div>
              <Progress value={Math.min((metrics.loadTime / 5000) * 100, 100)} className="h-1" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">渲染时间</span>
                <span>{metrics.renderTime}ms</span>
              </div>
              <Progress value={Math.min((metrics.renderTime / 3000) * 100, 100)} className="h-1" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">内存使用</span>
                <span className={memoryLevel.color}>{metrics.memoryUsage}MB</span>
              </div>
              <Progress value={Math.min((metrics.memoryUsage / 200) * 100, 100)} className="h-1" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">网络延迟</span>
                <span>{metrics.networkLatency}ms</span>
              </div>
              <Progress value={Math.min((metrics.networkLatency / 1000) * 100, 100)} className="h-1" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t text-xs">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              <span>FPS: {metrics.fps}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Bundle: {metrics.bundleSize}MB</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
