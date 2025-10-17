#!/usr/bin/env tsx

/**
 * 直接通过SQL修复超出INT范围的配额，并设置特定用户为无限配额
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MAX_INT = 2147483647 // INT类型最大值
const UNLIMITED_QUOTA = 2147483647

async function main() {
  const targetEmail = process.argv[2]

  if (!targetEmail) {
    console.error('❌ 错误：请提供用户邮箱')
    console.log('用法: npx tsx scripts/fix-and-set-unlimited.ts <email>')
    process.exit(1)
  }

  console.log('\n🔧 步骤1: 修复超出INT范围的配额值...\n')

  // 使用原始SQL修复所有超出INT范围的配额（SQLite表名小写）
  await prisma.$executeRaw`
    UPDATE users
    SET monthlyTokenLimit = ${MAX_INT}
    WHERE monthlyTokenLimit > ${MAX_INT}
  `

  console.log('✅ 已修复所有超出范围的配额\n')

  console.log(`🔍 步骤2: 查找目标用户 ${targetEmail}...\n`)

  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    select: {
      id: true,
      email: true,
      displayName: true,
      monthlyTokenLimit: true,
      role: true,
    },
  })

  if (!user) {
    console.error(`❌ 错误：未找到邮箱为 ${targetEmail} 的用户`)
    process.exit(1)
  }

  console.log('📋 用户信息:')
  console.log(`  邮箱: ${user.email}`)
  console.log(`  昵称: ${user.displayName || '无昵称'}`)
  console.log(`  角色: ${user.role}`)
  console.log(`  当前配额: ${user.monthlyTokenLimit.toLocaleString()}\n`)

  console.log(`⏳ 步骤3: 设置为无限配额 (${UNLIMITED_QUOTA.toLocaleString()})...\n`)

  const updatedUser = await prisma.user.update({
    where: { email: targetEmail },
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
  console.log(`  新配额: ${updatedUser.monthlyTokenLimit.toLocaleString()} (实际无限)\n`)
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
