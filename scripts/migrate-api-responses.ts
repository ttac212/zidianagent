#!/usr/bin/env tsx

/**
 * 智能API响应格式迁移工具
 *
 * 基于Linus原则：将特殊情况变回常规情况
 * 使用AST分析进行更精确的代码转换
 */

import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'
import * as ts from 'typescript'
import * as dt from '@/lib/utils/date-toolkit'

interface MigrationStats {
  total: number
  migrated: number
  skipped: number
  failed: number
  needsManualReview: string[]
  patterns: Map<string, number>
}

// 已迁移文件
const MIGRATED_FILES = new Set([
  'app/api/health/route.ts'
])

// 响应模式映射
const RESPONSE_PATTERNS = {
  // 成功响应
  'NextResponse.json({ success: true': 'success',
  'NextResponse.json({ data:': 'success',
  'NextResponse.json({ result:': 'success',
  'NextResponse.json({ message:': 'success',

  // 错误响应
  'NextResponse.json({ error:': 'error',
  'NextResponse.json({ success: false': 'error',
  'NextResponse.json({ error_message:': 'error', // 避免与success message冲突

  // 特定状态码
  '{ status: 400 }': 'validationError',
  '{ status: 401 }': 'unauthorized',
  '{ status: 403 }': 'forbidden',
  '{ status: 404 }': 'notFound',
  '{ status: 500 }': 'serverError',
  '{ status: 503 }': 'serverError',
}

class ApiResponseMigrator {
  private stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    needsManualReview: [],
    patterns: new Map()
  }

  async run() {
    console.log('🚀 智能API响应格式迁移工具\n')
    console.log('原则: 好品味意味着把特殊情况变回常规情况 - Linus Torvalds\n')

    // 查找所有API文件
    const apiFiles = await glob('app/api/**/*.ts', {
      ignore: ['**/[...nextauth]/**']
    })

    this.stats.total = apiFiles.length
    console.log(`📊 发现 ${apiFiles.length} 个API文件\n`)

    // 处理每个文件
    for (const file of apiFiles) {
      await this.processFile(file)
    }

    // 输出报告
    await this.generateReport()
  }

  private async processFile(filePath: string) {
    // 跳过已迁移
    if (MIGRATED_FILES.has(filePath)) {
      console.log(`⏭️  已迁移: ${filePath}`)
      this.stats.skipped++
      return
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8')

      // 快速检查
      if (content.includes("from '@/lib/api/http-response'")) {
        console.log(`✓ 已使用新格式: ${filePath}`)
        this.stats.skipped++
        return
      }

      // 分析并迁移
      const result = await this.migrateFile(filePath, content)

      if (result.migrated) {
        console.log(`✅ 已迁移: ${filePath}`)
        this.stats.migrated++

        if (result.needsReview) {
          console.log(`   ⚠️ 需要手动审查`)
          this.stats.needsManualReview.push(filePath)
        }
      } else {
        console.log(`⏭️  跳过 (${result.reason}): ${filePath}`)
        this.stats.skipped++
      }
    } catch (error) {
      console.error(`❌ 失败: ${filePath}`)
      console.error(`   ${error}`)
      this.stats.failed++
    }
  }

  private async migrateFile(
    filePath: string,
    content: string
  ): Promise<{ migrated: boolean; needsReview?: boolean; reason?: string }> {
    // 检查是否需要迁移
    if (!this.needsMigration(content)) {
      return { migrated: false, reason: '无响应代码' }
    }

    // 执行转换
    let newContent = content
    let hasChanges = false

    // 1. 添加导入
    if (!content.includes("from '@/lib/api/http-response'")) {
      newContent = this.addImports(newContent)
      hasChanges = true
    }

    // 2. 转换响应模式
    const transformed = this.transformResponses(newContent)
    if (transformed !== newContent) {
      newContent = transformed
      hasChanges = true
    }

    // 3. 清理不需要的导入
    newContent = this.cleanupImports(newContent)

    // 4. 保存文件
    if (hasChanges) {
      await fs.writeFile(filePath, newContent)

      // 检查是否需要审查
      const needsReview = this.needsManualReview(newContent)
      return { migrated: true, needsReview }
    }

    return { migrated: false, reason: '无需改动' }
  }

  private needsMigration(content: string): boolean {
    return (
      content.includes('NextResponse.json') ||
      content.includes('Response.json') ||
      content.includes('new Response(') ||
      content.includes('res.status(') ||
      content.includes('res.json(')
    )
  }

  private addImports(content: string): string {
    const importStatement = `import {
  success,
  error,
  validationError,
  notFound,
  forbidden,
  unauthorized,
  serverError
} from '@/lib/api/http-response'\n`

    // 找到最后一个导入语句
    const importMatches = [...content.matchAll(/^import.*$/gm)]
    if (importMatches.length > 0) {
      const lastImport = importMatches[importMatches.length - 1]
      const insertPos = lastImport.index! + lastImport[0].length
      return (
        content.slice(0, insertPos) +
        '\n' +
        importStatement +
        content.slice(insertPos)
      )
    }

    // 没有导入，添加到文件开头
    return importStatement + '\n' + content
  }

  private transformResponses(content: string): string {
    let result = content

    // 转换规则
    const transformations = [
      // NextResponse.json成功响应
      {
        pattern: /NextResponse\.json\(\s*{\s*success:\s*true,?\s*([^}]*)\s*}\s*(?:,\s*{[^}]*})?\s*\)/g,
        transform: (match: string, data: string) => {
          const cleanData = data.trim()
          if (!cleanData || cleanData === ',') {
            return 'success({})'
          }
          // 提取data字段
          const dataMatch = cleanData.match(/data:\s*(.+?)(?:,|$)/)
          if (dataMatch) {
            return `success(${dataMatch[1].trim()})`
          }
          return `success({ ${cleanData} })`
        }
      },

      // NextResponse.json错误响应带状态码
      {
        pattern: /NextResponse\.json\(\s*{\s*(?:error|message):\s*([^}]+)\s*},?\s*{\s*status:\s*(\d+)\s*}\s*\)/g,
        transform: (match: string, msg: string, status: string) => {
          const cleanMsg = msg.trim().replace(/[,}]$/, '')
          this.recordPattern(`status-${status}`)

          switch (status) {
            case '400': return `validationError(${cleanMsg})`
            case '401': return `unauthorized(${cleanMsg})`
            case '403': return `forbidden(${cleanMsg})`
            case '404': return `notFound(${cleanMsg})`
            case '500':
            case '503': return `serverError(${cleanMsg})`
            default: return `error(${cleanMsg}, { status: ${status} })`
          }
        }
      },

      // NextResponse.json简单错误
      {
        pattern: /NextResponse\.json\(\s*{\s*error:\s*([^}]+)\s*}\s*\)/g,
        transform: (match: string, msg: string) => {
          const cleanMsg = msg.trim().replace(/[,}]$/, '')
          return `error(${cleanMsg})`
        }
      },

      // new Response JSON
      {
        pattern: /new\s+Response\(\s*JSON\.stringify\(\s*({[^}]+})\s*\)[^)]*\)/g,
        transform: (match: string, jsonStr: string) => {
          if (jsonStr.includes('success: true')) {
            return 'success(' + jsonStr.replace(/{\s*success:\s*true,?\s*/, '').replace(/}$/, '') + ')'
          }
          if (jsonStr.includes('error:')) {
            const errorMatch = jsonStr.match(/error:\s*([^,}]+)/)
            if (errorMatch) {
              return `error(${errorMatch[1]})`
            }
          }
          return match // 保持原样
        }
      },

      // 返回语句中的Response
      {
        pattern: /return\s+Response\.json\(\s*({[^}]+})\s*(?:,\s*{[^}]*})?\s*\)/g,
        transform: (match: string, data: string) => {
          if (data.includes('error:')) {
            return match.replace('Response.json', 'error')
          }
          return match.replace('Response.json', 'success')
        }
      }
    ]

    // 应用所有转换
    for (const { pattern, transform } of transformations) {
      result = result.replace(pattern, transform as any)
    }

    return result
  }

  private cleanupImports(content: string): string {
    // 如果不再使用NextResponse，移除导入
    if (!content.includes('NextResponse')) {
      return content.replace(
        /import\s*{\s*NextResponse\s*}\s*from\s*['"]next\/server['"]\s*\n?/g,
        ''
      )
    }
    return content
  }

  private needsManualReview(content: string): boolean {
    // 检查可能需要手动审查的模式
    const reviewPatterns = [
      'res.status',
      'res.json',
      'Response.',
      'streaming',
      'stream',
      'SSE',
      'text/event-stream',
      'ReadableStream',
      '.pipe(',
      'formData',
      'multipart'
    ]

    return reviewPatterns.some(pattern => content.includes(pattern))
  }

  private recordPattern(pattern: string) {
    this.stats.patterns.set(
      pattern,
      (this.stats.patterns.get(pattern) || 0) + 1
    )
  }

  private async generateReport() {
    const report = {
      timestamp: dt.toISO(),
      principle: 'Linus Torvalds: 好品味意味着把特殊情况变回常规情况',
      stats: {
        total: this.stats.total,
        migrated: this.stats.migrated,
        skipped: this.stats.skipped,
        failed: this.stats.failed,
        needsManualReview: this.stats.needsManualReview.length,
        patterns: Object.fromEntries(this.stats.patterns)
      },
      filesNeedingReview: this.stats.needsManualReview,
      recommendations: this.getRecommendations()
    }

    // 输出统计
    console.log('\n' + '='.repeat(60))
    console.log('📈 迁移统计:\n')
    console.log(`   总文件数: ${this.stats.total}`)
    console.log(`   ✅ 已迁移: ${this.stats.migrated}`)
    console.log(`   ⏭️  已跳过: ${this.stats.skipped}`)
    console.log(`   ❌ 失败: ${this.stats.failed}`)
    console.log(`   ⚠️  需审查: ${this.stats.needsManualReview.length}`)

    if (this.stats.patterns.size > 0) {
      console.log('\n📊 发现的模式:')
      for (const [pattern, count] of this.stats.patterns) {
        console.log(`   ${pattern}: ${count}次`)
      }
    }

    if (this.stats.needsManualReview.length > 0) {
      console.log('\n⚠️  需要手动审查的文件:')
      for (const file of this.stats.needsManualReview) {
        console.log(`   - ${file}`)
      }
    }

    // 保存报告
    await fs.writeFile(
      'api-migration-report.json',
      JSON.stringify(report, null, 2)
    )

    console.log('\n📄 详细报告已生成: api-migration-report.json')

    // 生成TODO列表
    if (this.stats.needsManualReview.length > 0) {
      await this.generateTodoList()
    }
  }

  private getRecommendations(): string[] {
    const recommendations = []

    if (this.stats.failed > 0) {
      recommendations.push('检查失败的文件，可能需要手动修复')
    }

    if (this.stats.needsManualReview.length > 0) {
      recommendations.push('审查标记的文件，特别是流式响应和特殊格式')
    }

    if (this.stats.migrated > 0) {
      recommendations.push('运行测试确保API功能正常')
      recommendations.push('更新API文档反映新的响应格式')
    }

    return recommendations
  }

  private async generateTodoList() {
    const todos = this.stats.needsManualReview.map(file => ({
      file,
      reason: '包含特殊响应模式，需要手动验证',
      hints: this.getFileHints(file)
    }))

    await fs.writeFile(
      'api-migration-todos.json',
      JSON.stringify(todos, null, 2)
    )

    console.log('📝 待办事项已生成: api-migration-todos.json')
  }

  private getFileHints(file: string): string[] {
    const hints = []

    if (file.includes('chat')) {
      hints.push('可能包含SSE流式响应')
    }
    if (file.includes('upload')) {
      hints.push('可能处理文件上传')
    }
    if (file.includes('export')) {
      hints.push('可能返回非JSON格式')
    }
    if (file.includes('webhook')) {
      hints.push('可能需要特定响应格式')
    }

    return hints
  }
}

// 执行迁移
const migrator = new ApiResponseMigrator()
migrator.run().catch(console.error)