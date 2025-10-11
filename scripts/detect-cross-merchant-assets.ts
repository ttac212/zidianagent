/**
 * 检测跨商家资产关联（数据污染）
 * 
 * 使用场景：
 * - 修复权限漏洞后验证数据完整性
 * - 定期数据审计
 */

import { prisma } from '@/lib/prisma'

interface Violation {
  batchId: string
  batchMerchant: string
  assetId: string
  assetMerchant: string
  assetType: 'prompt' | 'reference'
  role: string
}

async function detectCrossMerchantAssets() {
  console.log('🔍 开始检测跨商家资产关联...\n')

  const batches = await prisma.creativeBatch.findMany({
    include: {
      assets: {
        include: {
          promptAsset: { select: { merchantId: true } },
          referenceAsset: { select: { merchantId: true } }
        }
      }
    }
  })

  console.log(`📊 共扫描 ${batches.length} 个批次\n`)

  const violations: Violation[] = []

  for (const batch of batches) {
    for (const asset of batch.assets) {
      let assetMerchantId: string | undefined
      let assetType: 'prompt' | 'reference' | undefined

      if (asset.promptAsset) {
        assetMerchantId = asset.promptAsset.merchantId
        assetType = 'prompt'
      } else if (asset.referenceAsset) {
        assetMerchantId = asset.referenceAsset.merchantId
        assetType = 'reference'
      }

      if (assetMerchantId && assetMerchantId !== batch.merchantId) {
        violations.push({
          batchId: batch.id,
          batchMerchant: batch.merchantId,
          assetId: asset.promptAssetId ?? asset.referenceAssetId ?? 'unknown',
          assetMerchant: assetMerchantId,
          assetType: assetType!,
          role: asset.role
        })
      }
    }
  }

  console.log(`\n📋 检测结果：\n`)
  
  if (violations.length === 0) {
    console.log('✅ 未发现跨商家资产关联，数据完整性良好！')
  } else {
    console.log(`❌ 发现 ${violations.length} 个跨商家资产关联违规项：\n`)
    
    // 按批次分组显示
    const groupedByBatch = violations.reduce((acc, v) => {
      if (!acc[v.batchId]) {
        acc[v.batchId] = []
      }
      acc[v.batchId].push(v)
      return acc
    }, {} as Record<string, Violation[]>)

    for (const [batchId, batchViolations] of Object.entries(groupedByBatch)) {
      console.log(`📦 批次: ${batchId}`)
      console.log(`   商家: ${batchViolations[0].batchMerchant}`)
      console.log(`   违规资产:`)
      
      for (const v of batchViolations) {
        console.log(`   - [${v.assetType}] ${v.assetId} (角色: ${v.role})`)
        console.log(`     实际归属: ${v.assetMerchant}`)
      }
      console.log('')
    }

    // 统计信息
    const uniqueBatches = new Set(violations.map(v => v.batchId)).size
    const uniqueMerchants = new Set([
      ...violations.map(v => v.batchMerchant),
      ...violations.map(v => v.assetMerchant)
    ]).size

    console.log(`\n📈 统计信息：`)
    console.log(`   - 受影响批次数: ${uniqueBatches}`)
    console.log(`   - 涉及商家数: ${uniqueMerchants}`)
    console.log(`   - prompt 类违规: ${violations.filter(v => v.assetType === 'prompt').length}`)
    console.log(`   - reference 类违规: ${violations.filter(v => v.assetType === 'reference').length}`)

    console.log(`\n⚠️  建议操作：`)
    console.log(`   1. 导出违规数据备份：`)
    console.log(`      node scripts/export-violations.ts`)
    console.log(`   2. 手动审查每个违规批次`)
    console.log(`   3. 删除或标记为 ARCHIVED：`)
    console.log(`      DELETE FROM creative_batches WHERE id IN ('${[...new Set(violations.map(v => v.batchId))].join("', '")}')`)
  }

  return violations
}

// 运行检测
detectCrossMerchantAssets()
  .catch(error => {
    console.error('❌ 检测失败:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
