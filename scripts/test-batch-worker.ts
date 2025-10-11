#!/usr/bin/env tsx
/**
 * 测试批量文案生成 Worker
 * 
 * 创建测试数据 → 触发批次 → 验证结果
 */

import { prisma } from '@/lib/prisma'
import { createBatchWithAssets } from '@/lib/repositories/creative-batch-repository'
import { processBatch } from '@/lib/workers/creative-batch-worker'
import { CreativeBatchStatus } from '@prisma/client'

async function main() {
  console.log('=== 批量文案生成 Worker 测试 ===\n')

  // 1. 准备测试数据
  console.log('1. 创建测试商家...')
  const merchant = await prisma.merchant.upsert({
    where: { uid: 'test-merchant-001' },
    create: {
      uid: 'test-merchant-001',
      name: '测试餐厅',
      description: '一家主营川菜的中高端餐厅',
      businessType: 'B2C',
      status: 'ACTIVE'
    },
    update: {}
  })
  console.log(`✓ 商家: ${merchant.name} (${merchant.id})`)

  // 2. 创建商家报告（REPORT）
  console.log('\n2. 创建商家分析报告...')
  const report = await prisma.merchantPromptAsset.upsert({
    where: {
      merchantId_type_version: {
        merchantId: merchant.id,
        type: 'REPORT',
        version: 1
      }
    },
    create: {
      merchantId: merchant.id,
      type: 'REPORT',
      title: '商家分析报告 v1',
      version: 1,
      content: `# 测试餐厅 - 商家分析报告

## 商家定位
- **类型**: 中高端川菜餐厅
- **目标客群**: 25-45岁，中高收入，追求品质生活
- **核心卖点**: 正宗川菜，食材新鲜，环境优雅
- **价格区间**: 人均150-300元

## 竞争优势
1. 大厨来自成都老字号，手艺地道
2. 食材每日空运，新鲜有保障
3. 装修融合川蜀文化，氛围独特
4. 服务细致周到，注重细节

## 内容策略建议
- 强调正宗川菜传承
- 展示后厨食材处理过程
- 突出特色招牌菜
- 营造高品质用餐体验`,
      isActive: true,
      createdBy: 'test-script'
    },
    update: {}
  })
  console.log(`✓ 报告: ${report.title}`)

  // 3. 创建提示词模板（PROMPT）
  console.log('\n3. 创建提示词模板...')
  const promptTemplate = await prisma.merchantPromptAsset.upsert({
    where: {
      merchantId_type_version: {
        merchantId: merchant.id,
        type: 'PROMPT',
        version: 1
      }
    },
    create: {
      merchantId: merchant.id,
      type: 'PROMPT',
      title: '短视频文案模板 v1',
      version: 1,
      content: `请生成短视频文案，要求：

1. **开头**：3秒内抓住眼球，可以用悬念、痛点或惊喜
2. **正文**：60秒左右，讲述一个场景或故事
3. **结尾**：明确的行动号召（到店、关注、收藏等）

风格：
- 口语化，像朋友聊天
- 有画面感，适合配视频
- 有情感共鸣，引发互动

禁忌：
- 不要直接推销
- 不要夸大宣传
- 不要使用"绝对"、"第一"等绝对化用语`,
      isActive: true,
      createdBy: 'test-script'
    },
    update: {}
  })
  console.log(`✓ 模板: ${promptTemplate.title}`)

  // 4. 创建批次
  console.log('\n4. 创建生成批次...')
  const { batch } = await createBatchWithAssets({
    merchantId: merchant.id,
    triggeredBy: 'test-script',
    assets: [
      { role: 'REPORT', assetId: report.id },
      { role: 'PROMPT', assetId: promptTemplate.id }
    ],
    modelId: 'claude-sonnet-4-5-20250929'
  })
  console.log(`✓ 批次: ${batch.id}`)
  console.log(`  状态: ${batch.status}`)

  // 5. 触发 Worker 处理
  console.log('\n5. 触发 Worker 处理...')
  console.log('  (这将调用实际的 Claude API，需要有效的 API Key)')
  
  try {
    await processBatch({ batchId: batch.id })
    console.log('✓ Worker 处理完成')
  } catch (error: any) {
    console.error('✗ Worker 处理失败:', error.message)
    process.exit(1)
  }

  // 6. 检查结果
  console.log('\n6. 检查生成结果...')
  const updatedBatch = await prisma.creativeBatch.findUnique({
    where: { id: batch.id },
    include: {
      copies: {
        orderBy: { sequence: 'asc' }
      },
      exceptions: true
    }
  })

  if (!updatedBatch) {
    console.error('✗ 批次未找到')
    process.exit(1)
  }

  console.log(`\n批次最终状态: ${updatedBatch.status}`)
  console.log(`生成文案数量: ${updatedBatch.copies.length}/5`)

  if (updatedBatch.tokenUsage) {
    const usage = updatedBatch.tokenUsage as any
    console.log(`Token 使用量: ${usage.total || usage.prompt + usage.completion}`)
  }

  if (updatedBatch.copies.length > 0) {
    console.log('\n=== 生成的文案 ===')
    updatedBatch.copies.forEach(copy => {
      console.log(`\n--- 文案 ${copy.sequence} ---`)
      console.log(copy.markdownContent.substring(0, 200))
      if (copy.markdownContent.length > 200) {
        console.log('...')
      }
    })
  }

  if (updatedBatch.exceptions.length > 0) {
    console.log('\n=== 异常记录 ===')
    updatedBatch.exceptions.forEach(ex => {
      console.log(`- ${ex.errorCode}: ${JSON.stringify(ex.errorDetail)}`)
    })
  }

  // 7. 验证状态逻辑
  console.log('\n7. 验证状态逻辑...')
  const copiesCount = updatedBatch.copies.length

  let expectedStatus: CreativeBatchStatus
  if (copiesCount === 5) {
    expectedStatus = CreativeBatchStatus.SUCCEEDED
  } else if (copiesCount > 0) {
    expectedStatus = CreativeBatchStatus.PARTIAL_SUCCESS
  } else {
    expectedStatus = CreativeBatchStatus.FAILED
  }

  if (updatedBatch.status === expectedStatus) {
    console.log(`✓ 状态正确: ${updatedBatch.status}`)
  } else {
    console.error(`✗ 状态错误: 期望 ${expectedStatus}, 实际 ${updatedBatch.status}`)
    process.exit(1)
  }

  // 8. 验证 sequence 约束
  console.log('\n8. 验证 sequence 约束...')
  const invalidSequences = updatedBatch.copies.filter(c => c.sequence < 1 || c.sequence > 5)
  
  if (invalidSequences.length > 0) {
    console.error(`✗ 发现越界 sequence: ${invalidSequences.map(c => c.sequence).join(', ')}`)
    process.exit(1)
  } else {
    console.log('✓ 所有 sequence 在 [1, 5] 范围内')
  }

  console.log('\n=== 测试完成 ===')
  console.log('✓ Worker 实现正确')
  console.log('✓ PARTIAL_SUCCESS 失败策略生效')
  console.log('✓ sequence 约束已验证')
}

main()
  .catch(e => {
    console.error('测试失败:', e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
