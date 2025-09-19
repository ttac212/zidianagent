/**
 * API监控模块
 * 用于追踪API请求的性能和错误
 */

interface APIStats {
  endpoint: string
  method: string
  status: number
  duration: number
  success: boolean
  error?: string
  timestamp: Date
}

interface AggregatedStats {
  totalRequests: number
  successCount: number
  errorCount: number
  averageResponseTime: number
  errorRate: number
  endpoints: Map<string, EndpointStats>
  recentErrors: ErrorInfo[]
}

interface EndpointStats {
  requests: number
  successes: number
  errors: number
  avgResponseTime: number
  lastError?: string
  lastErrorTime?: Date
}

interface ErrorInfo {
  endpoint: string
  error: string
  timestamp: Date
  status?: number
}

class APIMonitor {
  private stats: APIStats[] = []
  private maxStatsSize = 1000 // 最多保留1000条记录
  private errorThreshold = 0.1 // 10%错误率阈值
  private slowRequestThreshold = 5000 // 5秒慢请求阈值
  
  /**
   * 记录API请求
   */
  logRequest(
    endpoint: string,
    method: string,
    status: number,
    duration: number,
    error?: string
  ): void {
    const stat: APIStats = {
      endpoint,
      method,
      status,
      duration,
      success: status >= 200 && status < 300,
      error,
      timestamp: new Date()
    }
    
    this.stats.push(stat)
    
    // 限制内存使用
    if (this.stats.length > this.maxStatsSize) {
      this.stats = this.stats.slice(-this.maxStatsSize)
    }
    
    // 检查是否需要告警
    this.checkAlerts(stat)
  }
  
  /**
   * 检查并触发告警
   */
  private checkAlerts(stat: APIStats): void {
    // 慢请求告警
    if (stat.duration > this.slowRequestThreshold) {
      }
    
    // 错误告警
    if (!stat.success) {
      }
    
    // 检查错误率
    const recentStats = this.getRecentStats(100) // 最近100个请求
    if (recentStats.length >= 10) {
      const errorCount = recentStats.filter(s => !s.success).length
      const errorRate = errorCount / recentStats.length
      
      if (errorRate > this.errorThreshold) {
        console.warn(`High error rate detected: ${(errorRate * 100).toFixed(2)}% (${errorCount}/${recentStats.length})`)
      }
    }
  }
  
  /**
   * 获取最近的统计数据
   */
  private getRecentStats(count: number): APIStats[] {
    return this.stats.slice(-count)
  }
  
  /**
   * 获取聚合统计
   */
  getAggregatedStats(): AggregatedStats {
    const endpoints = new Map<string, EndpointStats>()
    const recentErrors: ErrorInfo[] = []
    
    let totalDuration = 0
    let successCount = 0
    let errorCount = 0
    
    for (const stat of this.stats) {
      // 更新总计
      totalDuration += stat.duration
      if (stat.success) {
        successCount++
      } else {
        errorCount++
        
        // 记录错误信息
        recentErrors.push({
          endpoint: stat.endpoint,
          error: stat.error || `HTTP ${stat.status}`,
          timestamp: stat.timestamp,
          status: stat.status
        })
      }
      
      // 更新端点统计
      let endpointStat = endpoints.get(stat.endpoint)
      if (!endpointStat) {
        endpointStat = {
          requests: 0,
          successes: 0,
          errors: 0,
          avgResponseTime: 0
        }
        endpoints.set(stat.endpoint, endpointStat)
      }
      
      endpointStat.requests++
      if (stat.success) {
        endpointStat.successes++
      } else {
        endpointStat.errors++
        endpointStat.lastError = stat.error || `HTTP ${stat.status}`
        endpointStat.lastErrorTime = stat.timestamp
      }
      
      // 更新平均响应时间（增量计算）
      endpointStat.avgResponseTime = 
        (endpointStat.avgResponseTime * (endpointStat.requests - 1) + stat.duration) / 
        endpointStat.requests
    }
    
    const totalRequests = this.stats.length
    
    return {
      totalRequests,
      successCount,
      errorCount,
      averageResponseTime: totalRequests > 0 ? totalDuration / totalRequests : 0,
      errorRate: totalRequests > 0 ? errorCount / totalRequests : 0,
      endpoints,
      recentErrors: recentErrors.slice(-10) // 最近10个错误
    }
  }
  
  /**
   * 获取性能报告
   */
  getPerformanceReport(): string {
    const stats = this.getAggregatedStats()
    const lines: string[] = [
      '=== API性能报告 ===',
      `总请求数: ${stats.totalRequests}`,
      `成功: ${stats.successCount} (${((stats.successCount / stats.totalRequests) * 100).toFixed(2)}%)`,
      `失败: ${stats.errorCount} (${(stats.errorRate * 100).toFixed(2)}%)`,
      `平均响应时间: ${stats.averageResponseTime.toFixed(0)}ms`,
      '',
      '端点统计:'
    ]
    
    for (const [endpoint, endpointStats] of stats.endpoints) {
      lines.push(
        `  ${endpoint}:`,
        `    请求: ${endpointStats.requests}`,
        `    成功率: ${((endpointStats.successes / endpointStats.requests) * 100).toFixed(2)}%`,
        `    平均响应: ${endpointStats.avgResponseTime.toFixed(0)}ms`
      )
      
      if (endpointStats.lastError) {
        lines.push(
          `    最后错误: ${endpointStats.lastError} (${endpointStats.lastErrorTime?.toLocaleTimeString()})`
        )
      }
    }
    
    if (stats.recentErrors.length > 0) {
      lines.push('', '最近错误:')
      for (const error of stats.recentErrors.slice(-5)) {
        lines.push(
          `  [${error.timestamp.toLocaleTimeString()}] ${error.endpoint}: ${error.error}`
        )
      }
    }
    
    return lines.join('\n')
  }
  
  /**
   * 清空统计数据
   */
  reset(): void {
    this.stats = []
  }
  
  /**
   * 导出统计数据（用于持久化或分析）
   */
  export(): APIStats[] {
    return [...this.stats]
  }
  
  /**
   * 导入统计数据
   */
  import(stats: APIStats[]): void {
    this.stats = stats
  }
}

// 创建全局实例
export const apiMonitor = new APIMonitor()

// 开发环境下，每分钟输出一次性能报告
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const report = apiMonitor.getPerformanceReport()
    if (report) {
      }
  }, 60000)
}

// 导出工具函数
export function trackAPIRequest(
  endpoint: string,
  method: string = 'GET'
): (response: Response | Error) => void {
  const startTime = Date.now()
  
  return (responseOrError: Response | Error) => {
    const duration = Date.now() - startTime
    
    if (responseOrError instanceof Error) {
      apiMonitor.logRequest(
        endpoint,
        method,
        0,
        duration,
        responseOrError.message
      )
    } else {
      apiMonitor.logRequest(
        endpoint,
        method,
        responseOrError.status,
        duration,
        responseOrError.ok ? undefined : `HTTP ${responseOrError.status}`
      )
    }
  }
}