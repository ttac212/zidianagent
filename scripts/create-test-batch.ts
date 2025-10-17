/**
 * 创建测试批次脚本
 * 
 * 用法：
 * npx tsx scripts/create-test-batch.ts [merchantId] [reportId] [promptId]
 * 
 * 如果不提供参数，会从 .jvdian-test-info.json 读取
 */

import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

async function main() {
  let merchantId: string
  let reportId: string
  let promptId: string

  // 从命令行参数或info文件读取
  if (process.argv.length >= 5) {
    merchantId = process.argv[2]
    reportId = process.argv[3]
    promptId = process.argv[4]
    console.log('✓ 使用命令行参数\n')
  } else {
    const infoPath = path.join(process.cwd(), '.jvdian-test-info.json')
    if (!fs.existsSync(infoPath)) {
      console.error('❌ 错误：找不到 .jvdian-test-info.json')
      console.error('   请先运行: npx tsx scripts/import-jvdian-test.ts')
      process.exit(1)
    }

    const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'))
    merchantId = info.merchantId
    reportId = info.reportId
    promptId = info.promptId
    console.log('✓ 从 .jvdian-test-info.json 读取配置\n')
  }

  console.log('📋 批次配置:')
  console.log(`   商家ID: ${merchantId}`)
  console.log(`   报告ID: ${reportId}`)
  console.log(`   提示词ID: ${promptId}\n`)

  // 验证资产存在
  const report = await prisma.merchantPromptAsset.findUnique({
    where: { id: reportId }
  })
  const prompt = await prisma.merchantPromptAsset.findUnique({
    where: { id: promptId }
  })

  if (!report || !prompt) {
    console.error('❌ 错误：找不到指定的资产')
    process.exit(1)
  }

  console.log('✓ 验证资产存在')
  console.log(`   报告: ${report.title}`)
  console.log(`   提示词: ${prompt.title}\n`)

  // 创建批次
  console.log('🚀 创建批次...\n')

  const batch = await prisma.creativeBatch.create({
    data: {
      merchantId,
      status: 'QUEUED',
      modelId: 'claude-sonnet-4-5-20250805',
      triggeredBy: 'script'
    }
  })

  console.log('✓ 批次创建成功')
  console.log(`   批次ID: ${batch.id}\n`)

  // 关联资产
  await prisma.creativeBatchAsset.createMany({
    data: [
      {
        batchId: batch.id,
        promptAssetId: reportId,
        isEnabled: true,
        sortOrder: 0
      },
      {
        batchId: batch.id,
        promptAssetId: promptId,
        isEnabled: true,
        sortOrder: 1
      }
    ]
  })

  console.log('✓ 资产关联成功\n')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ 批次创建完成！')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  console.log('📊 批次信息:')
  console.log(`   ID:     ${batch.id}`)
  console.log(`   状态:   ${batch.status}`)
  console.log(`   模型:   ${batch.modelId}\n`)

  console.log('🎯 下一步操作:\n')

  console.log('1. 查看批次详情:')
  console.log(`   http://localhost:3007/creative/batches/${batch.id}\n`)

  console.log('2. Worker会自动处理批次:')
  console.log('   - 状态: QUEUED → RUNNING → SUCCEEDED')
  console.log('   - 预计耗时: 30-60秒')
  console.log('   - 生成5条文案\n')

  console.log('3. 生成完成后会显示:')
  console.log('   - 推荐Top 3（痛点型、实力型、信任型）')
  console.log('   - 5条完整文案\n')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('⚠️  重要提示:')
  console.log('   确保 Worker 正在运行（开发环境自动运行）')
  console.log('   确保配置了 LLM_CLAUDE_SONNET_4_5_THINKING_KEY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // 保存批次ID
  const batchInfoPath = path.join(process.cwd(), '.jvdian-batch-info.json')
  fs.writeFileSync(batchInfoPath, JSON.stringify({
    batchId: batch.id,
    merchantId,
    createdAt: new Date().toISOString()
  }, null, 2))
  console.log(`📝 批次信息已保存到: .jvdian-batch-info.json\n`)
}

main()
  .catch((error) => {
    console.error('\n❌ 创建失败:', error.message)
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
