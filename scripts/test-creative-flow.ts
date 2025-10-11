/**
 * 批量文案生成系统 - 端到端测试脚本
 * 
 * 测试流程：
 * 1. 创建商家资料（报告、提示词）
 * 2. 创建批次（不触发 Worker）
 * 3. 验证批次详情
 * 4. 验证文案版本历史
 * 5. 导出验证
 */

import { prisma } from '../lib/prisma'
import { createPromptAssetVersion } from '../lib/repositories/prompt-asset-repository'

const TEST_MERCHANT_ID = 'test-merchant-001'
const TEST_USER_ID = 'test-user-001'

async function main() {
  console.log('=== 批量文案生成系统测试 ===\n')

  // 1. 创建测试商家（如果不存在）
  console.log('1. 检查测试商家...')
  let merchant = await prisma.merchant.findUnique({
    where: { id: TEST_MERCHANT_ID }
  })

  if (!merchant) {
    merchant = await prisma.merchant.create({
      data: {
        id: TEST_MERCHANT_ID,
        uid: TEST_MERCHANT_ID,
        name: '测试商家',
        description: '批量文案生成测试商家',
        businessType: 'B2C',
        location: 'TEST'
      }
    })
    console.log('✓ 创建测试商家:', merchant.id)
  } else {
    console.log('✓ 测试商家已存在:', merchant.id)
  }

  // 2. 创建商家报告
  console.log('\n2. 创建商家报告...')
  const report = await createPromptAssetVersion({
    merchantId: TEST_MERCHANT_ID,
    type: 'REPORT',
    title: '测试商家报告 v1',
    content: '商家主营业务：测试产品\n目标客户：测试用户\n品牌定位：高质量测试',
    createdBy: TEST_USER_ID,
    activate: true
  })
  console.log('✓ 创建商家报告:', report.id, 'v' + report.version)

  // 3. 创建提示词模板
  console.log('\n3. 创建提示词模板...')
  const prompt = await createPromptAssetVersion({
    merchantId: TEST_MERCHANT_ID,
    type: 'PROMPT',
    title: '测试提示词模板 v1',
    content: '请生成5条推广文案，要求：\n1. 突出产品特点\n2. 语气活泼\n3. 包含行动号召',
    createdBy: TEST_USER_ID,
    activate: true
  })
  console.log('✓ 创建提示词模板:', prompt.id, 'v' + prompt.version)

  // 4. 创建批次（不触发 Worker）
  console.log('\n4. 创建测试批次...')
  const batch = await prisma.creativeBatch.create({
    data: {
      merchantId: TEST_MERCHANT_ID,
      status: 'SUCCEEDED',
      statusVersion: 3,
      modelId: 'claude-sonnet-4-5-20250929',
      triggeredBy: TEST_USER_ID,
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(),
      tokenUsage: {
        prompt: 1200,
        completion: 1600,
        total: 2800
      }
    }
  })
  console.log('✓ 创建批次:', batch.id)

  // 5. 创建批次资产关联
  console.log('\n5. 创建批次资产关联...')
  await prisma.creativeBatchAsset.createMany({
    data: [
      {
        batchId: batch.id,
        role: 'REPORT',
        promptAssetId: report.id,
        isEnabled: true,
        sortOrder: 1
      },
      {
        batchId: batch.id,
        role: 'PROMPT',
        promptAssetId: prompt.id,
        isEnabled: true,
        sortOrder: 2
      }
    ]
  })
  console.log('✓ 创建2个资产关联')

  // 6. 创建测试文案
  console.log('\n6. 创建测试文案...')
  for (let i = 1; i <= 3; i++) {
    const copy = await prisma.creativeCopy.create({
      data: {
        batchId: batch.id,
        sequence: i,
        state: 'DRAFT',
        markdownContent: `# 测试文案 ${i}\n\n这是第${i}条测试文案的内容。\n\n特点：\n- 突出产品优势\n- 吸引用户关注\n- 促进转化`,
        rawModelOutput: { content: `测试文案${i}` },
        contentVersion: 1
      }
    })

    // 创建初始版本记录
    await prisma.creativeCopyRevision.create({
      data: {
        copyId: copy.id,
        version: 1,
        content: copy.markdownContent,
        source: 'MODEL',
        createdBy: 'system'
      }
    })

    console.log(`✓ 创建文案 ${i}:`, copy.id)
  }

  // 7. 验证批次详情
  console.log('\n7. 验证批次详情...')
  const batchDetail = await prisma.creativeBatch.findUnique({
    where: { id: batch.id },
    include: {
      assets: true,
      copies: {
        include: {
          revisions: true
        }
      }
    }
  })

  console.log('✓ 批次状态:', batchDetail?.status)
  console.log('✓ 文案数量:', batchDetail?.copies.length, '/5')
  console.log('✓ Token用量:', batchDetail?.tokenUsage)
  console.log('✓ 资产数量:', batchDetail?.assets.length)

  // 8. 模拟编辑文案（创建新版本）
  console.log('\n8. 测试文案编辑（创建新版本）...')
  const firstCopy = await prisma.creativeCopy.findFirst({
    where: { batchId: batch.id },
    orderBy: { sequence: 'asc' }
  })

  if (firstCopy) {
    const updatedCopy = await prisma.creativeCopy.update({
      where: { id: firstCopy.id },
      data: {
        userOverride: `# 编辑后的文案 ${firstCopy.sequence}\n\n这是经过手动编辑的内容。\n\n改进：\n- 更精准的表达\n- 更吸引人的标题`,
        contentVersion: 2,
        editedBy: TEST_USER_ID,
        editedAt: new Date()
      }
    })

    await prisma.creativeCopyRevision.create({
      data: {
        copyId: updatedCopy.id,
        version: 2,
        content: updatedCopy.userOverride!,
        source: 'USER',
        note: '手动优化标题和内容',
        createdBy: TEST_USER_ID
      }
    })

    console.log('✓ 文案编辑成功，版本:', updatedCopy.contentVersion)
  }

  // 9. 验证版本历史
  console.log('\n9. 验证版本历史...')
  if (firstCopy) {
    const revisions = await prisma.creativeCopyRevision.findMany({
      where: { copyId: firstCopy.id },
      orderBy: { version: 'asc' }
    })

    console.log('✓ 版本数量:', revisions.length)
    revisions.forEach(rev => {
      console.log(`  - v${rev.version}: ${rev.source}${rev.note ? ' (' + rev.note + ')' : ''}`)
    })
  }

  // 10. 测试资料版本管理
  console.log('\n10. 测试资料版本管理...')
  const report_v2 = await createPromptAssetVersion({
    merchantId: TEST_MERCHANT_ID,
    type: 'REPORT',
    title: '测试商家报告 v2',
    content: '更新后的商家报告内容...',
    createdBy: TEST_USER_ID,
    parentId: report.id,
    activate: true
  })
  console.log('✓ 创建报告新版本:', report_v2.id, 'v' + report_v2.version)

  const allReports = await prisma.merchantPromptAsset.findMany({
    where: {
      merchantId: TEST_MERCHANT_ID,
      type: 'REPORT'
    },
    orderBy: { version: 'desc' }
  })
  console.log('✓ 报告版本总数:', allReports.length)
  console.log('✓ 当前活动版本:', allReports.find(r => r.isActive)?.version)

  console.log('\n=== 测试完成 ===')
  console.log('\n测试数据：')
  console.log('- 商家ID:', TEST_MERCHANT_ID)
  console.log('- 批次ID:', batch.id)
  console.log('- 报告ID:', report.id)
  console.log('- 提示词ID:', prompt.id)
  console.log('\n手动测试：')
  console.log('1. 启动开发服务器: pnpm dev')
  console.log('2. 访问批次详情页: http://localhost:3007/creative/batches/' + batch.id)
  console.log('3. 访问资料管理页: http://localhost:3007/creative/merchants/' + TEST_MERCHANT_ID + '/assets')
}

main()
  .then(() => {
    console.log('\n✓ 测试脚本执行成功')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n✗ 测试失败:', err)
    process.exit(1)
  })
