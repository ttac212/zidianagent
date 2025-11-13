/**
 * 商家客群分析测试脚本
 *
 * 用途：
 * - 测试客群分析Pipeline完整流程
 * - 验证数据库持久化
 * - 查看分析结果
 *
 * 运行：
 * npx tsx scripts/test-audience-analysis.ts <merchantId>
 */

// 加载环境变量
import dotenv from 'dotenv'
import path from 'path'

// 显式加载 .env.local 文件
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { runAudienceAnalysisPipeline } from '@/lib/merchant/audience-analysis-pipeline'
import { prisma } from '@/lib/prisma'

const merchantId = process.argv[2]

if (!merchantId) {
  console.error('❌ 请提供商家ID')
  console.log('用法: npx tsx scripts/test-audience-analysis.ts <merchantId>')
  process.exit(1)
}

async function main() {
  console.log('🚀 开始客群分析测试...')
  console.log(`商家ID: ${merchantId}`)
  console.log('')

  // 1. 检查商家是否存在
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          contents: true
        }
      }
    }
  })

  if (!merchant) {
    console.error('❌ 商家不存在')
    process.exit(1)
  }

  console.log(`商家名称: ${merchant.name}`)
  console.log(`内容数量: ${merchant._count.contents}`)
  console.log('')

  // 2. 检查是否有评论数据
  const contentsWithComments = await prisma.merchantContent.count({
    where: {
      merchantId,
      commentCount: { gt: 0 }
    }
  })

  if (contentsWithComments === 0) {
    console.error('❌ 商家暂无评论数据，无法进行客群分析')
    console.log('提示：请先运行同步脚本采集评论数据')
    process.exit(1)
  }

  console.log(`✅ 有 ${contentsWithComments} 个视频有评论数据`)
  console.log('')

  // 3. 查询TOP5视频
  const topVideos = await prisma.merchantContent.findMany({
    where: {
      merchantId,
      commentCount: { gt: 0 }
    },
    orderBy: {
      commentCount: 'desc'
    },
    take: 5,
    select: {
      id: true,
      title: true,
      commentCount: true
    }
  })

  console.log('📊 将分析以下TOP5视频：')
  topVideos.forEach((v, i) => {
    console.log(`  ${i + 1}. ${v.title} - ${v.commentCount}条评论`)
  })
  console.log('')

  // 4. 运行分析Pipeline
  console.log('🔄 开始运行客群分析Pipeline...')
  console.log('')

  try {
    const result = await runAudienceAnalysisPipeline(
      merchantId,
      async (event) => {
        switch (event.type) {
          case 'progress':
            const progressBar = '█'.repeat(Math.floor(event.percentage / 5)) +
                               '░'.repeat(20 - Math.floor(event.percentage / 5))
            console.log(`  [${progressBar}] ${event.percentage}% - ${event.label}`)
            if (event.detail) {
              console.log(`    ${event.detail}`)
            }
            break

          case 'info':
            console.log(`  ℹ️  商家: ${event.merchantName}, 选择了 ${event.videosSelected} 个视频`)
            break

          case 'partial':
            // 流式输出分析文本（可选）
            // process.stdout.write(event.data)
            break

          case 'done':
            console.log('')
            console.log('✅ 分析完成！')
            console.log(`  - 分析ID: ${event.analysisId}`)
            console.log(`  - 分析视频数: ${event.videosAnalyzed}`)
            console.log(`  - 评论样本数: ${event.commentsAnalyzed}`)
            console.log(`  - 地域数量: ${event.locationStats.length}`)
            break

          case 'error':
            console.error(`  ❌ 错误: ${event.message}`)
            break
        }
      },
      {
        topN: 5,
        maxCommentsPerVideo: 100
      }
    )

    console.log('')
    console.log('=' .repeat(60))
    console.log('📈 客群分析报告')
    console.log('='.repeat(60))
    console.log('')
    console.log(result.markdown)
    console.log('')
    console.log('='.repeat(60))

    // 5. 验证数据库存储
    const savedAnalysis = await prisma.merchantAudienceAnalysis.findUnique({
      where: { merchantId }
    })

    if (savedAnalysis) {
      console.log('')
      console.log('✅ 数据库验证成功')
      console.log(`  - 记录ID: ${savedAnalysis.id}`)
      console.log(`  - 分析时间: ${savedAnalysis.analyzedAt.toISOString()}`)
      console.log(`  - 使用模型: ${savedAnalysis.modelUsed}`)
      console.log(`  - Token消耗: ${savedAnalysis.tokenUsed}`)

      // 解析地域分布
      if (savedAnalysis.locationStats) {
        const locationStats = JSON.parse(savedAnalysis.locationStats)
        console.log('')
        console.log('  📍 地域分布TOP5:')
        locationStats.slice(0, 5).forEach((stat: any, i: number) => {
          console.log(`    ${i + 1}. ${stat.location}: ${stat.count}条 (${stat.percentage.toFixed(1)}%)`)
        })
      }
    } else {
      console.error('❌ 数据库验证失败：未找到保存的分析记录')
    }

  } catch (error) {
    console.error('')
    console.error('❌ 分析失败:', error)
    if (error instanceof Error) {
      console.error('错误详情:', error.message)
      if (error.stack) {
        console.error('堆栈追踪:', error.stack)
      }
    }
    process.exit(1)
  }
}

main()
  .then(() => {
    console.log('')
    console.log('✅ 测试完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 测试失败:', error)
    process.exit(1)
  })
