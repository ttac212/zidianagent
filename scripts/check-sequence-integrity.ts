#!/usr/bin/env tsx
/**
 * 检查 creative_copies.sequence 数据完整性
 */

import { prisma } from '@/lib/prisma'

async function main() {
  console.log('Checking creative_copies.sequence integrity...\n')

  // 检查越界数据
  const outOfRange = await prisma.creativeCopy.findMany({
    where: {
      OR: [
        { sequence: { lt: 1 } },
        { sequence: { gt: 5 } }
      ]
    },
    select: {
      id: true,
      batchId: true,
      sequence: true,
      createdAt: true
    }
  })

  if (outOfRange.length > 0) {
    console.log(`❌ Found ${outOfRange.length} copies with sequence out of range [1, 5]:`)
    outOfRange.forEach(copy => {
      console.log(`  - ID: ${copy.id}, Batch: ${copy.batchId}, Sequence: ${copy.sequence}, Created: ${copy.createdAt}`)
    })
  } else {
    console.log('✅ All sequences are within valid range [1, 5]')
  }

  // 检查总数
  const totalCount = await prisma.creativeCopy.count()
  console.log(`\nTotal creative_copies: ${totalCount}`)

  // 检查批次状态统计
  const batchStats = await prisma.creativeBatch.groupBy({
    by: ['status'],
    _count: true
  })

  console.log('\nBatch status distribution:')
  batchStats.forEach(stat => {
    console.log(`  ${stat.status}: ${stat._count}`)
  })

  // 检查是否有 FAILED 批次包含已生成的文案
  const failedWithCopies = await prisma.creativeBatch.findMany({
    where: {
      status: 'FAILED',
      copies: {
        some: {}
      }
    },
    select: {
      id: true,
      merchantId: true,
      createdAt: true,
      errorMessage: true,
      _count: {
        select: { copies: true }
      }
    }
  })

  if (failedWithCopies.length > 0) {
    console.log(`\n⚠️  Found ${failedWithCopies.length} FAILED batches with generated copies:`)
    failedWithCopies.forEach(batch => {
      console.log(`  - Batch: ${batch.id}, Copies: ${batch._count.copies}/5, Error: ${batch.errorMessage || 'N/A'}`)
    })
  } else {
    console.log('\n✅ No FAILED batches with partial success')
  }
}

main()
  .catch(e => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
