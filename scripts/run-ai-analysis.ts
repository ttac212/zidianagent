/**
 * 运行AI深度分析的命令行脚本
 *
 * 使用方法:
 * 1. 单个商家分析（从数据库）:
 *    npx tsx scripts/run-ai-analysis.ts merchant <merchantId>
 *
 * 2. 批量分析（从导出文件）:
 *    npx tsx scripts/run-ai-analysis.ts batch [inputPath] [outputDir]
 *
 * 3. 测试分析（使用测试数据）:
 *    npx tsx scripts/run-ai-analysis.ts test
 */

// 加载环境变量
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
import fs from 'fs/promises'
import { performAIDeepAnalysis, batchAIAnalysis } from './ai-deep-analysis'
import type { AIAnalysisRequest } from '@/types/merchant-analysis'

const prisma = new PrismaClient()

/**
 * 从数据库分析单个商家
 */
async function analyzeSingleMerchant(merchantId: string) {
  console.log(`\n🔍 查询商家: ${merchantId}`)

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: {
      category: true,
      contents: {
        where: {
          hasTranscript: true,
        },
        orderBy: { publishedAt: 'desc' },
        take: 10,
      },
    },
  })

  if (!merchant) {
    throw new Error(`商家不存在: ${merchantId}`)
  }

  console.log(`✅ 找到商家: ${merchant.name}`)
  console.log(`   - 有转录的内容数: ${merchant.contents.length}`)

  if (merchant.contents.length === 0) {
    throw new Error('该商家没有带转录文本的内容')
  }

  // 构建分析请求
  const request: AIAnalysisRequest = {
    merchantId: merchant.id,
    merchantName: merchant.name,
    transcripts: merchant.contents.map((c) => ({
      title: c.title,
      content: c.transcript || '',
      engagement: {
        diggCount: c.diggCount,
        commentCount: c.commentCount,
        collectCount: c.collectCount,
        shareCount: c.shareCount,
      },
    })),
    basicStats: {
      category: merchant.category?.name,
      location: merchant.location,
      businessType: merchant.businessType,
      totalContentCount: merchant.totalContentCount,
      totalEngagement:
        merchant.totalDiggCount +
        merchant.totalCommentCount +
        merchant.totalCollectCount +
        merchant.totalShareCount,
    },
    analysisDepth: 'comprehensive',
  }

  // 执行分析
  const response = await performAIDeepAnalysis(request)

  if (!response.success || !response.report) {
    throw new Error(`分析失败: ${response.error}`)
  }

  // 保存报告
  const outputDir = 'data/ai-analysis-reports'
  await fs.mkdir(outputDir, { recursive: true })

  const filename = `${merchant.uid}_${merchant.name.replace(/[\/\\:*?"<>|]/g, '_')}_AI.json`
  const filepath = path.join(outputDir, filename)

  await fs.writeFile(filepath, JSON.stringify(response.report, null, 2), 'utf-8')

  console.log(`\n✅ AI分析完成!`)
  console.log(`📄 报告已保存: ${filepath}`)

  return response.report
}

/**
 * 批量分析（从导出文件）
 */
async function analyzeBatch(inputPath: string, outputDir: string) {
  console.log(`\n📖 读取商家数据: ${inputPath}`)

  const data = await fs.readFile(inputPath, 'utf-8')
  const merchants = JSON.parse(data)

  console.log(`✅ 读取到 ${merchants.length} 个商家`)

  // 执行批量分析
  const reports = await batchAIAnalysis({
    merchants,
    analysisDepth: 'comprehensive',
    skipNoTranscript: true,
  })

  // 确保输出目录存在
  await fs.mkdir(outputDir, { recursive: true })

  // 保存每个报告
  for (const report of reports) {
    const merchant = merchants.find((m: any) => m.id === report.merchantId)
    const filename = `${merchant.uid}_${report.merchantName.replace(/[\/\\:*?"<>|]/g, '_')}_AI.json`
    const filepath = path.join(outputDir, filename)

    await fs.writeFile(filepath, JSON.stringify(report, null, 2), 'utf-8')
    console.log(`   ✓ 保存: ${filename}`)
  }

  // 保存汇总
  const summaryPath = path.join(outputDir, 'ai-analysis-summary.json')
  await fs.writeFile(
    summaryPath,
    JSON.stringify(
      {
        totalAnalyzed: reports.length,
        analysisDate: new Date().toISOString(),
        merchants: reports.map((r) => ({
          merchantId: r.merchantId,
          merchantName: r.merchantName,
          mainBusiness: r.basicInfo.mainBusiness,
          tokensUsed: r.aiMetadata.analysisTokens,
          confidence: r.aiMetadata.confidence,
        })),
      },
      null,
      2
    ),
    'utf-8'
  )

  console.log(`\n✅ 批量分析完成!`)
  console.log(`📁 报告目录: ${outputDir}`)
  console.log(`📄 成功分析: ${reports.length} 个商家`)
  console.log(`📋 汇总报告: ${summaryPath}`)
}

/**
 * 测试分析（使用测试数据）
 */
async function testAnalysis() {
  console.log(`\n🧪 测试AI分析功能`)

  const testData = 'data/test-merchants-export.json'

  try {
    await fs.access(testData)
  } catch {
    throw new Error(`测试数据不存在: ${testData}，请先运行 npx tsx scripts/export-merchant-data.ts 5 ACTIVE data/test-merchants-export.json`)
  }

  // 使用测试数据的第一个商家
  const data = await fs.readFile(testData, 'utf-8')
  const merchants = JSON.parse(data)

  if (merchants.length === 0) {
    throw new Error('测试数据为空')
  }

  console.log(`\n使用测试商家: ${merchants[0].name}`)

  // 模拟添加转录文本（因为测试数据可能没有）
  const testMerchant = {
    ...merchants[0],
    recentContents: merchants[0].recentContents.map((c: any) => ({
      ...c,
      transcript: c.title, // 临时使用标题作为转录文本
    })),
  }

  const request: AIAnalysisRequest = {
    merchantId: testMerchant.id,
    merchantName: testMerchant.name,
    transcripts: testMerchant.recentContents.map((c: any) => ({
      title: c.title,
      content: c.transcript,
      engagement: {
        diggCount: c.diggCount,
        commentCount: c.commentCount,
        collectCount: 0,
        shareCount: 0,
      },
    })),
    basicStats: {
      category: testMerchant.category,
      location: testMerchant.location,
      businessType: testMerchant.businessType,
      totalContentCount: testMerchant.totalContentCount,
      totalEngagement: testMerchant.totalDiggCount + testMerchant.totalCommentCount,
    },
    analysisDepth: 'basic',
  }

  const response = await performAIDeepAnalysis(request)

  if (!response.success) {
    throw new Error(`测试失败: ${response.error}`)
  }

  console.log(`\n✅ 测试成功!`)
  console.log(`\n📊 分析结果预览:`)
  console.log(`   - 主营业务: ${response.report?.basicInfo.mainBusiness}`)
  console.log(`   - 核心产品: ${response.report?.basicInfo.coreProducts.join(', ')}`)
  console.log(`   - 使用Token: ${response.report?.aiMetadata.analysisTokens}`)
  console.log(`   - 置信度: ${response.report?.aiMetadata.confidence}`)

  // 保存测试报告
  const testOutputPath = 'data/test-ai-analysis.json'
  await fs.writeFile(testOutputPath, JSON.stringify(response.report, null, 2), 'utf-8')
  console.log(`\n📄 测试报告已保存: ${testOutputPath}`)
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  try {
    switch (command) {
      case 'merchant': {
        const merchantId = args[1]
        if (!merchantId) {
          throw new Error('请提供商家ID: npx tsx scripts/run-ai-analysis.ts merchant <merchantId>')
        }
        await analyzeSingleMerchant(merchantId)
        break
      }

      case 'batch': {
        const inputPath = args[1] || 'data/merchants-export.json'
        const outputDir = args[2] || 'data/ai-analysis-reports'
        await analyzeBatch(inputPath, outputDir)
        break
      }

      case 'test': {
        await testAnalysis()
        break
      }

      default: {
        console.log(`
AI深度分析脚本

使用方法:
  1. 单个商家分析（从数据库）:
     npx tsx scripts/run-ai-analysis.ts merchant <merchantId>

  2. 批量分析（从导出文件）:
     npx tsx scripts/run-ai-analysis.ts batch [inputPath] [outputDir]
     默认: inputPath=data/merchants-export.json, outputDir=data/ai-analysis-reports

  3. 测试分析:
     npx tsx scripts/run-ai-analysis.ts test

示例:
  npx tsx scripts/run-ai-analysis.ts merchant cmewpn33d02wowtns3dray1dn
  npx tsx scripts/run-ai-analysis.ts batch data/merchants-export.json data/reports
  npx tsx scripts/run-ai-analysis.ts test
        `)
      }
    }
  } catch (error) {
    console.error('\n❌ 错误:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

export { analyzeSingleMerchant, analyzeBatch, testAnalysis }
