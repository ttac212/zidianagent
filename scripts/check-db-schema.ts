#!/usr/bin/env tsx
/**
 * 检查数据库当前schema状态
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkSchema() {
  try {
    console.log('🔍 检查 CreativeBatch 表结构...\n')

    // 1. 尝试查询是否有任何批次数据
    const totalBatches = await prisma.creativeBatch.count()
    console.log(`📊 批次总数: ${totalBatches}`)

    if (totalBatches > 0) {
      // 2. 查询一条数据,查看实际字段
      const sample = await prisma.creativeBatch.findFirst({
        include: {
          merchant: { select: { name: true } },
          _count: { select: { copies: true } }
        }
      })

      console.log('\n✅ 样本批次数据:')
      console.log(JSON.stringify(sample, null, 2))

      // 3. 检查新字段是否存在
      const hasTargetSequence = 'targetSequence' in sample!
      const hasAppendPrompt = 'appendPrompt' in sample!
      const hasCopyCount = '_count' in sample! && 'copies' in sample!._count
      
      console.log(`\n🔧 新字段状态:`)
      console.log(`  - targetSequence: ${hasTargetSequence ? '✅ 存在' : '❌ 缺失'} (值: ${sample!.targetSequence ?? 'null'})`)
      console.log(`  - appendPrompt: ${hasAppendPrompt ? '✅ 存在' : '❌ 缺失'} (值: ${sample!.appendPrompt ?? 'null'})`)
      console.log(`  - copyCount: ${hasCopyCount ? '✅ 通过_count.copies计算' : '❌ 缺失'} (值: ${sample!._count.copies})`)

      // 4. 检查是否还有旧字段（运行时无法直接检测，但可以通过错误判断）
      console.log(`\n📝 注意: 旧字段(metadata/statusVersion)在TypeScript类型中已删除`)
    } else {
      console.log('\n⚠️  数据库为空，无法验证Schema')
    }

    // 5. 检查 MerchantPromptAsset
    console.log('\n🔍 检查 MerchantPromptAsset 表结构...')
    const totalAssets = await prisma.merchantPromptAsset.count()
    console.log(`📊 素材总数: ${totalAssets}`)

    if (totalAssets > 0) {
      const assetSample = await prisma.merchantPromptAsset.findFirst()
      console.log('\n✅ 样本素材数据:')
      console.log(JSON.stringify(assetSample, null, 2))
    }

  } catch (error: any) {
    console.error('❌ 检查失败:', error.message)
    
    if (error.message.includes('Unknown field')) {
      console.error('\n💡 提示: 数据库Schema与Prisma Client不匹配')
      console.error('   运行: pnpm db:push 同步Schema')
    }
  } finally {
    await prisma.$disconnect()
  }
}

checkSchema()
