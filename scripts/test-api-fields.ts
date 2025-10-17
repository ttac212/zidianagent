#!/usr/bin/env tsx
/**
 * 测试API字段完整性（无需认证）
 */

import { prisma } from '../lib/prisma'

async function testAPIFields() {
  console.log('🧪 测试批次API字段结构...\n')

  try {
    // 1. 获取批次列表（模拟API查询）
    console.log('1️⃣ 测试批次列表查询...')
    const batches = await prisma.creativeBatch.findMany({
      where: { merchantId: 'test-merchant-001' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        parent: { select: { id: true, status: true } },
        _count: {
          select: {
            copies: true,
            exceptions: true
          }
        }
      }
    })

    if (batches.length === 0) {
      console.log('⚠️  没有找到批次数据')
      return
    }

    const batch = batches[0]
    console.log('✅ 找到批次:', batch.id)
    console.log('📊 字段验证:')
    console.log(`  - id: ${batch.id} (${typeof batch.id})`)
    console.log(`  - merchantId: ${batch.merchantId} (${typeof batch.merchantId})`)
    console.log(`  - status: ${batch.status} (${typeof batch.status})`)
    console.log(`  - targetSequence: ${batch.targetSequence} (${typeof batch.targetSequence})`)
    console.log(`  - appendPrompt: ${batch.appendPrompt} (${typeof batch.appendPrompt})`)
    console.log(`  - copyCount (from _count): ${batch._count.copies} (${typeof batch._count.copies})`)
    console.log(`  - parentBatchId: ${batch.parentBatchId} (${typeof batch.parentBatchId})`)

    // 2. 模拟API响应格式
    console.log('\n2️⃣ 模拟API响应结构...')
    const apiResponse = {
      id: batch.id,
      merchantId: batch.merchantId,
      parentBatchId: batch.parentBatchId,
      targetSequence: batch.targetSequence,
      parentStatus: batch.parent?.status ?? null,
      status: batch.status,
      modelId: batch.modelId,
      triggeredBy: batch.triggeredBy,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
      createdAt: batch.createdAt,
      copyCount: batch._count.copies,
      exceptionCount: batch._count.exceptions
    }

    console.log('✅ API响应示例:')
    console.log(JSON.stringify(apiResponse, null, 2))

    // 3. 测试批次详情查询
    console.log('\n3️⃣ 测试批次详情查询...')
    const detail = await prisma.creativeBatch.findUnique({
      where: { id: batch.id },
      include: {
        merchant: { select: { id: true, name: true } },
        copies: {
          orderBy: { sequence: 'asc' },
          select: {
            id: true,
            sequence: true,
            markdownContent: true,
            state: true,
            contentVersion: true,
            editedAt: true
          }
        },
        parent: {
          select: { id: true, status: true, createdAt: true }
        },
        _count: { select: { copies: true } }
      }
    })

    console.log('✅ 批次详情字段:')
    console.log(`  - targetSequence: ${detail!.targetSequence}`)
    console.log(`  - appendPrompt: ${detail!.appendPrompt}`)
    console.log(`  - copyCount: ${detail!._count.copies}`)
    console.log(`  - copies数组长度: ${detail!.copies.length}`)
    console.log(`  - merchant.name: ${detail!.merchant.name}`)

    // 4. 创建带新字段的批次（模拟单条再生成）
    console.log('\n4️⃣ 测试创建带targetSequence和appendPrompt的批次...')
    const newBatch = await prisma.creativeBatch.create({
      data: {
        merchantId: 'test-merchant-001',
        parentBatchId: batch.id,
        targetSequence: 2,  // 单条再生成第2条
        appendPrompt: '强调性价比和品质',
        status: 'QUEUED',
        modelId: 'claude-sonnet-4-5-20250929',
        triggeredBy: 'api-test'
      }
    })

    console.log('✅ 新批次创建成功:')
    console.log(`  - ID: ${newBatch.id}`)
    console.log(`  - targetSequence: ${newBatch.targetSequence}`)
    console.log(`  - appendPrompt: ${newBatch.appendPrompt}`)
    console.log(`  - parentBatchId: ${newBatch.parentBatchId}`)

    // 5. 查询验证
    console.log('\n5️⃣ 查询验证新批次...')
    const fetched = await prisma.creativeBatch.findUnique({
      where: { id: newBatch.id },
      include: {
        parent: { select: { id: true } },
        _count: { select: { copies: true } }
      }
    })

    console.log('✅ 查询结果:')
    console.log(`  - targetSequence: ${fetched!.targetSequence} (期望: 2)`)
    console.log(`  - appendPrompt: ${fetched!.appendPrompt} (期望: 强调性价比和品质)`)
    console.log(`  - parentBatchId: ${fetched!.parentBatchId} (期望: ${batch.id})`)

    // 验证值是否正确
    const allTestsPassed = 
      fetched!.targetSequence === 2 &&
      fetched!.appendPrompt === '强调性价比和品质' &&
      fetched!.parentBatchId === batch.id

    if (allTestsPassed) {
      console.log('\n🎉 所有API字段测试通过！')
    } else {
      console.log('\n❌ 部分测试失败')
    }

    // 清理测试数据
    await prisma.creativeBatch.delete({ where: { id: newBatch.id } })
    console.log('\n✅ 清理测试数据完成')

  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testAPIFields()
