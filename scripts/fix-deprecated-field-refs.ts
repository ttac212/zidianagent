/**
 * 批量修复废弃字段引用
 *
 * 修复内容：
 * 1. 移除 role 字段引用（CreativeBatchAsset）
 * 2. 移除 statusVersion 字段引用（CreativeBatch）
 * 3. 移除 isActive 字段引用（MerchantPromptAsset）
 * 4. 移除 metadata 字段引用
 */

import fs from 'fs'
import path from 'path'

interface FixResult {
  file: string
  changes: number
  errors: string[]
}

const FILES_TO_FIX = [
  'scripts/test-batch-sse.ts',
  'scripts/test-creative-flow.ts',
  'tests/batch-repositories.test.ts'
]

const REPLACEMENTS = [
  // 移除 role 字段
  {
    pattern: /role:\s*['"](?:REPORT|PROMPT)['"]\s*,?\s*/g,
    replacement: ''
  },
  // 移除 statusVersion
  {
    pattern: /statusVersion:\s*true\s*,?\s*/g,
    replacement: ''
  },
  {
    pattern: /\.statusVersion/g,
    replacement: '.updatedAt'
  },
  {
    pattern: /statusVersion\s*>/g,
    replacement: 'updatedAt >'
  },
  // 移除 isActive
  {
    pattern: /\.isActive/g,
    replacement: '.version === maxVersion'
  },
  // 移除 CreativeAssetRole 导入
  {
    pattern: /,\s*CreativeAssetRole\s*/g,
    replacement: ''
  },
  {
    pattern: /\s*CreativeAssetRole\s*,/g,
    replacement: ''
  }
]

function fixFile(filePath: string): FixResult {
  const result: FixResult = {
    file: filePath,
    changes: 0,
    errors: []
  }

  try {
    if (!fs.existsSync(filePath)) {
      result.errors.push(`文件不存在: ${filePath}`)
      return result
    }

    let content = fs.readFileSync(filePath, 'utf-8')
    const originalContent = content

    // 应用所有替换
    for (const { pattern, replacement } of REPLACEMENTS) {
      const matches = content.match(pattern)
      if (matches) {
        result.changes += matches.length
        content = content.replace(pattern, replacement)
      }
    }

    // 只有实际发生变化时才写入
    if (content !== originalContent) {
      // 创建备份
      const backupPath = `${filePath}.bak`
      fs.writeFileSync(backupPath, originalContent)

      // 写入修复后的内容
      fs.writeFileSync(filePath, content)

      console.log(`✓ ${filePath}: ${result.changes} 处修改`)
    } else {
      console.log(`⏭ ${filePath}: 无需修改`)
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    result.errors.push(errorMsg)
    console.error(`✗ ${filePath}: ${errorMsg}`)
  }

  return result
}

function main() {
  console.log('🔧 开始批量修复废弃字段引用...\n')

  const results: FixResult[] = []
  let totalChanges = 0
  let totalErrors = 0

  for (const file of FILES_TO_FIX) {
    const filePath = path.join(process.cwd(), file)
    const result = fixFile(filePath)
    results.push(result)
    totalChanges += result.changes
    totalErrors += result.errors.length
  }

  console.log('\n📊 修复统计:')
  console.log(`  处理文件: ${results.length}`)
  console.log(`  总修改数: ${totalChanges}`)
  console.log(`  错误数: ${totalErrors}`)

  if (totalErrors > 0) {
    console.log('\n❌ 以下文件存在错误:')
    for (const result of results) {
      if (result.errors.length > 0) {
        console.log(`\n  ${result.file}:`)
        for (const error of result.errors) {
          console.log(`    - ${error}`)
        }
      }
    }
    process.exit(1)
  }

  console.log('\n✅ 所有文件修复完成!')
  console.log('\n💡 提示:')
  console.log('  - 原文件已备份为 .bak')
  console.log('  - 运行 pnpm type-check 验证修复')
  console.log('  - 如有问题可从备份恢复')
}

main()
