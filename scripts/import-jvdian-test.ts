/**
 * 导入聚典爱格板工厂测试数据
 * 
 * 功能：
 * 1. 创建测试商家
 * 2. 导入商家分析报告（REPORT资产）
 * 3. 导入提示词模板（PROMPT资产）
 * 4. 输出可用于创建批次的信息
 */

import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

async function main() {
  console.log('🚀 开始导入聚典爱格板工厂测试数据...\n')

  // 1. 读取商家分析报告
  const reportPath = path.join(process.cwd(), 'docs', '商家分析报告.txt')
  
  if (!fs.existsSync(reportPath)) {
    console.error('❌ 错误：找不到 docs/商家分析报告.txt')
    console.error('   请确保文件存在')
    process.exit(1)
  }

  const reportContent = fs.readFileSync(reportPath, 'utf-8')
  console.log('✓ 读取商家分析报告成功')
  console.log(`  文件大小: ${(reportContent.length / 1024).toFixed(2)} KB\n`)

  // 2. 查找或创建商家
  let merchant = await prisma.merchant.findFirst({
    where: { 
      OR: [
        { name: { contains: '聚典' } },
        { uid: 'jvdian-test' }
      ]
    }
  })

  if (merchant) {
    console.log('✓ 找到现有商家:', merchant.name)
    console.log(`  商家ID: ${merchant.id}\n`)
  } else {
    merchant = await prisma.merchant.create({
      data: {
        uid: 'jvdian-test-' + Date.now(),
        name: '广西聚典爱格板工厂',
        description: '专注进口板材代工，官方授权爱格和可丽芙板材加工厂',
        businessType: 'B2B',
        status: 'ACTIVE',
        location: '广西南宁'
      }
    })
    console.log('✓ 创建新商家:', merchant.name)
    console.log(`  商家ID: ${merchant.id}\n`)
  }

  // 3. 检查是否已有报告资产
  const existingReport = await prisma.merchantPromptAsset.findFirst({
    where: {
      merchantId: merchant.id,
      type: 'REPORT',
      isActive: true
    }
  })

  let report
  if (existingReport) {
    console.log('✓ 找到现有报告资产')
    console.log(`  报告ID: ${existingReport.id}`)
    console.log(`  版本: v${existingReport.version}\n`)
    report = existingReport
  } else {
    // 创建报告资产
    report = await prisma.merchantPromptAsset.create({
      data: {
        merchantId: merchant.id,
        type: 'REPORT',
        title: '聚典爱格板工厂分析报告 v1',
        version: 1,
        content: reportContent,
        isActive: true,
        createdBy: 'system',
        metadata: {
          source: '手动导入',
          importedAt: new Date().toISOString()
        }
      }
    })
    console.log('✓ 创建报告资产成功')
    console.log(`  报告ID: ${report.id}`)
    console.log(`  版本: v${report.version}\n`)
  }

  // 4. 检查是否已有提示词资产
  const existingPrompt = await prisma.merchantPromptAsset.findFirst({
    where: {
      merchantId: merchant.id,
      type: 'PROMPT',
      isActive: true
    }
  })

  let prompt
  if (existingPrompt) {
    console.log('✓ 找到现有提示词资产')
    console.log(`  提示词ID: ${existingPrompt.id}`)
    console.log(`  版本: v${existingPrompt.version}\n`)
    prompt = existingPrompt
  } else {
    // 创建提示词资产（简化版，因为Worker已内置详细提示词）
    const promptContent = `请根据商家分析报告，生成5条口语化的短视频获客文案。

要求：
- 第1句喊话目标客户
- 第2句提出核心问题
- 用"你怕XX"句式打消顾虑
- 结尾明确行动召唤

5条文案分别为：
1. 痛点型（直击假货恐惧）
2. 实力型（展示设备和规模）
3. 对比型（源头工厂vs层层代理）
4. 科普型（讲解激光封边工艺）
5. 信任型（降低合作门槛）`

    prompt = await prisma.merchantPromptAsset.create({
      data: {
        merchantId: merchant.id,
        type: 'PROMPT',
        title: 'B2B短视频获客文案模板',
        version: 1,
        content: promptContent,
        isActive: true,
        createdBy: 'system',
        metadata: {
          style: 'b2b-conversational',
          targetLength: '250-350字'
        }
      }
    })
    console.log('✓ 创建提示词资产成功')
    console.log(`  提示词ID: ${prompt.id}`)
    console.log(`  版本: v${prompt.version}\n`)
  }

  // 5. 输出创建批次的信息
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ 数据导入完成！')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  console.log('📋 商家信息:')
  console.log(`   名称: ${merchant.name}`)
  console.log(`   ID:   ${merchant.id}`)
  console.log(`   位置: ${merchant.location || '-'}\n`)

  console.log('📄 资产信息:')
  console.log(`   报告ID:   ${report.id} (${report.title})`)
  console.log(`   提示词ID: ${prompt.id} (${prompt.title})\n`)

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎯 下一步操作:\n')

  console.log('方式1: 通过UI创建批次')
  console.log(`   1. 访问: http://localhost:3007/creative/merchants/${merchant.id}/batches`)
  console.log(`   2. 点击"创建批次"`)
  console.log(`   3. 选择报告和提示词`)
  console.log(`   4. 点击"生成"\n`)

  console.log('方式2: 通过API创建批次')
  console.log('   使用以下命令:\n')
  
  const curlCommand = `curl -X POST http://localhost:3007/api/creative/batches \\
  -H "Content-Type: application/json" \\
  -H "Cookie: YOUR_SESSION_COOKIE" \\
  -d '{
    "merchantId": "${merchant.id}",
    "assets": [
      { "role": "REPORT", "assetId": "${report.id}" },
      { "role": "PROMPT", "assetId": "${prompt.id}" }
    ]
  }'`

  console.log(curlCommand)
  console.log('\n   注意：需要替换 YOUR_SESSION_COOKIE 为你的登录cookie\n')

  console.log('方式3: 通过脚本创建批次')
  console.log(`   运行: npx tsx scripts/create-test-batch.ts ${merchant.id} ${report.id} ${prompt.id}\n`)

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('💡 提示:')
  console.log('   - 确保已配置 LLM_CLAUDE_SONNET_4_5_THINKING_KEY')
  console.log('   - 批次生成需要30-60秒')
  console.log('   - 生成完成后会显示"推荐Top 3"')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // 6. 保存信息到临时文件（方便后续使用）
  const infoPath = path.join(process.cwd(), '.jvdian-test-info.json')
  fs.writeFileSync(infoPath, JSON.stringify({
    merchantId: merchant.id,
    reportId: report.id,
    promptId: prompt.id,
    createdAt: new Date().toISOString()
  }, null, 2))
  console.log(`📝 测试信息已保存到: .jvdian-test-info.json\n`)
}

main()
  .catch((error) => {
    console.error('\n❌ 导入失败:', error.message)
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
