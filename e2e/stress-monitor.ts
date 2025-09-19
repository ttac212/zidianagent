/**
 * 极限压力测试监控工具
 * 专门为300并发测试设计的性能监控和资源管理
 */

import { Page } from '@playwright/test'
import { writeFileSync } from 'fs'
import { join } from 'path'

// 系统资源监控接口
export interface SystemResourceMetrics {
  timestamp: number
  cpuUsage: number
  memoryUsage: {
    used: number
    total: number
    percentage: number
  }
  networkStats: {
    requestsPerSecond: number
    bytesPerSecond: number
    errorRate: number
  }
  concurrentConnections: number
}

// 极限压力测试结果接口
export interface ExtremeStressResult {
  testName: string
  concurrentUsers: number
  testDuration: number
  phases: {
    rampUp: PhaseMetrics
    peak: PhaseMetrics
    sustained: PhaseMetrics
  }
  systemResources: SystemResourceMetrics[]
  bottlenecks: BottleneckAnalysis[]
  recommendations: string[]
  summary: {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    overallSuccessRate: number
    averageResponseTime: number
    p95ResponseTime: number
    p99ResponseTime: number
    maxConcurrentUsers: number
    systemStabilityScore: number
  }
}

interface PhaseMetrics {
  name: string
  duration: number
  requests: number
  successRate: number
  avgResponseTime: number
  maxResponseTime: number
  errorsCount: number
  throughput: number
}

interface BottleneckAnalysis {
  component: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  impact: string
  recommendation: string
}

class ExtremeStressMonitor {
  private metrics: SystemResourceMetrics[] = []
  private testStartTime: number = 0
  private testName: string = ''
  private concurrentUsers: number = 0
  private resourceCheckInterval: NodeJS.Timeout | null = null

  constructor(testName: string, concurrentUsers: number) {
    this.testName = testName
    this.concurrentUsers = concurrentUsers
    this.testStartTime = Date.now()
  }

  // 启动系统资源监控
  startResourceMonitoring() {
    console.log(`🔍 [Monitor] 启动资源监控 - ${this.testName}`)
    
    this.resourceCheckInterval = setInterval(() => {
      this.collectSystemMetrics()
    }, 1000) // 每秒收集一次
  }

  // 停止系统资源监控
  stopResourceMonitoring() {
    if (this.resourceCheckInterval) {
      clearInterval(this.resourceCheckInterval)
      this.resourceCheckInterval = null
    }
    console.log(`🔍 [Monitor] 停止资源监控`)
  }

  // 收集系统指标
  private collectSystemMetrics() {
    try {
      // 模拟收集系统指标（在实际环境中应该调用系统API）
      const memoryUsage = process.memoryUsage()
      
      const metrics: SystemResourceMetrics = {
        timestamp: Date.now(),
        cpuUsage: this.mockCpuUsage(),
        memoryUsage: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
        },
        networkStats: {
          requestsPerSecond: this.mockNetworkRPS(),
          bytesPerSecond: this.mockNetworkBytes(),
          errorRate: this.mockErrorRate()
        },
        concurrentConnections: this.concurrentUsers
      }
      
      this.metrics.push(metrics)
      
      // 保持最近5分钟的数据
      if (this.metrics.length > 300) {
        this.metrics.shift()
      }
    } catch (error) {
      console.warn(`⚠️ [Monitor] 收集系统指标失败:`, error)
    }
  }

  // 模拟CPU使用率（在真实环境中应该调用系统API）
  private mockCpuUsage(): number {
    const baseUsage = 20 + (this.concurrentUsers / 300) * 60 // 基于并发数的CPU使用率
    const variation = (Math.random() - 0.5) * 20 // ±10%变化
    return Math.max(0, Math.min(100, baseUsage + variation))
  }

  // 模拟网络RPS
  private mockNetworkRPS(): number {
    return this.concurrentUsers * (2 + Math.random() * 3) // 每用户2-5 RPS
  }

  // 模拟网络字节数
  private mockNetworkBytes(): number {
    return this.mockNetworkRPS() * (1024 + Math.random() * 2048) // 1-3KB per request
  }

  // 模拟错误率
  private mockErrorRate(): number {
    const baseErrorRate = Math.min(15, this.concurrentUsers / 20) // 基于并发数的错误率
    return baseErrorRate + Math.random() * 5
  }

  // 监控页面性能
  async monitorPagePerformance(page: Page, operationName: string): Promise<{
    loadTime: number
    domElements: number
    memoryUsage: number
    performanceScore: number
  }> {
    const startTime = Date.now()
    
    try {
      // 等待页面稳定
      await page.waitForLoadState('networkidle', { timeout: 5000 })
      
      // 收集页面性能数据
      const performanceData = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        const memory = (performance as any).memory
        
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          domElements: document.querySelectorAll('*').length,
          memoryUsage: memory?.usedJSHeapSize || 0,
          resourceCount: performance.getEntriesByType('resource').length
        }
      })

      const loadTime = Date.now() - startTime
      
      // 计算性能评分（0-100）
      const performanceScore = this.calculatePerformanceScore({
        loadTime,
        domContentLoaded: performanceData.domContentLoaded,
        domElements: performanceData.domElements,
        memoryUsage: performanceData.memoryUsage
      })

      return {
        loadTime,
        domElements: performanceData.domElements,
        memoryUsage: performanceData.memoryUsage,
        performanceScore
      }
    } catch (error) {
      console.warn(`⚠️ [Monitor] 页面性能监控失败 [${operationName}]:`, error)
      return {
        loadTime: Date.now() - startTime,
        domElements: 0,
        memoryUsage: 0,
        performanceScore: 0
      }
    }
  }

  // 计算性能评分
  private calculatePerformanceScore(metrics: {
    loadTime: number
    domContentLoaded: number
    domElements: number
    memoryUsage: number
  }): number {
    let score = 100

    // 加载时间评分 (0-40分)
    if (metrics.loadTime > 5000) score -= 40
    else if (metrics.loadTime > 3000) score -= 25
    else if (metrics.loadTime > 1000) score -= 10

    // DOM内容加载评分 (0-20分)
    if (metrics.domContentLoaded > 2000) score -= 20
    else if (metrics.domContentLoaded > 1000) score -= 10

    // 内存使用评分 (0-20分)
    const memoryMB = metrics.memoryUsage / 1024 / 1024
    if (memoryMB > 100) score -= 20
    else if (memoryMB > 50) score -= 10

    // DOM复杂度评分 (0-20分)
    if (metrics.domElements > 2000) score -= 20
    else if (metrics.domElements > 1000) score -= 10

    return Math.max(0, score)
  }

  // 检测系统瓶颈
  detectBottlenecks(): BottleneckAnalysis[] {
    const bottlenecks: BottleneckAnalysis[] = []
    
    if (this.metrics.length === 0) return bottlenecks

    const latestMetrics = this.metrics[this.metrics.length - 1]
    const avgMetrics = this.calculateAverageMetrics()

    // CPU瓶颈检测
    if (avgMetrics.cpuUsage > 80) {
      bottlenecks.push({
        component: 'CPU',
        severity: avgMetrics.cpuUsage > 95 ? 'critical' : 'high',
        description: `CPU使用率过高: ${avgMetrics.cpuUsage.toFixed(1)}%`,
        impact: '响应时间增加，系统卡顿',
        recommendation: '优化代码逻辑，减少CPU密集型操作'
      })
    }

    // 内存瓶颈检测
    if (avgMetrics.memoryPercentage > 85) {
      bottlenecks.push({
        component: 'Memory',
        severity: avgMetrics.memoryPercentage > 95 ? 'critical' : 'high',
        description: `内存使用率过高: ${avgMetrics.memoryPercentage.toFixed(1)}%`,
        impact: '可能导致内存泄漏或系统崩溃',
        recommendation: '检查内存泄漏，优化数据结构'
      })
    }

    // 网络瓶颈检测
    if (avgMetrics.errorRate > 10) {
      bottlenecks.push({
        component: 'Network',
        severity: avgMetrics.errorRate > 20 ? 'critical' : 'high',
        description: `网络错误率过高: ${avgMetrics.errorRate.toFixed(1)}%`,
        impact: '用户体验下降，功能不可用',
        recommendation: '检查网络配置，增加重试机制'
      })
    }

    return bottlenecks
  }

  // 计算平均指标
  private calculateAverageMetrics() {
    if (this.metrics.length === 0) {
      return {
        cpuUsage: 0,
        memoryPercentage: 0,
        errorRate: 0,
        requestsPerSecond: 0
      }
    }

    const totals = this.metrics.reduce((acc, metric) => ({
      cpuUsage: acc.cpuUsage + metric.cpuUsage,
      memoryPercentage: acc.memoryPercentage + metric.memoryUsage.percentage,
      errorRate: acc.errorRate + metric.networkStats.errorRate,
      requestsPerSecond: acc.requestsPerSecond + metric.networkStats.requestsPerSecond
    }), { cpuUsage: 0, memoryPercentage: 0, errorRate: 0, requestsPerSecond: 0 })

    const count = this.metrics.length
    return {
      cpuUsage: totals.cpuUsage / count,
      memoryPercentage: totals.memoryPercentage / count,
      errorRate: totals.errorRate / count,
      requestsPerSecond: totals.requestsPerSecond / count
    }
  }

  // 生成优化建议
  generateRecommendations(testResults: any): string[] {
    const recommendations: string[] = []
    const bottlenecks = this.detectBottlenecks()

    // 基于瓶颈分析的建议
    bottlenecks.forEach(bottleneck => {
      if (bottleneck.severity === 'critical' || bottleneck.severity === 'high') {
        recommendations.push(bottleneck.recommendation)
      }
    })

    // 基于测试结果的建议
    if (testResults.overallSuccessRate < 70) {
      recommendations.push('考虑增加服务器资源或优化数据库性能')
      recommendations.push('实施更好的错误处理和重试机制')
    }

    if (testResults.averageResponseTime > 3000) {
      recommendations.push('启用响应缓存，减少重复计算')
      recommendations.push('考虑使用CDN加速静态资源')
    }

    // 架构级别的建议
    if (this.concurrentUsers >= 200 && testResults.overallSuccessRate < 80) {
      recommendations.push('考虑从SQLite迁移到PostgreSQL或MySQL')
      recommendations.push('实施数据库连接池和读写分离')
      recommendations.push('使用Redis进行缓存和会话管理')
    }

    if (recommendations.length === 0) {
      recommendations.push('系统在当前负载下表现良好')
      recommendations.push('可以考虑测试更高的并发级别')
    }

    return recommendations
  }

  // 保存监控报告
  saveMonitoringReport(testResults: any, outputDir: string = 'test-results') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `extreme-stress-monitor-${timestamp}.json`
    const filepath = join(outputDir, filename)

    const report = {
      testInfo: {
        testName: this.testName,
        concurrentUsers: this.concurrentUsers,
        duration: Date.now() - this.testStartTime,
        timestamp: new Date().toISOString()
      },
      systemMetrics: this.metrics,
      bottlenecks: this.detectBottlenecks(),
      recommendations: this.generateRecommendations(testResults),
      averageMetrics: this.calculateAverageMetrics(),
      testResults
    }

    try {
      writeFileSync(filepath, JSON.stringify(report, null, 2))
      console.log(`📊 监控报告已保存: ${filepath}`)
    } catch (error) {
      console.error('❌ 保存监控报告失败:', error)
    }
  }

  // 实时打印监控状态
  printRealTimeStatus() {
    if (this.metrics.length === 0) return

    const latest = this.metrics[this.metrics.length - 1]
    const avg = this.calculateAverageMetrics()

    console.log(`📊 [Monitor] 实时状态:`)
    console.log(`   CPU: ${latest.cpuUsage.toFixed(1)}% (平均: ${avg.cpuUsage.toFixed(1)}%)`)
    console.log(`   内存: ${latest.memoryUsage.percentage.toFixed(1)}% (平均: ${avg.memoryPercentage.toFixed(1)}%)`)
    console.log(`   RPS: ${latest.networkStats.requestsPerSecond.toFixed(0)} (平均: ${avg.requestsPerSecond.toFixed(0)})`)
    console.log(`   错误率: ${latest.networkStats.errorRate.toFixed(1)}% (平均: ${avg.errorRate.toFixed(1)}%)`)
  }
}

// 并发测试管理器
export class ConcurrencyManager {
  private activeTests: Map<string, ExtremeStressMonitor> = new Map()

  // 创建新的压力测试监控
  createStressTest(testName: string, concurrentUsers: number): ExtremeStressMonitor {
    const monitor = new ExtremeStressMonitor(testName, concurrentUsers)
    this.activeTests.set(testName, monitor)
    return monitor
  }

  // 获取测试监控器
  getStressTest(testName: string): ExtremeStressMonitor | undefined {
    return this.activeTests.get(testName)
  }

  // 清理测试
  cleanupTest(testName: string) {
    const monitor = this.activeTests.get(testName)
    if (monitor) {
      monitor.stopResourceMonitoring()
      this.activeTests.delete(testName)
    }
  }

  // 获取全局状态
  getGlobalStatus() {
    const totalUsers = Array.from(this.activeTests.values())
      .reduce((sum, monitor) => sum + monitor['concurrentUsers'], 0)
    
    return {
      activeTests: this.activeTests.size,
      totalConcurrentUsers: totalUsers,
      tests: Array.from(this.activeTests.keys())
    }
  }
}

// 全局并发管理器实例
export const concurrencyManager = new ConcurrencyManager()

export { ExtremeStressMonitor }