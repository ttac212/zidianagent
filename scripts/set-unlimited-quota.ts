#!/usr/bin/env tsx

/**
 * 设置用户为无限配额
 * 用法: npx tsx scripts/set-unlimited-quota.ts <email>
 * 示例: npx tsx scripts/set-unlimited-quota.ts user@example.com
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 使用一个非常大的数值表示"无限"（INT类型的最大值 2147483647）
const UNLIMITED_QUOTA = 2147483647

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.error('❌ 错误：请提供用户邮箱')
    console.log('用法: npx tsx scripts/set-unlimited-quota.ts <email>')
    console.log('示例: npx tsx scripts/set-unlimited-quota.ts user@example.com')
    process.exit(1)
  }

  console.log(`\n🔍 查找用户: ${email}\n`)

  // 查找用户
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      displayName: true,
      monthlyTokenLimit: true,
      role: true,
    },
  })

  if (!user) {
    console.error(`❌ 错误：未找到邮箱为 ${email} 的用户`)
    process.exit(1)
  }

  console.log('📋 用户信息:')
  console.log(`  邮箱: ${user.email}`)
  console.log(`  昵称: ${user.displayName || '无昵称'}`)
  console.log(`  角色: ${user.role}`)
  console.log(`  当前配额: ${user.monthlyTokenLimit.toLocaleString()}\n`)

  console.log(`⏳ 设置为无限配额...\n`)

  // 更新用户配额
  const updatedUser = await prisma.user.update({
    where: { email },
    data: {
      monthlyTokenLimit: UNLIMITED_QUOTA,
    },
    select: {
      email: true,
      displayName: true,
      monthlyTokenLimit: true,
    },
  })

  console.log('✅ 配额更新成功！\n')
  console.log('📊 更新后信息:')
  console.log(`  邮箱: ${updatedUser.email}`)
  console.log(`  昵称: ${updatedUser.displayName || '无昵称'}`)
  console.log(`  新配额: ${updatedUser.monthlyTokenLimit.toLocaleString()} (无限)\n`)
  console.log('✨ 该用户现在拥有无限配额！\n')
}

main()
  .catch((error) => {
    console.error('❌ 执行出错:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
