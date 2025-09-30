#!/usr/bin/env node

/**
 * 批量修复API路由中的request参数名问题
 * 将 _request: NextRequest 改回 request: NextRequest
 */

const fs = require('fs')
const path = require('path')

const files = [
  'app/api/analytics/events/route.ts',
  'app/api/admin/stats/route.ts',
  'app/api/analytics/metrics/route.ts',
  'app/api/auth/me/route.ts',
  'app/api/auth/verify-invite-code/route.ts',
  'app/api/chat/route.ts',
  'app/api/conversations/route.ts',
  'app/api/data/metrics/route.ts',
  'app/api/import/external-resources/route.ts',
  'app/api/invite-codes/generate/route.ts',
  'app/api/invite-codes/register/route.ts',
  'app/api/invite-codes/route.ts',
  'app/api/invite-codes/verify/route.ts',
  'app/api/keyword-data/route.ts',
  'app/api/merchants/categories/route.ts',
  'app/api/merchants/stats/route.ts',
  'app/api/merchants/route.ts',
  'app/api/metrics/route.ts',
  'app/api/users/route.ts',
  'app/api/merchant-analysis/generate/route.ts',
  'app/api/debug/ai-test/route.ts',
  'app/api/debug/env/route.ts'
]

let fixed = 0
let skipped = 0

for (const file of files) {
  const filePath = path.join(__dirname, '..', file)

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`)
    skipped++
    continue
  }

  const content = fs.readFileSync(filePath, 'utf8')

  // 查找需要修复的模式
  const needsFix = /_request:\s*NextRequest/.test(content) && /\brequest\b/.test(content)

  if (!needsFix) {
    console.log(`⏭️  Skipping ${file} (no fix needed)`)
    skipped++
    continue
  }

  // 执行替换
  let newContent = content.replace(/\b_request:\s*NextRequest\b/g, 'request: NextRequest')

  // 保存文件
  fs.writeFileSync(filePath, newContent, 'utf8')
  console.log(`✅ Fixed ${file}`)
  fixed++
}

console.log(`\n📊 Summary:`)
console.log(`   ✅ Fixed: ${fixed} files`)
console.log(`   ⏭️  Skipped: ${skipped} files`)
console.log(`   📁 Total: ${files.length} files`)