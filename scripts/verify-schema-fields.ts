#!/usr/bin/env tsx
/**
 * 直接验证数据库字段是否存在
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verify() {
  try {
    console.log('🔍 验证 CreativeBatch Schema字段...\n')

    // 创建测试批次
    const testBatch = await prisma.creativeBatch.create({
      data: {
        merchantId: 'test-merchant-001',
        status: 'QUEUED',
        modelId: 'test-model',
        triggeredBy: 'schema-test',
        targetSequence: 3,  // 测试新字段
        appendPrompt: '测试追加Prompt'  // 测试新字段
      }
    })

    console.log('✅ 成功创建测试批次:')
    console.log(`  - ID: ${testBatch.id}`)
    console.log(`  - targetSequence: ${testBatch.targetSequence} (类型: ${typeof testBatch.targetSequence})`)
    console.log(`  - appendPrompt: ${testBatch.appendPrompt} (类型: ${typeof testBatch.appendPrompt})`)
    
    // 查询验证
    const fetched = await prisma.creativeBatch.findUnique({
      where: { id: testBatch.id },
      include: { _count: { select: { copies: true } } }
    })

    console.log('\n✅ 查询验证成功:')
    console.log(`  - targetSequence: ${fetched!.targetSequence}`)
    console.log(`  - appendPrompt: ${fetched!.appendPrompt}`)
    console.log(`  - copyCount (计算): ${fetched!._count.copies}`)

    // 清理
    await prisma.creativeBatch.delete({ where: { id: testBatch.id } })

    console.log('\n🎉 Schema验证通过！所有新字段正常工作。')
    
  } catch (error: any) {
    console.error('❌ 验证失败:', error.message)
    if (error.code === 'P2010') {
      console.error('\n💡 提示: 字段不存在于数据库，需要运行: pnpm db:push')
    }
  } finally {
    await prisma.$disconnect()
  }
}

verify()
