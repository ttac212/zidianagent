/**
 * E2E 性能监控工具
 * 用于收集和分析并发测试的性能数据
 */

import { Page } from '@playwright/test'
import { writeFileSync } from 'fs'
import { join } from 'path'

export interface PerformanceMetric {
  timestamp: number
  userId: string
  operation: string
  duration: number
  success: boolean
  details?: any
}

export interface ConcurrentTestResult {
  testName: string
  startTime: number
  endTime: number
  totalDuration: number
  concurrentUsers: number
  metrics: PerformanceMetric[]
  summary: {
    totalOperations: number
    successfulOperations: number
    failedOperations: number
    averageResponseTime: number
    minResponseTime: number
    maxResponseTime: number
    throughput: number // operations per second
  }
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private testStartTime: number = 0
  private testName: string = ''

  constructor(testName: string) {
    this.testName = testName
    this.testStartTime = Date.now()
  }

  // 记录操作开始
  startOperation(userId: string, operation: string): string {
    const operationId = `${userId}-${operation}-${Date.now()}`
    return operationId
  }

  // 记录操作完成
  endOperation(operationId: string, userId: string, operation: string, success: boolean, details?: any) {
    const timestamp = Date.now()
    const startTimestamp = parseInt(operationId.split('-').pop() || '0')
    const duration = timestamp - startTimestamp

    this.metrics.push({
      timestamp,
      userId,
      operation,
      duration,
      success,
      details
    })
  }

  // 监控页面性能
  async measurePageLoad(page: Page, userId: string): Promise<number> {
    const startTime = Date.now()
    
    // 使用Performance API获取更精确的时间
    const performanceData = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      }
    })

    const endTime = Date.now()
    const totalLoadTime = endTime - startTime

    this.metrics.push({
      timestamp: endTime,
      userId,
      operation: 'pageLoad',
      duration: totalLoadTime,
      success: true,
      details: performanceData
    })

    return totalLoadTime
  }

  // 监控基础交互性能
  async measureInteraction(page: Page, userId: string, interaction: string): Promise<{ success: boolean, duration: number }> {
    const startTime = Date.now()
    let success = false

    try {
      // 测试基础界面交互
      switch (interaction) {
        case 'navigation':
          await page.goto('/workspace', { waitUntil: 'domcontentloaded' })
          await page.waitForSelector('[data-testid="chat-container"], .chat-container, main', { timeout: 8000 })
          break
        
        case 'element_check':
          const elementsExist = await page.evaluate(() => {
            const buttons = document.querySelectorAll('button')
            const inputs = document.querySelectorAll('input, textarea')
            return buttons.length > 0 && inputs.length > 0
          })
          success = elementsExist
          break
        
        case 'memory_check':
          const memoryInfo = await page.evaluate(() => {
            const memory = (performance as any).memory
            return memory?.usedJSHeapSize || 0
          })
          success = memoryInfo > 0
          break
        
        default:
          await page.waitForLoadState('networkidle')
      }
      
      if (interaction !== 'element_check' && interaction !== 'memory_check') {
        success = true
      }
    } catch (error) {
      console.error(`❌ [${userId}] 交互测试失败:`, error)
    }

    const endTime = Date.now()
    const duration = endTime - startTime

    this.metrics.push({
      timestamp: endTime,
      userId,
      operation: interaction,
      duration,
      success,
      details: { interactionType: interaction }
    })

    return { success, duration }
  }

  // 生成测试报告
  generateReport(concurrentUsers: number): ConcurrentTestResult {
    const endTime = Date.now()
    const totalDuration = endTime - this.testStartTime

    // 计算统计数据
    const successfulMetrics = this.metrics.filter(m => m.success)
    const failedMetrics = this.metrics.filter(m => !m.success)
    
    const durations = successfulMetrics.map(m => m.duration)
    const averageResponseTime = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
    const minResponseTime = durations.length > 0 ? Math.min(...durations) : 0
    const maxResponseTime = durations.length > 0 ? Math.max(...durations) : 0
    const throughput = (successfulMetrics.length / totalDuration) * 1000 // ops per second

    const result: ConcurrentTestResult = {
      testName: this.testName,
      startTime: this.testStartTime,
      endTime,
      totalDuration,
      concurrentUsers,
      metrics: this.metrics,
      summary: {
        totalOperations: this.metrics.length,
        successfulOperations: successfulMetrics.length,
        failedOperations: failedMetrics.length,
        averageResponseTime,
        minResponseTime,
        maxResponseTime,
        throughput
      }
    }

    return result
  }

  // 保存报告到文件
  saveReport(result: ConcurrentTestResult, outputDir: string = 'test-results') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `performance-report-${this.testName}-${timestamp}.json`
    const filepath = join(outputDir, filename)

    try {
      writeFileSync(filepath, JSON.stringify(result, null, 2))
      console.log(`📊 性能报告已保存: ${filepath}`)
    } catch (error) {
      console.error('❌ 保存报告失败:', error)
    }
  }

  // 打印实时统计
  printRealTimeStats() {
    const recentMetrics = this.metrics.slice(-10) // 最近10个操作
    const successRate = this.metrics.length > 0 
      ? (this.metrics.filter(m => m.success).length / this.metrics.length) * 100 
      : 0

    console.log(`📈 实时统计 [${this.testName}]:`)
    console.log(`   - 总操作数: ${this.metrics.length}`)
    console.log(`   - 成功率: ${successRate.toFixed(1)}%`)
    
    if (recentMetrics.length > 0) {
      const recentAvg = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
      console.log(`   - 近期平均响应时间: ${recentAvg.toFixed(2)}ms`)
    }
  }
}

// 并发性能测试辅助函数
export async function runConcurrentPerformanceTest(
  testName: string,
  testFunction: (monitor: PerformanceMonitor, userId: string) => Promise<void>,
  concurrentUsers: number = 8
): Promise<ConcurrentTestResult> {
  
  const monitor = new PerformanceMonitor(testName)
  console.log(`🚀 开始并发性能测试: ${testName} (${concurrentUsers} 个并发用户)`)

  // 创建并发任务
  const tasks = Array.from({ length: concurrentUsers }, (_, index) => {
    const userId = `perf-user-${index + 1}`
    return testFunction(monitor, userId)
  })

  // 等待所有任务完成
  try {
    await Promise.allSettled(tasks)
  } catch (error) {
    console.error('❌ 并发性能测试出现错误:', error)
  }

  // 生成和保存报告
  const result = monitor.generateReport(concurrentUsers)
  monitor.saveReport(result)

  // 打印性能总结
  console.log(`\n📊 === ${testName} 性能测试完成 ===`)
  console.log(`测试耗时: ${result.totalDuration}ms`)
  console.log(`成功率: ${((result.summary.successfulOperations / result.summary.totalOperations) * 100).toFixed(1)}%`)
  console.log(`平均响应时间: ${result.summary.averageResponseTime.toFixed(2)}ms`)
  console.log(`最快响应: ${result.summary.minResponseTime}ms`)
  console.log(`最慢响应: ${result.summary.maxResponseTime}ms`)
  console.log(`操作吞吐量: ${result.summary.throughput.toFixed(2)} ops/sec`)
  console.log(`💰 测试成本: 🆓 零成本（无AI调用）`)

  return result
}

export { PerformanceMonitor }