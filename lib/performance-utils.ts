"use client"

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout | null = null

  return ((...args: any[]) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}

// 节流函数
export function throttle<T extends (...args: any[]) => any>(func: T, limit: number): T {
  let inThrottle: boolean

  return ((...args: any[]) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }) as T
}

// 延迟执行
export function defer(callback: () => void): void {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(callback)
  } else {
    setTimeout(callback, 0)
  }
}

// 批量更新
export class BatchUpdater {
  private updates: (() => void)[] = []
  private scheduled = false

  add(update: () => void): void {
    this.updates.push(update)
    if (!this.scheduled) {
      this.scheduled = true
      requestAnimationFrame(() => {
        this.flush()
      })
    }
  }

  private flush(): void {
    const updates = this.updates.splice(0)
    updates.forEach((update) => update())
    this.scheduled = false
  }
}

// 性能测量
export class PerformanceMeasurer {
  private marks = new Map<string, number>()

  start(name: string): void {
    this.marks.set(name, performance.now())
  }

  end(name: string): number {
    const startTime = this.marks.get(name)
    if (!startTime) {
      return 0
    }

    const duration = performance.now() - startTime
    this.marks.delete(name)
    return duration
  }

  measure(name: string, fn: () => void): number {
    this.start(name)
    fn()
    return this.end(name)
  }

  async measureAsync(name: string, fn: () => Promise<void>): Promise<number> {
    this.start(name)
    await fn()
    return this.end(name)
  }
}

// 内存使用监控
export function getMemoryUsage(): { used: number; total: number } | null {
  if (typeof window !== "undefined" && "memory" in performance) {
    const memory = (performance as any).memory
    return {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
    }
  }
  return null
}

// 网络状态检测
export function getNetworkInfo(): { effectiveType?: string; downlink?: number; rtt?: number } {
  if (typeof navigator !== "undefined" && "connection" in navigator) {
    const connection = (navigator as any).connection
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
    }
  }
  return {}
}

// 设备性能等级评估
export function getDevicePerformanceLevel(): "high" | "medium" | "low" {
  if (typeof navigator === "undefined") return "medium"

  const hardwareConcurrency = navigator.hardwareConcurrency || 4
  const memory = getMemoryUsage()
  const network = getNetworkInfo()

  let score = 0

  // CPU核心数评分
  if (hardwareConcurrency >= 8) score += 3
  else if (hardwareConcurrency >= 4) score += 2
  else score += 1

  // 内存评分
  if (memory && memory.total >= 4000) score += 3
  else if (memory && memory.total >= 2000) score += 2
  else score += 1

  // 网络评分
  if (network.effectiveType === "4g") score += 2
  else if (network.effectiveType === "3g") score += 1

  if (score >= 7) return "high"
  if (score >= 4) return "medium"
  return "low"
}
