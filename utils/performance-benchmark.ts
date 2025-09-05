/**
 * 性能基准测试工具
 * 用于对比重构前后的性能差异
 */

interface BenchmarkResult {
  name: string
  duration: number
  memory?: number
  iterations: number
  averageTime: number
}

interface BenchmarkConfig {
  iterations: number
  warmupRuns: number
  measureMemory: boolean
}

const DEFAULT_CONFIG: BenchmarkConfig = {
  iterations: 100,
  warmupRuns: 10,
  measureMemory: true
}

/**
 * 性能基准测试类
 */
export class PerformanceBenchmark {
  private results: BenchmarkResult[] = []

  /**
   * 运行基准测试
   */
  async run(
    name: string,
    testFunction: () => void | Promise<void>,
    config: Partial<BenchmarkConfig> = {}
  ): Promise<BenchmarkResult> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config }
    
    // 预热运行
    for (let i = 0; i < finalConfig.warmupRuns; i++) {
      await testFunction()
    }

    // 清理垃圾回收
    if ('gc' in window) {
      (window as any).gc()
    }

    const startMemory = this.getMemoryUsage()
    const startTime = performance.now()

    // 执行测试
    for (let i = 0; i < finalConfig.iterations; i++) {
      await testFunction()
    }

    const endTime = performance.now()
    const endMemory = this.getMemoryUsage()

    const duration = endTime - startTime
    const averageTime = duration / finalConfig.iterations
    const memoryDiff = finalConfig.measureMemory && startMemory && endMemory 
      ? endMemory - startMemory 
      : undefined

    const result: BenchmarkResult = {
      name,
      duration,
      memory: memoryDiff,
      iterations: finalConfig.iterations,
      averageTime
    }

    this.results.push(result)
    return result
  }

  /**
   * 获取内存使用情况
   */
  private getMemoryUsage(): number | undefined {
    if ('memory' in performance) {
      return (performance as any).memory?.usedJSHeapSize
    }
    return undefined
  }

  /**
   * 对比两个测试结果
   */
  compare(baseline: string, comparison: string): {
    timeImprovement: number
    memoryImprovement?: number
    summary: string
  } {
    const baselineResult = this.results.find(r => r.name === baseline)
    const comparisonResult = this.results.find(r => r.name === comparison)

    if (!baselineResult || !comparisonResult) {
      throw new Error('测试结果不存在')
    }

    const timeImprovement = (baselineResult.averageTime - comparisonResult.averageTime) / baselineResult.averageTime * 100
    
    let memoryImprovement: number | undefined
    if (baselineResult.memory && comparisonResult.memory) {
      memoryImprovement = (baselineResult.memory - comparisonResult.memory) / baselineResult.memory * 100
    }

    const summary = `
性能对比报告：
- 基准测试: ${baseline}
  - 平均时间: ${baselineResult.averageTime.toFixed(2)}ms
  - 内存使用: ${baselineResult.memory ? `${(baselineResult.memory / 1024 / 1024).toFixed(2)}MB` : '未测量'}

- 对比测试: ${comparison}
  - 平均时间: ${comparisonResult.averageTime.toFixed(2)}ms
  - 内存使用: ${comparisonResult.memory ? `${(comparisonResult.memory / 1024 / 1024).toFixed(2)}MB` : '未测量'}

- 性能提升:
  - 时间: ${timeImprovement > 0 ? '+' : ''}${timeImprovement.toFixed(2)}%
  - 内存: ${memoryImprovement !== undefined ? `${memoryImprovement > 0 ? '+' : ''}${memoryImprovement.toFixed(2)}%` : '未测量'}
    `

    return {
      timeImprovement,
      memoryImprovement,
      summary
    }
  }

  /**
   * 获取所有测试结果
   */
  getResults(): BenchmarkResult[] {
    return [...this.results]
  }

  /**
   * 清空测试结果
   */
  clear(): void {
    this.results = []
  }

  /**
   * 生成性能报告
   */
  generateReport(): string {
    if (this.results.length === 0) {
      return '没有测试结果'
    }

    let report = '性能基准测试报告\n'
    report += '='.repeat(50) + '\n\n'

    this.results.forEach(result => {
      report += `测试名称: ${result.name}\n`
      report += `总时间: ${result.duration.toFixed(2)}ms\n`
      report += `迭代次数: ${result.iterations}\n`
      report += `平均时间: ${result.averageTime.toFixed(2)}ms\n`
      if (result.memory) {
        report += `内存变化: ${(result.memory / 1024 / 1024).toFixed(2)}MB\n`
      }
      report += '-'.repeat(30) + '\n'
    })

    return report
  }
}

/**
 * 聊天组件专用基准测试
 */
export class ChatPerformanceBenchmark extends PerformanceBenchmark {
  /**
   * 测试消息渲染性能
   */
  async testMessageRendering(messageCount: number): Promise<BenchmarkResult> {
    const messages = this.generateMockMessages(messageCount)
    
    return this.run(`消息渲染-${messageCount}条`, () => {
      // 模拟消息渲染
      const container = document.createElement('div')
      messages.forEach(msg => {
        const element = document.createElement('div')
        element.textContent = msg.content
        container.appendChild(element)
      })
      container.remove()
    })
  }

  /**
   * 测试状态更新性能
   */
  async testStateUpdates(updateCount: number): Promise<BenchmarkResult> {
    return this.run(`状态更新-${updateCount}次`, () => {
      // 模拟状态更新
      const state = { messages: [], input: '', isLoading: false }
      for (let i = 0; i < updateCount; i++) {
        state.input = `测试输入 ${i}`
        state.isLoading = i % 2 === 0
      }
    })
  }

  /**
   * 测试滚动性能
   */
  async testScrollPerformance(): Promise<BenchmarkResult> {
    return this.run('滚动性能', () => {
      const container = document.createElement('div')
      container.style.height = '400px'
      container.style.overflow = 'auto'
      
      // 添加大量内容
      for (let i = 0; i < 1000; i++) {
        const element = document.createElement('div')
        element.textContent = `消息 ${i}`
        container.appendChild(element)
      }
      
      // 模拟滚动
      container.scrollTop = container.scrollHeight
      container.remove()
    })
  }

  /**
   * 生成模拟消息
   */
  private generateMockMessages(count: number) {
    const messages = []
    for (let i = 0; i < count; i++) {
      messages.push({
        id: i.toString(),
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `这是第 ${i + 1} 条测试消息，用于性能基准测试。`.repeat(Math.floor(Math.random() * 5) + 1),
        timestamp: Date.now() - (count - i) * 1000
      })
    }
    return messages
  }
}

/**
 * 运行完整的性能测试套件
 */
export async function runPerformanceTestSuite(): Promise<void> {
  const benchmark = new ChatPerformanceBenchmark()
  
  // 测试不同消息数量的渲染性能
  await benchmark.testMessageRendering(10)
  await benchmark.testMessageRendering(50)
  await benchmark.testMessageRendering(100)
  await benchmark.testMessageRendering(500)
  
  // 测试状态更新性能
  await benchmark.testStateUpdates(100)
  await benchmark.testStateUpdates(500)
  await benchmark.testStateUpdates(1000)
  
  // 测试滚动性能
  await benchmark.testScrollPerformance()
  
  // 生成报告
  benchmark.generateReport()
  
  // 对比分析
  try {
    const comparison = benchmark.compare('消息渲染-10条', '消息渲染-100条')
    console.log('性能对比:', comparison)
  } catch (error) {
    console.error('性能对比分析失败:', error)
  }
}

// 导出单例实例
export const chatBenchmark = new ChatPerformanceBenchmark()
