#!/usr/bin/env tsx

/**
 * 时间处理代码迁移脚本
 *
 * 遵循 Linus 原则：将特殊的时间处理变成常规操作
 * 自动替换 38 个文件中的手写时间处理代码
 */

import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'

interface MigrationStats {
  total: number
  migrated: number
  skipped: number
  failed: number
  patterns: Map<string, number>
}

interface Replacement {
  pattern: RegExp
  replace: string | ((match: string, ...args: string[]) => string)
  importNeeded: string[]
  description: string
}

class DateToolkitMigrator {
  private stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    patterns: new Map()
  }

  // 定义替换规则
  private replacements: Replacement[] = [
    {
      pattern: /new Date\(\)\.toISOString\(\)/g,
      replace: 'dt.toISO()',
      importNeeded: ['toISO'],
      description: 'ISO字符串格式化'
    },
    {
      pattern: /new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]/g,
      replace: 'dt.toDateString()',
      importNeeded: ['toDateString'],
      description: '日期字符串格式化'
    },
    {
      pattern: /new Date\(\)\.toISOString\(\)\.split\('T'\)\[1\]\.split\('\.'\)\[0\]/g,
      replace: 'dt.toTimeString()',
      importNeeded: ['toTimeString'],
      description: '时间字符串格式化'
    },
    {
      pattern: /Date\.now\(\)/g,
      replace: 'dt.timestamp()',
      importNeeded: ['timestamp'],
      description: '时间戳获取'
    },
    {
      pattern: /new Date\(\)/g,
      replace: 'dt.now()',
      importNeeded: ['now'],
      description: '当前时间获取'
    },
    {
      pattern: /new Date\(([^)]+)\)\.getTime\(\) - new Date\(([^)]+)\)\.getTime\(\)/g,
      replace: 'dt.compare($1, $2)',
      importNeeded: ['compare'],
      description: '日期比较'
    },
    {
      pattern: /\.sort\(\(a, b\) => new Date\(([^)]+)\)\.getTime\(\) - new Date\(([^)]+)\)\.getTime\(\)\)/g,
      replace: '.sort(dt.sortByDate(item => $1))',
      importNeeded: ['sortByDate'],
      description: '日期排序'
    },
    {
      pattern: /`\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 9\)\}`/g,
      replace: 'dt.uniqueId()',
      importNeeded: ['uniqueId'],
      description: '唯一ID生成'
    },
    {
      pattern: /`([^`]+)_\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 9\)\}`/g,
      replace: "dt.uniqueId('$1')",
      importNeeded: ['uniqueId'],
      description: '带前缀的唯一ID生成'
    }
  ]

  async run() {
    console.log('🚀 时间处理代码迁移工具\n')
    console.log('原则: 将特殊的时间处理变成常规操作 - Linus Torvalds\n')

    // 查找所有需要处理的文件
    const files = await glob('**/*.{ts,tsx}', {
      ignore: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '.next/**',
        'tests/**',
        'scripts/migrate-date-toolkit.ts',
        'lib/utils/date-toolkit.ts'
      ]
    })

    // 过滤包含时间处理的文件
    const targetFiles = []
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8')
      if (this.needsMigration(content)) {
        targetFiles.push(file)
      }
    }

    this.stats.total = targetFiles.length
    console.log(`📊 发现 ${targetFiles.length} 个包含时间处理的文件\n`)

    // 处理每个文件
    for (const file of targetFiles) {
      await this.migrateFile(file)
    }

    // 输出报告
    await this.generateReport()
  }

  private needsMigration(content: string): boolean {
    // 如果已经导入了 date-toolkit，跳过
    if (content.includes("from '@/lib/utils/date-toolkit'")) {
      return false
    }

    // 检查是否包含需要迁移的模式
    return this.replacements.some(r => r.pattern.test(content))
  }

  private async migrateFile(filePath: string) {
    try {
      console.log(`处理: ${filePath}`)

      let content = await fs.readFile(filePath, 'utf-8')
      const originalContent = content
      const neededImports = new Set<string>()
      const appliedPatterns: string[] = []

      // 应用替换规则
      for (const replacement of this.replacements) {
        const regex = new RegExp(replacement.pattern.source, replacement.pattern.flags)
        if (regex.test(content)) {
          content = content.replace(replacement.pattern, replacement.replace as any)
          replacement.importNeeded.forEach(imp => neededImports.add(imp))
          appliedPatterns.push(replacement.description)
          this.recordPattern(replacement.description)
        }
      }

      // 如果有变化，添加导入
      if (content !== originalContent && neededImports.size > 0) {
        content = this.addImport(content, Array.from(neededImports))

        // 保存文件
        await fs.writeFile(filePath, content)

        console.log(`  ✅ 已迁移: ${appliedPatterns.join(', ')}`)
        this.stats.migrated++
      } else {
        console.log(`  ⏭️ 跳过: 无需修改`)
        this.stats.skipped++
      }
    } catch (error) {
      console.error(`  ❌ 失败: ${error}`)
      this.stats.failed++
    }
  }

  private addImport(content: string, imports: string[]): string {
    const importStatement = `import * as dt from '@/lib/utils/date-toolkit'`

    // 也可以选择按需导入
    // const importStatement = `import { ${imports.join(', ')} } from '@/lib/utils/date-toolkit'`

    // 查找最后一个导入语句
    const importRegex = /^import.*$/gm
    const importMatches = [...content.matchAll(importRegex)]

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

    // 如果没有导入，添加到文件开头
    return importStatement + '\n\n' + content
  }

  private recordPattern(pattern: string) {
    this.stats.patterns.set(
      pattern,
      (this.stats.patterns.get(pattern) || 0) + 1
    )
  }

  private async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      principle: 'Linus: 将特殊的时间处理变成常规操作',
      stats: {
        total: this.stats.total,
        migrated: this.stats.migrated,
        skipped: this.stats.skipped,
        failed: this.stats.failed
      },
      patterns: Object.fromEntries(this.stats.patterns),
      benefits: [
        '统一时间处理方式',
        '减少代码重复',
        '提高代码可维护性',
        '避免时区处理错误',
        '性能优化（减少重复Date对象创建）'
      ],
      nextSteps: [
        '运行测试确保功能正常',
        '检查需要手动调整的复杂时间逻辑',
        '考虑添加更多时间工具函数'
      ]
    }

    // 输出统计
    console.log('\n' + '='.repeat(60))
    console.log('📈 迁移统计:\n')
    console.log(`   总文件数: ${this.stats.total}`)
    console.log(`   ✅ 已迁移: ${this.stats.migrated}`)
    console.log(`   ⏭️  已跳过: ${this.stats.skipped}`)
    console.log(`   ❌ 失败: ${this.stats.failed}`)

    if (this.stats.patterns.size > 0) {
      console.log('\n📊 替换模式统计:')
      for (const [pattern, count] of this.stats.patterns) {
        console.log(`   ${pattern}: ${count}次`)
      }
    }

    // 保存报告
    await fs.writeFile(
      'date-toolkit-migration-report.json',
      JSON.stringify(report, null, 2)
    )

    console.log('\n📄 详细报告已生成: date-toolkit-migration-report.json')

    // 示例代码
    console.log('\n📚 使用示例:')
    console.log('```typescript')
    console.log('import * as dt from "@/lib/utils/date-toolkit"')
    console.log('')
    console.log('// 基础用法')
    console.log('const now = dt.now()                    // 替代 new Date()')
    console.log('const iso = dt.toISO()                  // 替代 new Date().toISOString()')
    console.log('const timestamp = dt.timestamp()        // 替代 Date.now()')
    console.log('')
    console.log('// 日期计算')
    console.log('const tomorrow = dt.add(now, 1, "days")')
    console.log('const diffDays = dt.diff(date1, date2, "days")')
    console.log('')
    console.log('// 格式化')
    console.log('const relative = dt.fromNow(date)       // "3 天前"')
    console.log('const duration = dt.formatDuration(ms)  // "1小时30分钟"')
    console.log('')
    console.log('// 排序')
    console.log('items.sort(dt.sortByDate(item => item.createdAt))')
    console.log('```')
  }
}

// 执行迁移
const migrator = new DateToolkitMigrator()
migrator.run().catch(console.error)