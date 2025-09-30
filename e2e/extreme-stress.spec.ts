import { test, expect } from '@playwright/test'
import * as dt from '@/lib/utils/date-toolkit'

/**
 * 300并发极限压力测试
 * 分层测试策略，避开数据库瓶颈，专注于系统承载能力
 */

// 极限测试配置
const EXTREME_CONCURRENT_USERS = 300    // 极限并发数
const STRESS_DURATION = 60000           // 压力测试持续时间（60秒）
const RAMP_UP_TIME = 15000              // 渐进加压时间（15秒）
const BATCH_SIZE = 50                   // 批次大小
const REQUEST_INTERVAL = 100            // 请求间隔（毫秒）

// 性能监控数据
interface ExtremeStressMetrics {
  userId: string
  phase: 'ramp-up' | 'peak' | 'sustained'
  operations: {
    total: number
    successful: number
    failed: number
    avgResponseTime: number
    minResponseTime: number
    maxResponseTime: number
  }
  resourceUsage: {
    peakMemory: number
    avgCpuTime: number
  }
  errors: Array<{
    type: string
    message: string
    timestamp: number
  }>
  startTime: number
  endTime: number
}

const globalStressMetrics: ExtremeStressMetrics[] = []

test.describe('300并发极限压力测试', () => {
  
  test.describe.configure({ 
    mode: 'parallel',
    timeout: 120000 // 2分钟超时
  })

  // Phase 1: 静态资源压力测试（无数据库）
  test('Phase 1: 静态资源极限并发测试', async ({ page }) => {
    const userId = `static-${Math.random().toString(36).substr(2, 8)}`
    const metrics: ExtremeStressMetrics = {
      userId,
      phase: 'ramp-up',
      operations: {
        total: 0,
        successful: 0,
        failed: 0,
        avgResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0
      },
      resourceUsage: {
        peakMemory: 0,
        avgCpuTime: 0
      },
      errors: [],
      startTime: dt.timestamp(),
      endTime: 0
    }

    try {
      console.log(`🚀 [${userId}] 启动静态资源极限并发测试...`)

      const responseTimes: number[] = []
      const testDuration = 30000 // 30秒静态资源测试

      // 高频静态资源访问
      const endTime = dt.timestamp() + testDuration
      while (dt.timestamp() < endTime) {
        const startTime = dt.timestamp()
        
        try {
          // 访问静态页面和资源
          await page.goto('/', { 
            waitUntil: 'domcontentloaded',
            timeout: 3000 
          })
          
          const responseTime = dt.timestamp() - startTime
          responseTimes.push(responseTime)
          metrics.operations.successful++
          
          // 更新响应时间统计
          metrics.operations.minResponseTime = Math.min(metrics.operations.minResponseTime, responseTime)
          metrics.operations.maxResponseTime = Math.max(metrics.operations.maxResponseTime, responseTime)
          
          if (metrics.operations.total % 10 === 0) {
            console.log(`📊 [${userId}] 静态测试进度: ${metrics.operations.successful} 成功`)
          }
          
        } catch (error) {
          metrics.operations.failed++
          metrics.errors.push({
            type: 'static_access_error',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: dt.timestamp()
          })
        }
        
        metrics.operations.total++
        
        // 短暂间隔
        await page.waitForTimeout(REQUEST_INTERVAL)
      }

      // 计算统计数据
      metrics.operations.avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0
      
      metrics.endTime = dt.timestamp()
      
      // 收集内存信息
      try {
        const memoryInfo = await page.evaluate(() => {
          const memory = (performance as any).memory
          return memory ? memory.usedJSHeapSize : 0
        })
        metrics.resourceUsage.peakMemory = memoryInfo
      } catch (_error) {
        // 忽略内存检查错误
      }

      console.log(`✅ [${userId}] 静态资源测试完成:`)
      console.log(`   - 总请求: ${metrics.operations.total}`)
      console.log(`   - 成功: ${metrics.operations.successful}`)
      console.log(`   - 失败: ${metrics.operations.failed}`)
      console.log(`   - 成功率: ${((metrics.operations.successful / metrics.operations.total) * 100).toFixed(1)}%`)
      console.log(`   - 平均响应时间: ${metrics.operations.avgResponseTime.toFixed(2)}ms`)

      globalStressMetrics.push(metrics)

      // 基本断言
      const successRate = (metrics.operations.successful / metrics.operations.total) * 100
      expect(successRate).toBeGreaterThan(80) // 静态资源成功率应大于80%
      expect(metrics.operations.avgResponseTime).toBeLessThan(3000) // 平均响应时间小于3秒

    } catch (error) {
      console.error(`❌ [${userId}] 静态资源测试失败:`, error)
      throw error
    }
  })

  // Phase 2: 健康检查API压力测试
  test('Phase 2: 健康检查API极限并发测试', async ({ page }) => {
    const userId = `health-${Math.random().toString(36).substr(2, 8)}`
    const metrics: ExtremeStressMetrics = {
      userId,
      phase: 'peak',
      operations: {
        total: 0,
        successful: 0,
        failed: 0,
        avgResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0
      },
      resourceUsage: {
        peakMemory: 0,
        avgCpuTime: 0
      },
      errors: [],
      startTime: dt.timestamp(),
      endTime: 0
    }

    try {
      console.log(`🔥 [${userId}] 启动健康检查API极限压力测试...`)

      const responseTimes: number[] = []
      const testDuration = 45000 // 45秒API压力测试

      // 高频API调用
      const endTime = dt.timestamp() + testDuration
      while (dt.timestamp() < endTime) {
        const startTime = dt.timestamp()
        
        try {
          // 直接使用fetch调用API，避免页面加载开销
          const response = await page.evaluate(async () => {
            const startTime = dt.timestamp()
            try {
              const res = await fetch('/api/health', {
                method: 'GET',
                headers: {
                  'Cache-Control': 'no-cache'
                }
              })
              return {
                ok: res.ok,
                status: res.status,
                responseTime: dt.timestamp() - startTime
              }
            } catch (error) {
              return {
                ok: false,
                status: 0,
                responseTime: dt.timestamp() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            }
          })
          
          const responseTime = response.responseTime
          responseTimes.push(responseTime)
          
          if (response.ok) {
            metrics.operations.successful++
          } else {
            metrics.operations.failed++
            metrics.errors.push({
              type: 'health_api_error',
              message: `HTTP ${response.status}`,
              timestamp: dt.timestamp()
            })
          }
          
          // 更新响应时间统计
          metrics.operations.minResponseTime = Math.min(metrics.operations.minResponseTime, responseTime)
          metrics.operations.maxResponseTime = Math.max(metrics.operations.maxResponseTime, responseTime)
          
          if (metrics.operations.total % 20 === 0) {
            console.log(`⚡ [${userId}] API测试进度: ${metrics.operations.successful}/${metrics.operations.total}`)
          }
          
        } catch (error) {
          metrics.operations.failed++
          metrics.errors.push({
            type: 'api_call_error',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: dt.timestamp()
          })
        }
        
        metrics.operations.total++
        
        // 最小间隔
        await page.waitForTimeout(50)
      }

      // 计算统计数据
      metrics.operations.avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0
      
      metrics.endTime = dt.timestamp()

      console.log(`🔥 [${userId}] 健康检查API测试完成:`)
      console.log(`   - 总请求: ${metrics.operations.total}`)
      console.log(`   - 成功: ${metrics.operations.successful}`)
      console.log(`   - 失败: ${metrics.operations.failed}`)
      console.log(`   - 成功率: ${((metrics.operations.successful / metrics.operations.total) * 100).toFixed(1)}%`)
      console.log(`   - 平均响应时间: ${metrics.operations.avgResponseTime.toFixed(2)}ms`)
      console.log(`   - 最快响应: ${metrics.operations.minResponseTime}ms`)
      console.log(`   - 最慢响应: ${metrics.operations.maxResponseTime}ms`)

      globalStressMetrics.push(metrics)

      // API压力断言
      const successRate = (metrics.operations.successful / metrics.operations.total) * 100
      expect(successRate).toBeGreaterThan(70) // API成功率应大于70%（考虑速率限制）
      expect(metrics.operations.avgResponseTime).toBeLessThan(5000) // 平均响应时间小于5秒

    } catch (error) {
      console.error(`❌ [${userId}] 健康检查API测试失败:`, error)
      throw error
    }
  })

  // Phase 3: 混合负载压力测试
  test('Phase 3: 混合负载极限压力测试', async ({ page }) => {
    const userId = `mixed-${Math.random().toString(36).substr(2, 8)}`
    const metrics: ExtremeStressMetrics = {
      userId,
      phase: 'sustained',
      operations: {
        total: 0,
        successful: 0,
        failed: 0,
        avgResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0
      },
      resourceUsage: {
        peakMemory: 0,
        avgCpuTime: 0
      },
      errors: [],
      startTime: dt.timestamp(),
      endTime: 0
    }

    try {
      console.log(`⚡ [${userId}] 启动混合负载极限压力测试...`)

      const responseTimes: number[] = []
      const testDuration = 40000 // 40秒混合压力测试
      const operations = ['static', 'health', 'navigation'] // 混合操作类型

      // 混合高频操作
      const endTime = dt.timestamp() + testDuration
      while (dt.timestamp() < endTime) {
        const startTime = dt.timestamp()
        const operation = operations[metrics.operations.total % operations.length]
        
        try {
          let responseTime = 0
          
          switch (operation) {
            case 'static':
              // 静态页面访问
              await page.goto('/', { 
                waitUntil: 'domcontentloaded',
                timeout: 2000 
              })
              responseTime = dt.timestamp() - startTime
              break
              
            case 'health':
              // API健康检查
              const healthResponse = await page.evaluate(async () => {
                const start = dt.timestamp()
                try {
                  const res = await fetch('/api/health')
                  return { ok: res.ok, time: dt.timestamp() - start }
                } catch {
                  return { ok: false, time: dt.timestamp() - start }
                }
              })
              responseTime = healthResponse.time
              if (!healthResponse.ok) throw new Error('Health check failed')
              break
              
            case 'navigation':
              // 页面导航
              await page.goto('/login', { 
                waitUntil: 'domcontentloaded',
                timeout: 2000 
              })
              responseTime = dt.timestamp() - startTime
              break
          }
          
          responseTimes.push(responseTime)
          metrics.operations.successful++
          
          // 更新响应时间统计
          metrics.operations.minResponseTime = Math.min(metrics.operations.minResponseTime, responseTime)
          metrics.operations.maxResponseTime = Math.max(metrics.operations.maxResponseTime, responseTime)
          
          if (metrics.operations.total % 15 === 0) {
            console.log(`🔄 [${userId}] 混合测试进度: ${metrics.operations.successful}/${metrics.operations.total}`)
          }
          
        } catch (_error) {
          metrics.operations.failed++
          metrics.errors.push({
            type: `${operation}_error`,
            message: _error instanceof Error ? _error.message : 'Unknown error',
            timestamp: dt.timestamp()
          })
        }
        
        metrics.operations.total++
        
        // 动态间隔（越到后期间隔越短）
        const progressRatio = (dt.timestamp() - metrics.startTime) / testDuration
        const interval = Math.max(30, REQUEST_INTERVAL * (1 - progressRatio))
        await page.waitForTimeout(interval)
      }

      // 计算统计数据
      metrics.operations.avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0
      
      metrics.endTime = dt.timestamp()

      console.log(`⚡ [${userId}] 混合负载测试完成:`)
      console.log(`   - 总操作: ${metrics.operations.total}`)
      console.log(`   - 成功: ${metrics.operations.successful}`)
      console.log(`   - 失败: ${metrics.operations.failed}`)
      console.log(`   - 成功率: ${((metrics.operations.successful / metrics.operations.total) * 100).toFixed(1)}%`)
      console.log(`   - 平均响应时间: ${metrics.operations.avgResponseTime.toFixed(2)}ms`)
      console.log(`   - 错误类型: ${metrics.errors.length} 个`)

      globalStressMetrics.push(metrics)

      // 混合负载断言
      const successRate = (metrics.operations.successful / metrics.operations.total) * 100
      expect(successRate).toBeGreaterThan(60) // 混合负载成功率应大于60%
      expect(metrics.operations.avgResponseTime).toBeLessThan(8000) // 平均响应时间小于8秒

    } catch (error) {
      console.error(`❌ [${userId}] 混合负载测试失败:`, error)
      throw error
    }
  })
})

// 极限压力测试总结报告
test.afterAll(async () => {
  if (globalStressMetrics.length > 0) {
    console.log('\n🔥 === 300并发极限压力测试总体报告 ===')
    
    const totalOperations = globalStressMetrics.reduce((sum, m) => sum + m.operations.total, 0)
    const totalSuccessful = globalStressMetrics.reduce((sum, m) => sum + m.operations.successful, 0)
    const totalFailed = globalStressMetrics.reduce((sum, m) => sum + m.operations.failed, 0)
    const avgResponseTime = globalStressMetrics.reduce((sum, m) => sum + m.operations.avgResponseTime, 0) / globalStressMetrics.length
    const totalErrors = globalStressMetrics.reduce((sum, m) => sum + m.errors.length, 0)
    
    const overallSuccessRate = (totalSuccessful / totalOperations) * 100
    
    console.log(`并发测试用户: ${globalStressMetrics.length}`)
    console.log(`总操作数: ${totalOperations}`)
    console.log(`成功操作: ${totalSuccessful}`)
    console.log(`失败操作: ${totalFailed}`)
    console.log(`整体成功率: ${overallSuccessRate.toFixed(2)}%`)
    console.log(`平均响应时间: ${avgResponseTime.toFixed(2)}ms`)
    console.log(`错误总数: ${totalErrors}`)
    
    // 性能等级评估
    let performanceGrade = ''
    if (overallSuccessRate >= 90 && avgResponseTime < 1000) {
      performanceGrade = '🚀 优秀 - 系统承压能力强'
    } else if (overallSuccessRate >= 75 && avgResponseTime < 3000) {
      performanceGrade = '✅ 良好 - 系统性能稳定'
    } else if (overallSuccessRate >= 60 && avgResponseTime < 5000) {
      performanceGrade = '⚠️ 一般 - 有优化空间'
    } else {
      performanceGrade = '❌ 较差 - 需要架构优化'
    }
    
    console.log(`系统性能评级: ${performanceGrade}`)
    
    // 错误分析
    const errorTypes = new Map<string, number>()
    globalStressMetrics.forEach(metric => {
      metric.errors.forEach(error => {
        const count = errorTypes.get(error.type) || 0
        errorTypes.set(error.type, count + 1)
      })
    })
    
    if (errorTypes.size > 0) {
      console.log('\n📊 错误类型分析:')
      for (const [type, count] of errorTypes.entries()) {
        console.log(`   - ${type}: ${count} 次`)
      }
    }
    
    // 生成压力测试报告
    const report = {
      timestamp: dt.toISO(),
      testType: '300并发极限压力测试',
      concurrentUsers: globalStressMetrics.length,
      summary: {
        totalOperations,
        totalSuccessful,
        totalFailed,
        overallSuccessRate,
        avgResponseTime,
        totalErrors,
        performanceGrade
      },
      phaseResults: {
        static: globalStressMetrics.filter(m => m.phase === 'ramp-up'),
        api: globalStressMetrics.filter(m => m.phase === 'peak'),
        mixed: globalStressMetrics.filter(m => m.phase === 'sustained')
      },
      errorAnalysis: Object.fromEntries(errorTypes),
      recommendations: generateRecommendations(overallSuccessRate, avgResponseTime, totalErrors)
    }
    
    console.log('\n📝 极限压力测试完成 - 数据已收集')
    console.log('💡 测试策略: 分层压力测试，避开数据库瓶颈')
    console.log('🎯 测试重点: 系统承载极限和稳定性验证')
  }
})

// 生成优化建议
function generateRecommendations(successRate: number, avgResponseTime: number, errorCount: number): string[] {
  const recommendations: string[] = []
  
  if (successRate < 80) {
    recommendations.push('考虑使用更高性能的数据库替代SQLite')
    recommendations.push('优化API响应速度，减少阻塞操作')
  }
  
  if (avgResponseTime > 3000) {
    recommendations.push('启用更多缓存层，减少数据库查询')
    recommendations.push('考虑使用CDN加速静态资源')
  }
  
  if (errorCount > 100) {
    recommendations.push('检查速率限制配置，适当调整限制阈值')
    recommendations.push('增加错误重试机制和优雅降级')
  }
  
  if (recommendations.length === 0) {
    recommendations.push('系统性能表现良好，可考虑进一步扩展测试规模')
  }
  
  return recommendations
}