#!/usr/bin/env tsx

/**
 * 批量更新所有用户的月度Token配额
 * 用法: npx tsx scripts/update-all-user-limits.ts <新配额>
 * 示例: npx tsx scripts/update-all-user-limits.ts 10000000
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const newLimit = parseInt(process.argv[2])

  if (isNaN(newLimit) || newLimit < 0) {
    console.error('❌ 错误：请提供有效的配额数值')
    console.log('用法: npx tsx scripts/update-all-user-limits.ts <新配额>')
    console.log('示例: npx tsx scripts/update-all-user-limits.ts 10000000')
    process.exit(1)
  }

  console.log(`\n🔍 准备更新所有用户的月度Token配额为: ${newLimit.toLocaleString()}\n`)

  // 先获取所有用户
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      displayName: true,
      monthlyTokenLimit: true,
    },
  })

  if (users.length === 0) {
    console.log('⚠️  数据库中没有用户')
    return
  }

  console.log(`找到 ${users.length} 个用户:\n`)
  users.forEach((user) => {
    console.log(
      `  ${user.email} (${user.displayName || '无昵称'}) - 当前配额: ${user.monthlyTokenLimit.toLocaleString()}`
    )
  })

  console.log(`\n⏳ 开始批量更新...\n`)

  // 批量更新所有用户
  const result = await prisma.user.updateMany({
    data: {
      monthlyTokenLimit: newLimit,
    },
  })

  console.log(`✅ 成功更新 ${result.count} 个用户的配额为: ${newLimit.toLocaleString()}\n`)

  // 再次查询确认
  const updatedUsers = await prisma.user.findMany({
    select: {
      email: true,
      displayName: true,
      monthlyTokenLimit: true,
    },
  })

  console.log('📊 更新后的配额:\n')
  updatedUsers.forEach((user) => {
    console.log(
      `  ✓ ${user.email} (${user.displayName || '无昵称'}) - 新配额: ${user.monthlyTokenLimit.toLocaleString()}`
    )
  })

  console.log('\n✨ 配额更新完成！\n')
}

main()
  .catch((error) => {
    console.error('❌ 执行出错:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
