#!/usr/bin/env tsx

/**
 * useEffect 自动优化脚本
 *
 * 遵循 Linus 原则：自动修复常见的 useEffect 问题
 * 专注于修复缺少依赖数组的情况
 */

import fs from 'fs/promises'
import { glob } from 'glob'

interface FixResult {
  file: string
  fixesApplied: string[]
  beforeCode: string
  afterCode: string
}

class UseEffectOptimizer {
  private results: FixResult[] = []
  private stats = {
    filesProcessed: 0,
    filesModified: 0,
    fixesApplied: 0
  }

  async optimize() {
    console.log('🔧 开始自动优化 useEffect...\n')

    const files = await glob('**/*.{ts,tsx}', {
      ignore: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '.next/**',
        'tests/**',
        'scripts/**',
        'hooks/use-effect-helpers.ts' // 跳过我们的工具文件
      ]
    })

    for (const file of files) {
      await this.optimizeFile(file)
    }

    this.generateReport()
  }

  private async optimizeFile(filePath: string) {
    this.stats.filesProcessed++

    const content = await fs.readFile(filePath, 'utf-8')
    let modifiedContent = content
    const fixesApplied: string[] = []

    // 1. 修复缺少依赖数组的 useEffect
    const fixedDeps = this.fixMissingDependencies(modifiedContent)
    if (fixedDeps.modified) {
      modifiedContent = fixedDeps.content
      fixesApplied.push(...fixedDeps.fixes)
    }

    // 2. 修复空依赖但有外部依赖的情况
    const fixedEmpty = this.fixEmptyDepsWithExternalRefs(modifiedContent)
    if (fixedEmpty.modified) {
      modifiedContent = fixedEmpty.content
      fixesApplied.push(...fixedEmpty.fixes)
    }

    // 如果有修改，保存文件
    if (modifiedContent !== content) {
      await fs.writeFile(filePath, modifiedContent)
      this.stats.filesModified++
      this.stats.fixesApplied += fixesApplied.length

      this.results.push({
        file: filePath,
        fixesApplied,
        beforeCode: content.substring(0, 200),
        afterCode: modifiedContent.substring(0, 200)
      })

      console.log(`✅ ${filePath}`)
      fixesApplied.forEach(fix => console.log(`   - ${fix}`))
    }
  }

  private fixMissingDependencies(content: string): {
    content: string
    modified: boolean
    fixes: string[]
  } {
    const fixes: string[] = []
    let modified = false
    let result = content

    // 匹配 useEffect(() => { ... }) 没有依赖数组的情况
    // 注意：这是简化版本，只处理最常见的模式
    const pattern = /useEffect\(\(\) => \{[^}]*\}\)/g

    const matches = [...content.matchAll(pattern)]

    for (const match of matches) {
      const effectCode = match[0]

      // 如果effect内部没有使用任何外部变量，添加空依赖数组
      // 这是一个简化的检测，实际应该用AST
      if (!effectCode.includes('const') && !effectCode.includes('let')) {
        const fixedCode = effectCode + ', []'
        result = result.replace(effectCode, fixedCode)
        fixes.push('添加空依赖数组')
        modified = true
      }
    }

    return { content: result, modified, fixes }
  }

  private fixEmptyDepsWithExternalRefs(content: string): {
    content: string
    modified: boolean
    fixes: string[]
  } {
    // 这个比较复杂，暂时返回未修改
    // 需要AST分析才能准确识别外部依赖
    return { content, modified: false, fixes: [] }
  }

  private generateReport() {
    console.log('\n' + '='.repeat(60))
    console.log('📊 优化结果:\n')
    console.log(`处理文件数: ${this.stats.filesProcessed}`)
    console.log(`修改文件数: ${this.stats.filesModified}`)
    console.log(`应用修复数: ${this.stats.fixesApplied}`)

    if (this.results.length > 0) {
      console.log('\n✅ 已修复的文件:')
      this.results.slice(0, 10).forEach(result => {
        console.log(`\n📁 ${result.file}`)
        result.fixesApplied.forEach(fix => {
          console.log(`   ✓ ${fix}`)
        })
      })
    }

    console.log('\n💡 建议:')
    console.log('1. 运行测试确保修改没有破坏功能')
    console.log('2. 手动审查复杂的 useEffect，使用专用 Hook')
    console.log('3. 使用 ESLint react-hooks/exhaustive-deps 规则')
    console.log('4. 考虑使用 use-effect-helpers 中的专用 Hook')
  }
}

const optimizer = new UseEffectOptimizer()
optimizer.optimize().catch(console.error)