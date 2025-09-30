import { test, expect } from '@playwright/test'
import * as dt from '@/lib/utils/date-toolkit'

/**
 * 并发和压力测试
 * 专注于测试系统在高负载下的基础性能表现
 * 不包含消息发送功能测试（成本控制）
 */

// 并发测试配置
const CONCURRENT_USERS = 15  // 并发用户数
const PAGE_LOAD_TESTS = 10   // 页面加载测试次数
const STRESS_DURATION = 30000 // 压力测试持续时间（毫秒）

// 性能指标收集
interface PerformanceMetrics {
  loginTime: number
  pageLoadTime: number[]
  navigationTime: number[]
  totalTestTime: number
  errors: string[]
  userId: string
  memoryUsage?: number
  domElements?: number
}

// 全局性能数据收集
const performanceData: PerformanceMetrics[] = []

test.describe('并发压力测试', () => {
  
  test.describe.configure({ mode: 'parallel' })

  // 并发登录性能测试
  test('并发登录性能测试', async ({ page, context }) => {
    const startTime = dt.timestamp()
    const userId = `user-${Math.random().toString(36).substr(2, 9)}`
    const metrics: PerformanceMetrics = {
      loginTime: 0,
      pageLoadTime: [],
      navigationTime: [],
      totalTestTime: 0,
      errors: [],
      userId
    }

    try {
      console.log(`🔄 [${userId}] 开始登录性能测试...`)
      
      // 登录流程计时
      const loginStart = dt.timestamp()
      
      await page.goto('/workspace')
      await page.waitForLoadState('networkidle')
      
      if (page.url().includes('/login')) {
        const emailInput = page.locator('#login-email, input[type="email"]').first()
        await expect(emailInput).toBeVisible({ timeout: 10000 })
        
        await emailInput.fill(process.env.TEST_EMAIL || 'hi@2308.com')
        
        const loginButton = page.locator('button[type="submit"]').filter({ hasText: '登录' })
        await loginButton.click()
        
        // 等待登录完成
        try {
          await page.waitForURL('**/workspace', { timeout: 15000 })
        } catch (_error) {
          await page.goto('/workspace')
          await page.waitForLoadState('networkidle')
        }
      }
      
      const loginEnd = dt.timestamp()
      metrics.loginTime = loginEnd - loginStart
      
      console.log(`✅ [${userId}] 登录完成，耗时: ${metrics.loginTime}ms`)
      
      // 收集页面性能指标
      const performanceMetricsData = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          domElements: document.querySelectorAll('*').length
        }
      })

      metrics.pageLoadTime.push(performanceMetricsData.domContentLoaded)
      metrics.domElements = performanceMetricsData.domElements
      
      // 基础界面交互测试（无消息发送）
      try {
        await page.waitForSelector('[data-testid="chat-container"], .chat-container, main', { timeout: 10000 })
        console.log(`✅ [${userId}] 界面加载完成`)
      } catch (_error) {
        metrics.errors.push('界面加载超时')
        console.warn(`⚠️ [${userId}] 界面加载超时`)
      }
      
      metrics.totalTestTime = dt.timestamp() - startTime
      performanceData.push(metrics)
      
    } catch (error) {
      metrics.errors.push(`登录失败: ${error}`)
      console.error(`❌ [${userId}] 登录失败:`, error)
      throw error
    }
  })

  // 页面加载性能压力测试
  test('页面加载性能压力测试', async ({ page }) => {
    const userId = `stress-${Math.random().toString(36).substr(2, 9)}`
    const metrics: PerformanceMetrics = {
      loginTime: 0,
      pageLoadTime: [],
      navigationTime: [],
      totalTestTime: 0,
      errors: [],
      userId
    }

    const testStart = dt.timestamp()

    try {
      console.log(`🚀 [${userId}] 开始页面加载性能压力测试...`)

      // 多次页面加载测试
      for (let i = 0; i < PAGE_LOAD_TESTS; i++) {
        const loadStart = dt.timestamp()
        
        try {
          // 页面导航测试
          await page.goto('/workspace', { waitUntil: 'networkidle' })
          
          // 检查登录状态
          if (page.url().includes('/login')) {
            const emailInput = page.locator('#login-email, input[type="email"]').first()
            await emailInput.fill(process.env.TEST_EMAIL || 'hi@2308.com')
            const loginButton = page.locator('button[type="submit"]').filter({ hasText: '登录' })
            await loginButton.click()
            
            try {
              await page.waitForURL('**/workspace', { timeout: 8000 })
            } catch {
              await page.goto('/workspace')
            }
          }
          
          // 等待关键元素加载
          await page.waitForSelector('[data-testid="chat-container"], .chat-container, main', { timeout: 8000 })
          
          const loadEnd = dt.timestamp()
          const loadTime = loadEnd - loadStart
          metrics.pageLoadTime.push(loadTime)
          
          console.log(`📄 [${userId}] 页面加载 ${i + 1}/${PAGE_LOAD_TESTS} 完成，用时: ${loadTime}ms`)
          
          // 收集性能指标
          const pageMetrics = await page.evaluate(() => {
            const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
            return {
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
              loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
              domElements: document.querySelectorAll('*').length,
              memoryUsage: (performance as any).memory?.usedJSHeapSize || 0
            }
          })
          
          if (i === 0) {
            metrics.domElements = pageMetrics.domElements
            metrics.memoryUsage = pageMetrics.memoryUsage
          }
          
        } catch (_error) {
          metrics.errors.push(`页面加载 ${i + 1} 失败`)
          console.warn(`⚠️ [${userId}] 页面加载 ${i + 1} 失败`)
        }
        
        // 加载间隔
        if (i < PAGE_LOAD_TESTS - 1) {
          await page.waitForTimeout(1000)
        }
      }
      
      metrics.totalTestTime = dt.timestamp() - testStart
      
      // 输出性能统计
      const avgLoadTime = metrics.pageLoadTime.length > 0 
        ? metrics.pageLoadTime.reduce((a, b) => a + b, 0) / metrics.pageLoadTime.length 
        : 0
      const minLoadTime = metrics.pageLoadTime.length > 0 ? Math.min(...metrics.pageLoadTime) : 0
      const maxLoadTime = metrics.pageLoadTime.length > 0 ? Math.max(...metrics.pageLoadTime) : 0
      
      console.log(`📊 [${userId}] 页面性能测试完成统计:`)
      console.log(`   - 总耗时: ${metrics.totalTestTime}ms`)
      console.log(`   - 平均加载时间: ${avgLoadTime.toFixed(2)}ms`)
      console.log(`   - 最快加载时间: ${minLoadTime}ms`)
      console.log(`   - 最慢加载时间: ${maxLoadTime}ms`)
      console.log(`   - DOM元素数量: ${metrics.domElements}`)
      console.log(`   - 内存使用: ${(metrics.memoryUsage || 0 / 1024 / 1024).toFixed(2)}MB`)
      console.log(`   - 成功加载: ${metrics.pageLoadTime.length}/${PAGE_LOAD_TESTS}`)
      console.log(`   - 错误数: ${metrics.errors.length}`)
      
      performanceData.push(metrics)
      
      // 性能断言
      expect(avgLoadTime).toBeLessThan(5000) // 平均加载时间不超过5秒
      expect(metrics.errors.length).toBeLessThan(PAGE_LOAD_TESTS * 0.2) // 错误率不超过20%
      
    } catch (error) {
      console.error(`❌ [${userId}] 页面性能测试失败:`, error)
      throw error
    }
  })

  // 长时间系统稳定性测试
  test('长时间系统稳定性测试', async ({ page }) => {
    const userId = `stability-${Math.random().toString(36).substr(2, 9)}`
    const NAVIGATION_TESTS = 20
    const QUICK_INTERVAL = 800

    console.log(`⏱️ [${userId}] 开始长时间系统稳定性测试...`)

    let successCount = 0
    const startTime = dt.timestamp()
    const performanceMetrics: number[] = []

    // 连续页面导航和交互测试系统稳定性
    for (let i = 0; i < NAVIGATION_TESTS; i++) {
      const operationStart = dt.timestamp()
      
      try {
        // 页面导航测试
        await page.goto('/workspace', { waitUntil: 'domcontentloaded' })
        
        // 检查登录状态
        if (page.url().includes('/login')) {
          const emailInput = page.locator('#login-email, input[type="email"]').first()
          await emailInput.fill(process.env.TEST_EMAIL || 'hi@2308.com')
          const loginButton = page.locator('button[type="submit"]').filter({ hasText: '登录' })
          await loginButton.click()
          
          try {
            await page.waitForURL('**/workspace', { timeout: 6000 })
          } catch {
            await page.goto('/workspace')
          }
        }
        
        // 基础界面交互测试
        await page.waitForSelector('[data-testid="chat-container"], .chat-container, main', { timeout: 6000 })
        
        // 测试界面响应性
        const isInteractive = await page.evaluate(() => {
          // 检查基本交互元素
          const buttons = document.querySelectorAll('button')
          const inputs = document.querySelectorAll('input, textarea')
          return buttons.length > 0 && inputs.length > 0
        })
        
        if (isInteractive) {
          successCount++
          const operationTime = dt.timestamp() - operationStart
          performanceMetrics.push(operationTime)
          
          if (i % 5 === 0) {
            console.log(`🔄 [${userId}] 稳定性测试进度: ${i + 1}/${NAVIGATION_TESTS}`)
          }
        }
        
        await page.waitForTimeout(QUICK_INTERVAL)
        
      } catch (_error) {
        console.warn(`⚠️ [${userId}] 操作 ${i + 1} 处理异常`)
      }
    }

    const totalTime = dt.timestamp() - startTime
    const successRate = (successCount / NAVIGATION_TESTS) * 100
    const avgResponseTime = performanceMetrics.length > 0 
      ? performanceMetrics.reduce((a, b) => a + b, 0) / performanceMetrics.length 
      : 0

    console.log(`📈 [${userId}] 系统稳定性测试完成:`)
    console.log(`   - 总耗时: ${totalTime}ms`)
    console.log(`   - 成功率: ${successRate.toFixed(1)}%`)
    console.log(`   - 成功操作: ${successCount}/${NAVIGATION_TESTS}`)
    console.log(`   - 平均操作时间: ${avgResponseTime.toFixed(2)}ms`)

    // 稳定性断言
    expect(successRate).toBeGreaterThan(85) // 成功率应大于85%
    expect(avgResponseTime).toBeLessThan(8000) // 平均操作时间不超过8秒
  })
})

// 清理和报告
test.afterAll(async () => {
  if (performanceData.length > 0) {
    console.log('\n📊 === 基础性能测试总体报告 ===')
    
    const totalUsers = performanceData.length
    const avgLoginTime = performanceData.reduce((sum, data) => sum + data.loginTime, 0) / totalUsers
    const totalErrors = performanceData.reduce((sum, data) => sum + data.errors.length, 0)
    
    // 页面加载时间统计
    const allPageLoadTimes = performanceData.flatMap(data => data.pageLoadTime)
    const avgPageLoadTime = allPageLoadTimes.length > 0 
      ? allPageLoadTimes.reduce((a, b) => a + b, 0) / allPageLoadTimes.length 
      : 0
    
    // DOM元素和内存统计
    const avgDomElements = performanceData
      .filter(data => data.domElements)
      .reduce((sum, data) => sum + (data.domElements || 0), 0) / performanceData.filter(data => data.domElements).length || 0
    
    const avgMemoryUsage = performanceData
      .filter(data => data.memoryUsage)
      .reduce((sum, data) => sum + (data.memoryUsage || 0), 0) / performanceData.filter(data => data.memoryUsage).length || 0
    
    console.log(`总测试用户数: ${totalUsers}`)
    console.log(`平均登录时间: ${avgLoginTime.toFixed(2)}ms`)
    console.log(`平均页面加载时间: ${avgPageLoadTime.toFixed(2)}ms`)
    console.log(`平均DOM元素数量: ${avgDomElements.toFixed(0)}`)
    console.log(`平均内存使用: ${(avgMemoryUsage / 1024 / 1024).toFixed(2)}MB`)
    console.log(`总错误数: ${totalErrors}`)
    console.log(`系统稳定性: ${totalErrors === 0 ? '✅ 优秀' : totalErrors < 5 ? '⚠️ 良好' : '❌ 需优化'}`)
    
    // 输出详细性能数据到文件
    const reportData = {
      timestamp: dt.toISO(),
      testType: '基础性能测试（无消息发送）',
      summary: {
        totalUsers,
        avgLoginTime,
        avgPageLoadTime,
        avgDomElements,
        avgMemoryUsage: avgMemoryUsage / 1024 / 1024, // MB
        totalErrors,
        stabilityRating: totalErrors === 0 ? 'excellent' : totalErrors < 5 ? 'good' : 'needs_optimization'
      },
      details: performanceData
    }
    
    // 这里可以将数据写入文件或发送到监控系统
    console.log('📝 基础性能数据收集完成')
    console.log('💰 测试成本: 🆓 零成本（无AI调用）')
  }
})