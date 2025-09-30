#!/usr/bin/env node

/**
 * 批量迁移API响应格式到统一的 http-response 工具
 *
 * 原则：将特殊情况变回常规情况（Linus Torvalds）
 * 目标：所有API使用统一的响应格式
 */

const fs = require('fs').promises
const path = require('path')
const glob = require('glob').sync

console.log('🔄 开始批量迁移API响应格式...\n')

// 已经迁移的文件（作为示例）
const MIGRATED_FILES = [
  'app/api/health/route.ts',
  'app/api/invite-codes/verify/route.ts'
]

// 查找所有API文件
const apiFiles = glob('app/api/**/*.ts', {
  cwd: process.cwd(),
  ignore: ['**/[...nextauth]/**']
})

// 统计信息
let stats = {
  total: apiFiles.length,
  migrated: 0,
  skipped: 0,
  failed: 0,
  needsManualReview: []
}

/**
 * 分析文件是否需要迁移
 */
async function analyzeFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8')

  // 检查是否已经使用新格式
  if (content.includes("from '@/lib/api/http-response'")) {
    return { needsMigration: false, reason: 'already-migrated' }
  }

  // 检查是否为NextAuth路由（特殊处理）
  if (content.includes('[...nextauth]')) {
    return { needsMigration: false, reason: 'nextauth-route' }
  }

  // 检查是否有响应相关代码
  const hasResponse =
    content.includes('NextResponse.json') ||
    content.includes('Response.json') ||
    content.includes('return res.status') ||
    content.includes('return new Response')

  if (!hasResponse) {
    return { needsMigration: false, reason: 'no-response' }
  }

  return { needsMigration: true }
}

/**
 * 自动迁移文件
 */
async function migrateFile(filePath) {
  let content = await fs.readFile(filePath, 'utf-8')
  const originalContent = content

  // 1. 添加导入语句
  const hasNextResponse = content.includes('NextResponse')
  const importStatement = `import {
  success,
  error,
  validationError,
  notFound,
  forbidden,
  unauthorized,
  serverError
} from '@/lib/api/http-response'`

  // 找到合适的位置插入导入
  const importRegex = /import.*from.*\n/g
  const lastImport = [...content.matchAll(importRegex)].pop()
  if (lastImport) {
    const insertPos = lastImport.index + lastImport[0].length
    content = content.slice(0, insertPos) + importStatement + '\n' + content.slice(insertPos)
  } else {
    // 如果没有导入，在文件开头添加
    content = importStatement + '\n\n' + content
  }

  // 2. 替换常见的响应模式
  const replacements = [
    // NextResponse.json({ success: true, ... }) -> success(...)
    {
      pattern: /NextResponse\.json\(\s*{\s*success:\s*true,?\s*([^}]*)\s*}\s*\)/g,
      replacement: (match, data) => {
        if (data.trim()) {
          // 提取data部分
          const dataMatch = data.match(/data:\s*({[^}]+}|\[[^\]]+\]|[^,]+)/)
          if (dataMatch) {
            return `success(${dataMatch[1].trim()})`
          }
        }
        return 'success({})'
      }
    },

    // NextResponse.json({ error: ... }, { status: 4xx }) -> error(...) 或具体错误函数
    {
      pattern: /NextResponse\.json\(\s*{\s*error:\s*([^}]+)\s*},?\s*{\s*status:\s*(\d+)\s*}\s*\)/g,
      replacement: (match, errorMsg, status) => {
        const msg = errorMsg.trim().replace(/[,}]$/, '')
        switch(status) {
          case '400': return `validationError(${msg})`
          case '401': return `unauthorized(${msg})`
          case '403': return `forbidden(${msg})`
          case '404': return `notFound(${msg})`
          case '500': return `serverError(${msg})`
          default: return `error(${msg}, { status: ${status} })`
        }
      }
    },

    // new Response(JSON.stringify({ ... })) -> 相应的函数
    {
      pattern: /new\s+Response\(\s*JSON\.stringify\(\s*({[^}]+})\s*\)[^)]*\)/g,
      replacement: (match, jsonObj) => {
        try {
          // 简单解析JSON对象
          if (jsonObj.includes('success: true')) {
            return 'success(' + jsonObj.replace(/{\s*success:\s*true,?\s*/, '{').trim() + ')'
          } else if (jsonObj.includes('error:')) {
            return 'error(' + jsonObj.match(/error:\s*([^,}]+)/)[1] + ')'
          }
        } catch (e) {
          // 保持原样，标记需要手动检查
          return match
        }
        return match
      }
    }
  ]

  // 应用替换
  replacements.forEach(({ pattern, replacement }) => {
    content = content.replace(pattern, replacement)
  })

  // 3. 检查是否有实质性改变
  if (content === originalContent) {
    return { success: false, reason: 'no-changes' }
  }

  // 4. 清理不需要的NextResponse导入（如果完全迁移）
  if (!content.includes('NextResponse') && hasNextResponse) {
    content = content.replace(/import\s*{\s*NextResponse\s*}\s*from\s*'next\/server'\n?/g, '')
  }

  // 5. 保存文件
  await fs.writeFile(filePath, content)

  // 6. 检查是否需要手动审查
  const needsReview =
    content.includes('Response.') ||
    content.includes('res.status') ||
    content.includes('res.json') ||
    content.includes('catch')  // 错误处理可能需要调整

  return { success: true, needsReview }
}

/**
 * 主函数
 */
async function main() {
  console.log(`📊 发现 ${apiFiles.length} 个API文件\n`)

  for (const file of apiFiles) {
    const filePath = path.join(process.cwd(), file)
    const relativePath = file

    // 跳过已迁移的文件
    if (MIGRATED_FILES.includes(file)) {
      console.log(`⏭️  跳过已迁移: ${relativePath}`)
      stats.skipped++
      continue
    }

    try {
      // 分析文件
      const analysis = await analyzeFile(filePath)

      if (!analysis.needsMigration) {
        console.log(`⏭️  跳过 (${analysis.reason}): ${relativePath}`)
        stats.skipped++
        continue
      }

      // 迁移文件
      const result = await migrateFile(filePath)

      if (result.success) {
        if (result.needsReview) {
          console.log(`✅ 已迁移 (需审查): ${relativePath}`)
          stats.needsManualReview.push(relativePath)
        } else {
          console.log(`✅ 已迁移: ${relativePath}`)
        }
        stats.migrated++
      } else {
        console.log(`⚠️  无变化: ${relativePath}`)
        stats.skipped++
      }

    } catch (error) {
      console.error(`❌ 失败: ${relativePath}`)
      console.error(`   原因: ${error.message}`)
      stats.failed++
    }
  }

  // 输出统计
  console.log('\n' + '='.repeat(60))
  console.log('📈 迁移统计:')
  console.log(`   总文件数: ${stats.total}`)
  console.log(`   ✅ 已迁移: ${stats.migrated}`)
  console.log(`   ⏭️  已跳过: ${stats.skipped}`)
  console.log(`   ❌ 失败: ${stats.failed}`)

  if (stats.needsManualReview.length > 0) {
    console.log(`\n⚠️  需要手动审查的文件 (${stats.needsManualReview.length}):`)
    stats.needsManualReview.forEach(file => {
      console.log(`   - ${file}`)
    })
  }

  // 生成迁移报告
  const report = {
    timestamp: new Date().toISOString(),
    stats,
    needsManualReview: stats.needsManualReview,
    principle: 'Linus: 好品味意味着把特殊情况变回常规情况'
  }

  await fs.writeFile(
    path.join(process.cwd(), 'migration-report.json'),
    JSON.stringify(report, null, 2)
  )

  console.log('\n📄 迁移报告已生成: migration-report.json')

  // 返回状态码
  process.exit(stats.failed > 0 ? 1 : 0)
}

// 运行
main().catch(console.error)