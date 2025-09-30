#!/usr/bin/env node

const fs = require('fs').promises
const path = require('path')
const glob = require('glob')

async function fixImportErrors() {
  // 查找所有有问题的API文件
  const files = glob.sync('app/api/**/*.ts')

  let fixed = 0

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8')

    // 修复错误的import语句模式
    // 模式1: import { 后面直接跟了 import *
    if (content.includes('import {\nimport * as dt')) {
      const fixed1 = content.replace(
        /import \{[\n\r]+import \* as dt from '@\/lib\/utils\/date-toolkit'[\n\r]+/g,
        "import * as dt from '@/lib/utils/date-toolkit'\nimport {\n"
      )

      await fs.writeFile(file, fixed1)
      console.log(`✅ Fixed: ${file}`)
      fixed++
      continue
    }

    // 模式2: 检查是否有其他格式问题
    const lines = content.split('\n')
    let hasError = false
    let fixedLines = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const nextLine = lines[i + 1]

      // 发现错误模式
      if (line === 'import {' && nextLine && nextLine.startsWith('import * as')) {
        // 先添加 import * 行
        fixedLines.push(nextLine)
        // 然后添加 import { 行
        fixedLines.push(line)
        // 跳过下一行（已经处理了）
        i++
        hasError = true
      } else {
        fixedLines.push(line)
      }
    }

    if (hasError) {
      await fs.writeFile(file, fixedLines.join('\n'))
      console.log(`✅ Fixed: ${file}`)
      fixed++
    }
  }

  console.log(`\n总共修复了 ${fixed} 个文件`)
}

fixImportErrors().catch(console.error)