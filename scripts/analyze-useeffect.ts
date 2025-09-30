#!/usr/bin/env tsx

/**
 * useEffect 滥用分析工具
 *
 * 根据 Linus 原则：识别并消除特殊情况
 * 将不必要的副作用变成常规的计算或事件处理
 */

import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'

interface UseEffectPattern {
  file: string
  line: number
  code: string
  dependencies: string
  category: 'necessary' | 'optimization-needed' | 'can-be-removed'
  suggestion?: string
}

class UseEffectAnalyzer {
  private patterns: UseEffectPattern[] = []
  private stats = {
    total: 0,
    necessary: 0,
    optimizationNeeded: 0,
    canBeRemoved: 0,
    byCategory: new Map<string, number>()
  }

  async analyze() {
    console.log('🔍 分析 useEffect 使用情况...\n')

    // 查找所有包含 useEffect 的文件
    const files = await glob('**/*.{ts,tsx}', {
      ignore: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '.next/**',
        'tests/**',
        'scripts/**'
      ]
    })

    for (const file of files) {
      await this.analyzeFile(file)
    }

    this.generateReport()
  }

  private async analyzeFile(filePath: string) {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    // 查找所有 useEffect 调用
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('useEffect')) {
        const pattern = await this.analyzeUseEffect(lines, i, filePath)
        if (pattern) {
          this.patterns.push(pattern)
          this.stats.total++
        }
      }
    }
  }

  private async analyzeUseEffect(
    lines: string[],
    startLine: number,
    filePath: string
  ): Promise<UseEffectPattern | null> {
    // 提取 useEffect 代码块
    let code = ''
    let bracketCount = 0
    let inEffect = false
    let endLine = startLine

    for (let i = startLine; i < Math.min(startLine + 50, lines.length); i++) {
      const line = lines[i]
      code += line + '\n'

      if (line.includes('useEffect(') || line.includes('useEffect (')) {
        inEffect = true
      }

      if (inEffect) {
        bracketCount += (line.match(/\(/g) || []).length
        bracketCount -= (line.match(/\)/g) || []).length

        if (bracketCount === 0) {
          endLine = i
          break
        }
      }
    }

    // 提取依赖数组 - 使用ES2017兼容的正则
    const depMatch = code.match(/\],?\s*\[([^\]]*)\]/)
    const dependencies = depMatch ? depMatch[1].trim() : 'no-deps'

    // 分类 useEffect
    const category = this.categorizeUseEffect(code, dependencies, filePath)

    return {
      file: filePath,
      line: startLine + 1,
      code: code.trim(),
      dependencies,
      category: category.type,
      suggestion: category.suggestion
    }
  }

  private categorizeUseEffect(
    code: string,
    dependencies: string,
    filePath: string
  ): { type: 'necessary' | 'optimization-needed' | 'can-be-removed'; suggestion?: string } {
    // 1. 空依赖数组 - 初始化效果（通常必要）
    if (dependencies === '') {
      if (code.includes('addEventListener') || code.includes('fetch') || code.includes('prisma')) {
        return { type: 'necessary', suggestion: '初始化监听器或数据获取，保留' }
      }
      if (code.includes('console.') || code.includes('// ')) {
        return { type: 'can-be-removed', suggestion: '仅用于日志或注释，可删除' }
      }
    }

    // 2. 仅用于设置状态 - 可以优化
    if (code.includes('setState') && !code.includes('fetch') && !code.includes('await')) {
      return {
        type: 'optimization-needed',
        suggestion: '考虑使用派生状态或在事件处理器中设置状态'
      }
    }

    // 3. 同步外部数据 - 通常必要
    if (code.includes('localStorage') || code.includes('sessionStorage')) {
      return { type: 'necessary', suggestion: '同步外部存储，保留' }
    }

    // 4. DOM 操作
    if (code.includes('document.') || code.includes('window.') || code.includes('ref.current')) {
      if (code.includes('addEventListener')) {
        return { type: 'necessary', suggestion: 'DOM 事件监听，保留但确保清理' }
      }
      if (code.includes('focus') || code.includes('scroll')) {
        return { type: 'optimization-needed', suggestion: '考虑使用 ref callbacks 或事件处理' }
      }
    }

    // 5. 定时器
    if (code.includes('setTimeout') || code.includes('setInterval')) {
      return { type: 'necessary', suggestion: '定时器需要副作用，但确保清理' }
    }

    // 6. 无依赖数组 - 每次渲染都执行（通常是问题）
    if (dependencies === 'no-deps') {
      return {
        type: 'optimization-needed',
        suggestion: '缺少依赖数组，每次渲染都执行，需要修复'
      }
    }

    // 7. 依赖过多 - 可能需要优化
    const depCount = dependencies.split(',').filter(d => d.trim()).length
    if (depCount > 3) {
      return {
        type: 'optimization-needed',
        suggestion: `依赖项过多(${depCount}个)，考虑拆分或使用 useCallback/useMemo`
      }
    }

    // 8. 特定文件类型的模式
    if (filePath.includes('hook')) {
      return { type: 'necessary', suggestion: '自定义 Hook 中的 effect，通常合理' }
    }

    // 默认认为需要优化
    return { type: 'optimization-needed', suggestion: '需要进一步审查' }
  }

  private generateReport() {
    // 统计
    this.patterns.forEach(p => {
      if (p.category === 'necessary') this.stats.necessary++
      else if (p.category === 'optimization-needed') this.stats.optimizationNeeded++
      else if (p.category === 'can-be-removed') this.stats.canBeRemoved++

      // 按文件分类统计
      const category = path.dirname(p.file).split(path.sep)[0]
      this.stats.byCategory.set(
        category,
        (this.stats.byCategory.get(category) || 0) + 1
      )
    })

    console.log('📊 useEffect 使用统计:\n')
    console.log(`总计: ${this.stats.total} 处`)
    console.log(`✅ 必要的: ${this.stats.necessary} 处`)
    console.log(`⚠️  需要优化: ${this.stats.optimizationNeeded} 处`)
    console.log(`❌ 可以删除: ${this.stats.canBeRemoved} 处`)

    console.log('\n📁 按目录分布:')
    for (const [category, count] of this.stats.byCategory) {
      console.log(`  ${category}: ${count} 处`)
    }

    // 需要优化的列表
    console.log('\n⚠️  需要优化的 useEffect:')
    const needsOptimization = this.patterns
      .filter(p => p.category === 'optimization-needed')
      .slice(0, 10) // 只显示前10个

    needsOptimization.forEach(p => {
      console.log(`\n📍 ${p.file}:${p.line}`)
      console.log(`   建议: ${p.suggestion}`)
      console.log(`   依赖: [${p.dependencies}]`)
    })

    // 可以删除的列表
    const canBeRemoved = this.patterns.filter(p => p.category === 'can-be-removed')
    if (canBeRemoved.length > 0) {
      console.log('\n❌ 可以删除的 useEffect:')
      canBeRemoved.forEach(p => {
        console.log(`  ${p.file}:${p.line} - ${p.suggestion}`)
      })
    }

    // 生成优化方案
    this.generateOptimizationPlan()
  }

  private generateOptimizationPlan() {
    console.log('\n' + '='.repeat(60))
    console.log('🎯 优化方案:\n')

    console.log('## 1. 立即删除不必要的 useEffect')
    console.log('   - 仅用于日志的 effect')
    console.log('   - 空的或注释掉的 effect')

    console.log('\n## 2. 优化状态更新模式')
    console.log('   - 将派生状态从 useEffect 移到组件主体')
    console.log('   - 使用事件处理器而不是 effect 响应用户操作')
    console.log('   - 考虑使用 useReducer 管理复杂状态')

    console.log('\n## 3. 优化依赖项')
    console.log('   - 添加缺失的依赖数组')
    console.log('   - 使用 useCallback 稳定函数引用')
    console.log('   - 使用 useMemo 稳定对象引用')

    console.log('\n## 4. 创建专用 Hook')
    console.log('   - useEventListener - 事件监听')
    console.log('   - useAsyncEffect - 异步操作')
    console.log('   - useDebounceEffect - 防抖副作用')
    console.log('   - usePrevious - 跟踪前值')

    console.log('\n## 5. 重构建议')
    console.log('   - 将数据获取移到 React Query 或 SWR')
    console.log('   - 使用 Suspense 处理加载状态')
    console.log('   - 考虑服务端渲染减少客户端 effect')
  }
}

// 执行分析
const analyzer = new UseEffectAnalyzer()
analyzer.analyze().catch(console.error)