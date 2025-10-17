/**
 * 批量修复字段引用脚本
 * 自动替换旧字段为新字段
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob'

interface Replacement {
  pattern: RegExp
  replacement: string
  description: string
}

const replacements: Replacement[] = [
  // 删除 isActive 字段
  {
    pattern: /isActive:\s*true,?/g,
    replacement: '',
    description: 'Remove isActive field'
  },
  {
    pattern: /,\s*isActive:\s*false/g,
    replacement: '',
    description: 'Remove isActive: false'
  },
  
  // 删除 activate 参数
  {
    pattern: /activate:\s*(true|false),?\s*/g,
    replacement: '',
    description: 'Remove activate parameter'
  },
  
  // 删除 statusVersion 字段
  {
    pattern: /statusVersion:\s*\d+,?/g,
    replacement: '',
    description: 'Remove statusVersion field'
  },
  {
    pattern: /,?\s*statusVersion:\s*batch\.statusVersion/g,
    replacement: '',
    description: 'Remove statusVersion assignment'
  },
  
  // BatchAssetInput role -> promptAssetId/referenceAssetId
  {
    pattern: /role:\s*CreativeAssetRole\.(REPORT|PROMPT),?\s*assetId:\s*(\w+)/g,
    replacement: 'promptAssetId: $2',
    description: 'Convert role+assetId to promptAssetId'
  },
  {
    pattern: /role:\s*'(REPORT|PROMPT)',?\s*assetId:\s*(\w+)/g,
    replacement: 'promptAssetId: $2',
    description: 'Convert role+assetId to promptAssetId (string)'
  }
]

async function fixFile(filePath: string): Promise<number> {
  let content = await fs.readFile(filePath, 'utf-8')
  let changeCount = 0
  
  for (const { pattern, replacement, description } of replacements) {
    const before = content
    content = content.replace(pattern, replacement)
    if (content !== before) {
      changeCount++
      console.log(`  ✓ ${description}`)
    }
  }
  
  // 清理多余的逗号和空行
  content = content.replace(/,(\s*[}\]])/g, '$1') // 删除尾随逗号
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n') // 合并多个空行
  
  if (changeCount > 0) {
    await fs.writeFile(filePath, content, 'utf-8')
  }
  
  return changeCount
}

async function main() {
  const patterns = [
    'scripts/**/*.ts',
    'tests/**/*.ts',
    '!scripts/fix-field-references.ts'
  ]
  
  const files = await glob(patterns, { 
    cwd: process.cwd(),
    absolute: true 
  })
  
  console.log(`Found ${files.length} files to process\n`)
  
  let totalChanges = 0
  let filesChanged = 0
  
  for (const file of files) {
    const changes = await fixFile(file)
    if (changes > 0) {
      filesChanged++
      totalChanges += changes
      console.log(`✅ Fixed ${path.basename(file)} (${changes} changes)\n`)
    }
  }
  
  console.log(`\nSummary:`)
  console.log(`  Files changed: ${filesChanged}/${files.length}`)
  console.log(`  Total changes: ${totalChanges}`)
}

main().catch(console.error)
