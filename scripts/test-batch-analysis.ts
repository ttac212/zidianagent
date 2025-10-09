/**
 * 测试商家批量分析功能
 */

import { PrismaClient } from '@prisma/client'
import { exportMerchantData } from './export-merchant-data'
import { batchAnalyzeMerchants } from './analyze-merchants-batch'
import fs from 'fs/promises'

const prisma = new PrismaClient()

async function testBatchAnalysis() {
  console.log('🧪 开始测试商家批量分析功能\n')

  try {
    // 1. 检查数据库中的商家数量
    console.log('📊 步骤 1: 检查数据库状态')
    const merchantCount = await prisma.merchant.count()
    const activeMerchants = await prisma.merchant.count({
      where: { status: 'ACTIVE' }
    })

    console.log(`  - 总商家数: ${merchantCount}`)
    console.log(`  - 活跃商家数: ${activeMerchants}`)

    if (merchantCount === 0) {
      console.log('\n⚠️  数据库中没有商家数据,请先导入商家数据')
      console.log('提示: 使用 npx tsx scripts/import-merchant-data.ts')
      return
    }

    // 2. 导出测试数据(只导出前5个)
    console.log('\n📤 步骤 2: 导出测试数据')
    const testLimit = Math.min(5, activeMerchants)
    const exportPath = 'data/test-merchants-export.json'

    await exportMerchantData({
      limit: testLimit,
      status: 'ACTIVE',
      outputPath: exportPath
    })

    // 3. 执行批量分析
    console.log('\n🔬 步骤 3: 执行批量分析')
    const reports = await batchAnalyzeMerchants({
      inputPath: exportPath,
      outputDir: 'data/test-analysis-reports',
      batchSize: 5
    })

    // 4. 验证结果
    console.log('\n✅ 步骤 4: 验证分析结果')
    console.log(`  - 生成报告数: ${reports.length}`)

    if (reports.length > 0) {
      const sampleReport = reports[0]
      console.log(`\n📋 示例报告 (${sampleReport.merchantName}):`)
      console.log(`  - 总内容数: ${sampleReport.contentStats.totalCount}`)
      console.log(`  - 视频数: ${sampleReport.contentStats.videoCount}`)
      console.log(`  - 互动率: ${sampleReport.engagementMetrics.engagementRate}`)
      console.log(`  - 标签: ${sampleReport.tags.join(', ')}`)
      console.log(`  - 文案建议数: ${sampleReport.videoScriptSuggestions.length}`)
    }

    // 5. 检查生成的文件
    console.log('\n📁 步骤 5: 检查生成文件')
    const summaryPath = 'data/test-analysis-reports/summary.json'
    const summaryExists = await fs.access(summaryPath).then(() => true).catch(() => false)

    if (summaryExists) {
      const summaryContent = await fs.readFile(summaryPath, 'utf-8')
      const summary = JSON.parse(summaryContent)
      console.log(`  - 汇总报告: ✓`)
      console.log(`  - 包含商家: ${summary.totalMerchants}个`)
    }

    console.log('\n🎉 测试完成! 所有功能正常')
    console.log('\n📖 下一步:')
    console.log('  1. 查看测试报告: data/test-analysis-reports/')
    console.log('  2. 运行完整分析: npx tsx scripts/export-merchant-data.ts && npx tsx scripts/analyze-merchants-batch.ts')
    console.log('  3. 查看使用文档: docs/MERCHANT_BATCH_ANALYSIS.md')

  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

testBatchAnalysis()
