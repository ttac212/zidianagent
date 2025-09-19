import { test, expect } from '@playwright/test'

/**
 * 纯性能测试套件
 * 专注于基础性能指标，无AI调用成本
 * 适合频繁运行和CI/CD集成
 */

// 性能测试配置
const LOAD_TESTS = 8           // 页面加载测试次数
const STRESS_NAVIGATION = 15   // 导航压力测试次数
const MEMORY_CHECK_INTERVAL = 5 // 内存检查间隔

// 性能指标接口
interface SystemMetrics {
  loadTime: number
  domElements: number
  memoryUsage: number
  navigationTiming: {
    domContentLoaded: number
    loadComplete: number
    firstPaint: number
  }
  interactivity: boolean
  errors: string[]
}

const globalMetrics: SystemMetrics[] = []

test.describe('纯性能测试套件', () => {
  
  test.describe.configure({ mode: 'parallel' })

  // 基础页面加载性能
  test('页面加载性能基准测试', async ({ page }) => {
    const testId = `load-${Math.random().toString(36).substr(2, 6)}`
    console.log(`🚀 [${testId}] 开始页面加载性能基准测试...`)

    const metrics: SystemMetrics = {
      loadTime: 0,
      domElements: 0,
      memoryUsage: 0,
      navigationTiming: { domContentLoaded: 0, loadComplete: 0, firstPaint: 0 },
      interactivity: false,
      errors: []
    }

    try {
      const startTime = Date.now()

      // 页面加载
      await page.goto('/workspace', { waitUntil: 'networkidle' })

      // 处理登录（如果需要）
      if (page.url().includes('/login')) {
        const emailInput = page.locator('#login-email, input[type="email"]').first()
        await emailInput.fill(process.env.TEST_EMAIL || 'hi@2308.com')
        
        // 等待登录按钮启用
        const loginButton = page.locator('button[type="submit"]').filter({ hasText: '登录' })
        await loginButton.waitFor({ state: 'visible', timeout: 5000 })
        
        // 等待按钮启用并点击
        await page.waitForFunction(() => {
          const button = document.querySelector('button[type="submit"]')
          return button && !button.disabled
        }, { timeout: 8000 })
        
        await loginButton.click()
        
        try {
          await page.waitForURL('**/workspace', { timeout: 10000 })
        } catch {
          await page.goto('/workspace')
        }
      }

      // 等待关键元素 - 使用更宽泛的选择器
      try {
        await page.waitForSelector('main, [role="main"], body', { timeout: 8000 })
      } catch {
        // 如果找不到主要元素，至少确保页面加载完成
        await page.waitForLoadState('domcontentloaded')
      }
      
      const loadTime = Date.now() - startTime
      metrics.loadTime = loadTime

      // 收集详细性能数据
      const performanceData = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          domElements: document.querySelectorAll('*').length,
          memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
          interactive: document.readyState === 'complete'
        }
      })

      metrics.navigationTiming = {
        domContentLoaded: performanceData.domContentLoaded,
        loadComplete: performanceData.loadComplete,
        firstPaint: performanceData.firstPaint
      }
      metrics.domElements = performanceData.domElements
      metrics.memoryUsage = performanceData.memoryUsage
      metrics.interactivity = performanceData.interactive

      console.log(`✅ [${testId}] 页面加载完成:`)
      console.log(`   - 总加载时间: ${loadTime}ms`)
      console.log(`   - DOM内容加载: ${performanceData.domContentLoaded}ms`)
      console.log(`   - 首次绘制: ${performanceData.firstPaint}ms`)
      console.log(`   - DOM元素: ${performanceData.domElements}`)
      console.log(`   - 内存使用: ${(performanceData.memoryUsage / 1024 / 1024).toFixed(2)}MB`)

      globalMetrics.push(metrics)

      // 性能断言
      expect(loadTime).toBeLessThan(8000) // 总加载时间不超过8秒
      expect(performanceData.domElements).toBeGreaterThan(0) // 页面有内容
      expect(performanceData.interactive).toBe(true) // 页面可交互

    } catch (error) {
      metrics.errors.push(`加载失败: ${error}`)
      console.error(`❌ [${testId}] 测试失败:`, error)
      throw error
    }
  })

  // 内存和资源使用监控
  test('内存和资源使用监控', async ({ page }) => {
    const testId = `memory-${Math.random().toString(36).substr(2, 6)}`
    console.log(`🧠 [${testId}] 开始内存和资源使用监控...`)

    const memorySnapshots: number[] = []
    const loadTimes: number[] = []

    try {
      // 多次加载页面监控内存使用
      for (let i = 0; i < MEMORY_CHECK_INTERVAL; i++) {
        const startTime = Date.now()
        
        await page.goto('/workspace', { waitUntil: 'domcontentloaded' })
        
        // 处理登录
        if (page.url().includes('/login')) {
          const emailInput = page.locator('#login-email, input[type="email"]').first()
          await emailInput.fill(process.env.TEST_EMAIL || 'hi@2308.com')
          
          const loginButton = page.locator('button[type="submit"]').filter({ hasText: '登录' })
          
          // 等待按钮启用
          await page.waitForFunction(() => {
            const button = document.querySelector('button[type="submit"]')
            return button && !button.disabled
          }, { timeout: 6000 })
          
          await loginButton.click()
          
          try {
            await page.waitForURL('**/workspace', { timeout: 8000 })
          } catch {
            await page.goto('/workspace')
          }
        }

        try {
          await page.waitForSelector('main, [role="main"], body', { timeout: 6000 })
        } catch {
          await page.waitForLoadState('domcontentloaded')
        }
        
        const loadTime = Date.now() - startTime
        loadTimes.push(loadTime)

        // 收集内存数据
        const memoryInfo = await page.evaluate(() => {
          const memory = (performance as any).memory
          return {
            usedJSHeapSize: memory?.usedJSHeapSize || 0,
            totalJSHeapSize: memory?.totalJSHeapSize || 0,
            jsHeapSizeLimit: memory?.jsHeapSizeLimit || 0
          }
        })

        memorySnapshots.push(memoryInfo.usedJSHeapSize)
        
        console.log(`🔄 [${testId}] 第${i + 1}次加载: ${loadTime}ms, 内存: ${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`)
        
        await page.waitForTimeout(1000)
      }

      // 分析内存趋势
      const avgMemory = memorySnapshots.reduce((a, b) => a + b, 0) / memorySnapshots.length
      const maxMemory = Math.max(...memorySnapshots)
      const minMemory = Math.min(...memorySnapshots)
      const memoryGrowth = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0]

      const avgLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length

      console.log(`📊 [${testId}] 内存分析完成:`)
      console.log(`   - 平均内存使用: ${(avgMemory / 1024 / 1024).toFixed(2)}MB`)
      console.log(`   - 最大内存使用: ${(maxMemory / 1024 / 1024).toFixed(2)}MB`)
      console.log(`   - 最小内存使用: ${(minMemory / 1024 / 1024).toFixed(2)}MB`)
      console.log(`   - 内存增长: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`)
      console.log(`   - 平均加载时间: ${avgLoadTime.toFixed(2)}ms`)

      // 内存使用断言
      expect(avgMemory).toBeLessThan(100 * 1024 * 1024) // 平均内存使用不超过100MB
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024) // 内存增长不超过50MB
      expect(avgLoadTime).toBeLessThan(6000) // 平均加载时间不超过6秒

    } catch (error) {
      console.error(`❌ [${testId}] 内存监控失败:`, error)
      throw error
    }
  })

  // 导航压力测试
  test('导航压力测试', async ({ page }) => {
    const testId = `nav-${Math.random().toString(36).substr(2, 6)}`
    console.log(`🔀 [${testId}] 开始导航压力测试...`)

    const navigationTimes: number[] = []
    let successCount = 0

    try {
      // 快速连续导航测试
      for (let i = 0; i < STRESS_NAVIGATION; i++) {
        const startTime = Date.now()
        
        try {
          await page.goto('/workspace', { waitUntil: 'domcontentloaded' })
          
          // 检查登录状态
          if (page.url().includes('/login')) {
            const emailInput = page.locator('#login-email, input[type="email"]').first()
            await emailInput.fill(process.env.TEST_EMAIL || 'hi@2308.com')
            
            const loginButton = page.locator('button[type="submit"]').filter({ hasText: '登录' })
            
            // 等待按钮启用
            await page.waitForFunction(() => {
              const button = document.querySelector('button[type="submit"]')
              return button && !button.disabled
            }, { timeout: 4000 })
            
            await loginButton.click()
            
            try {
              await page.waitForURL('**/workspace', { timeout: 5000 })
            } catch {
              await page.goto('/workspace')
            }
          }

          try {
            await page.waitForSelector('main, [role="main"], body', { timeout: 4000 })
          } catch {
            await page.waitForLoadState('domcontentloaded')
          }
          
          const navTime = Date.now() - startTime
          navigationTimes.push(navTime)
          successCount++
          
          if (i % 3 === 0) {
            console.log(`🔄 [${testId}] 导航进度: ${i + 1}/${STRESS_NAVIGATION}`)
          }
          
        } catch (error) {
          console.warn(`⚠️ [${testId}] 导航 ${i + 1} 失败`)
        }
        
        await page.waitForTimeout(200) // 短间隔
      }

      const successRate = (successCount / STRESS_NAVIGATION) * 100
      const avgNavTime = navigationTimes.length > 0 
        ? navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length 
        : 0
      const minNavTime = navigationTimes.length > 0 ? Math.min(...navigationTimes) : 0
      const maxNavTime = navigationTimes.length > 0 ? Math.max(...navigationTimes) : 0

      console.log(`📈 [${testId}] 导航压力测试完成:`)
      console.log(`   - 成功率: ${successRate.toFixed(1)}%`)
      console.log(`   - 成功导航: ${successCount}/${STRESS_NAVIGATION}`)
      console.log(`   - 平均导航时间: ${avgNavTime.toFixed(2)}ms`)
      console.log(`   - 最快导航: ${minNavTime}ms`)
      console.log(`   - 最慢导航: ${maxNavTime}ms`)

      // 压力测试断言
      expect(successRate).toBeGreaterThan(90) // 成功率应大于90%
      expect(avgNavTime).toBeLessThan(5000) // 平均导航时间不超过5秒

    } catch (error) {
      console.error(`❌ [${testId}] 导航压力测试失败:`, error)
      throw error
    }
  })
})

// 测试完成报告
test.afterAll(async () => {
  if (globalMetrics.length > 0) {
    console.log('\n📊 === 纯性能测试总体报告 ===')
    
    const avgLoadTime = globalMetrics.reduce((sum, metric) => sum + metric.loadTime, 0) / globalMetrics.length
    const avgDomElements = globalMetrics.reduce((sum, metric) => sum + metric.domElements, 0) / globalMetrics.length
    const avgMemoryUsage = globalMetrics.reduce((sum, metric) => sum + metric.memoryUsage, 0) / globalMetrics.length
    const totalErrors = globalMetrics.reduce((sum, metric) => sum + metric.errors.length, 0)
    
    const avgDomContentLoaded = globalMetrics.reduce((sum, metric) => sum + metric.navigationTiming.domContentLoaded, 0) / globalMetrics.length
    const avgFirstPaint = globalMetrics.reduce((sum, metric) => sum + metric.navigationTiming.firstPaint, 0) / globalMetrics.length

    console.log(`测试用例数: ${globalMetrics.length}`)
    console.log(`平均加载时间: ${avgLoadTime.toFixed(2)}ms`)
    console.log(`平均DOM内容加载: ${avgDomContentLoaded.toFixed(2)}ms`)
    console.log(`平均首次绘制: ${avgFirstPaint.toFixed(2)}ms`)
    console.log(`平均DOM元素: ${avgDomElements.toFixed(0)}`)
    console.log(`平均内存使用: ${(avgMemoryUsage / 1024 / 1024).toFixed(2)}MB`)
    console.log(`错误总数: ${totalErrors}`)
    console.log(`系统评级: ${avgLoadTime < 3000 ? '🚀 极快' : avgLoadTime < 5000 ? '✅ 良好' : '⚠️ 需优化'}`)
    
    // 性能报告数据
    const report = {
      timestamp: new Date().toISOString(),
      testType: '纯性能测试（零成本）',
      summary: {
        testCases: globalMetrics.length,
        avgLoadTime,
        avgDomContentLoaded,
        avgFirstPaint,
        avgDomElements,
        avgMemoryUsage: avgMemoryUsage / 1024 / 1024,
        totalErrors,
        performanceRating: avgLoadTime < 3000 ? 'excellent' : avgLoadTime < 5000 ? 'good' : 'needs_optimization'
      },
      details: globalMetrics
    }
    
    console.log('📝 纯性能测试数据收集完成')
    console.log('💰 测试成本: 🆓 完全免费')
    console.log('🔄 建议: 可频繁运行，适合CI/CD集成')
  }
})