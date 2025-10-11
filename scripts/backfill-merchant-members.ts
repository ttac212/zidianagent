#!/usr/bin/env tsx
/**
 * 商家成员基线同步脚本
 * 
 * 根据已有的批次记录，回填 merchant_members 表
 * 确保所有创建过批次的用户都有对应的商家成员记录
 */

import { prisma } from '@/lib/prisma'

async function main() {
  console.log('=== 商家成员基线同步 ===\n')

  // 1. 从批次记录中提取商家-用户对
  console.log('1. 从批次记录中提取商家-用户关系...')
  const batches = await prisma.creativeBatch.findMany({
    select: {
      merchantId: true,
      triggeredBy: true
    }
  })

  console.log(`  发现 ${batches.length} 条批次记录`)

  const uniquePairs = new Map<string, { merchantId: string; userId: string }>()

  for (const batch of batches) {
    if (!batch.triggeredBy) {
      console.warn(`  ⚠️  批次缺少 triggeredBy，跳过`)
      continue
    }
    const key = `${batch.merchantId}:${batch.triggeredBy}`
    if (!uniquePairs.has(key)) {
      uniquePairs.set(key, {
        merchantId: batch.merchantId,
        userId: batch.triggeredBy
      })
    }
  }

  console.log(`  提取到 ${uniquePairs.size} 个唯一的商家-用户对\n`)

  if (!uniquePairs.size) {
    console.log('✅ 无需回填\n')
    return
  }

  let pairs = Array.from(uniquePairs.values())

  // 1.5 验证用户存在
  console.log('1.5 验证用户有效性...')
  const userIds = [...new Set(pairs.map(p => p.userId))]
  const existingUsers = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true }
  })

  const validUserIds = new Set(existingUsers.map(u => u.id))
  const invalidPairs = pairs.filter(p => !validUserIds.has(p.userId))

  if (invalidPairs.length > 0) {
    console.warn(`  ⚠️  发现 ${invalidPairs.length} 个无效用户ID:`)
    invalidPairs.forEach(p => {
      console.warn(`    - ${p.userId} (商家: ${p.merchantId})`)
    })
  }

  // 只保留有效的
  pairs = pairs.filter(p => validUserIds.has(p.userId))
  console.log(`  有效关系: ${pairs.length} 个\n`)

  if (pairs.length === 0) {
    console.log('✅ 无有效关系需要回填\n')
    return
  }

  // 2. 检查已存在的成员记录
  console.log('2. 检查已存在的成员记录...')
  const existing = await prisma.merchantMember.findMany({
    where: {
      OR: pairs.map(pair => ({
        merchantId: pair.merchantId,
        userId: pair.userId
      }))
    },
    select: {
      merchantId: true,
      userId: true,
      role: true
    }
  })

  console.log(`  已存在 ${existing.length} 条成员记录\n`)

  // 从待创建列表中移除已存在的
  for (const record of existing) {
    const key = `${record.merchantId}:${record.userId}`
    uniquePairs.delete(key)
    console.log(`  跳过 ${key} (已存在, role: ${record.role})`)
  }

  const data = Array.from(uniquePairs.values()).map(pair => ({
    merchantId: pair.merchantId,
    userId: pair.userId,
    role: 'EDITOR' as const
  }))

  if (!data.length) {
    console.log('\n✅ 无需创建新记录\n')
    return
  }

  // 3. 创建缺失的成员记录
  console.log(`\n3. 创建 ${data.length} 条新成员记录...`)
  
  try {
    await prisma.merchantMember.createMany({ data })
    console.log(`✅ 成功创建 ${data.length} 条记录\n`)

    // 显示创建的记录
    for (const record of data) {
      console.log(`  + ${record.merchantId} ← ${record.userId} (${record.role})`)
    }
  } catch (error: any) {
    console.error('❌ 创建失败:', error.message)
    throw error
  }

  console.log('\n=== 同步完成 ===')
  console.log(`总计处理: ${pairs.length} 对关系`)
  console.log(`已存在: ${existing.length} 条`)
  console.log(`新创建: ${data.length} 条`)
}

main()
  .catch(error => {
    console.error('❌ Failed to backfill merchant members:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
