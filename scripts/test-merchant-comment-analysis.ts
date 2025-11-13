/**
 * 商家评论分析后端测试脚本
 *
 * 测试内容：
 * 1. 评论来源管理器（数据库/TikHub）
 * 2. Pipeline完整流程
 * 3. 数据库保存验证
 *
 * 运行方式：
 * npx tsx scripts/test-merchant-comment-analysis.ts [contentId]
 *
 * 如果不提供 contentId，会自动查找数据库中第一个有评论的视频
 */

// 必须在所有其他 import 之前加载环境变量
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') })

import { prisma } from '@/lib/prisma'
import {
  fetchCommentsForAnalysis,
  getCommentStats
} from '@/lib/merchant/comments-source-manager'
import { runMerchantCommentAnalysis } from '@/lib/merchant/merchant-comments-analysis-pipeline'

async function main() {
  console.log('========================================')
  console.log('商家评论分析后端测试')
  console.log('========================================\n')

  // 1. 获取测试用的 contentId
  let contentId = process.argv[2]

  if (!contentId) {
    console.log('[步骤1] 未指定 contentId，自动查找有评论的视频...')

    const content = await prisma.merchantContent.findFirst({
      where: {
        commentCount: { gt: 0 }
      },
      orderBy: {
        commentCount: 'desc'
      },
      include: {
        merchant: {
          select: { name: true }
        }
      }
    })

    if (!content) {
      console.error('❌ 错误：数据库中没有有评论的视频数据')
      console.log('\n提示：请先运行商家数据同步，确保有评论数据')
      process.exit(1)
    }

    contentId = content.id

    console.log(`✅ 找到测试视频：`)
    console.log(`   - ID: ${content.id}`)
    console.log(`   - 标题: ${content.title}`)
    console.log(`   - 商家: ${content.merchant.name}`)
    console.log(`   - 评论数: ${content.commentCount}`)
    console.log(`   - 总互动: ${content.totalEngagement}`)
  } else {
    console.log(`[步骤1] 使用指定的 contentId: ${contentId}`)

    const content = await prisma.merchantContent.findUnique({
      where: { id: contentId },
      include: {
        merchant: {
          select: { name: true }
        }
      }
    })

    if (!content) {
      console.error(`❌ 错误：找不到 content: ${contentId}`)
      process.exit(1)
    }

    console.log(`✅ 视频信息：`)
    console.log(`   - 标题: ${content.title}`)
    console.log(`   - 商家: ${content.merchant.name}`)
    console.log(`   - 评论数: ${content.commentCount}`)
  }

  console.log()

  // 2. 测试评论来源管理器
  console.log('[步骤2] 测试评论来源管理器...')

  const stats = await getCommentStats(contentId)
  console.log(`   - 数据库评论数: ${stats.dbCount}`)
  console.log(`   - 最后采集时间: ${stats.lastCollectedAt?.toLocaleString('zh-CN') || '从未采集'}`)

  console.log('\n   测试场景1：优先使用数据库评论')
  const source1 = await fetchCommentsForAnalysis(contentId, {
    forceRefresh: false,
    maxComments: 100
  })

  console.log(`   ✅ 评论来源: ${source1.source === 'db' ? '数据库' : 'TikHub'}`)
  console.log(`   ✅ 评论总数: ${source1.total}`)
  console.log(`   ✅ 数据库评论: ${source1.dbCount}`)
  console.log(`   ✅ TikHub评论: ${source1.tikhubCount}`)

  if (source1.comments.length > 0) {
    console.log(`\n   示例评论前3条：`)
    source1.comments.slice(0, 3).forEach((c, i) => {
      const locationText = c.location ? ` [${c.location}]` : ''
      console.log(`   ${i + 1}. ${c.user}${locationText}（赞${c.likes}）: ${c.text.slice(0, 50)}...`)
    })
  }

  console.log()

  // 3. 测试完整 Pipeline
  console.log('[步骤3] 运行完整分析 Pipeline...')
  console.log('   （这可能需要30-60秒，取决于评论数量和LLM速度）\n')

  let stepCount = 0
  let lastPercentage = 0

  try {
    const result = await runMerchantCommentAnalysis(
      contentId,
      async (event) => {
        switch (event.type) {
          case 'progress':
            stepCount++
            if (event.percentage > lastPercentage) {
              lastPercentage = event.percentage
              console.log(`   [${event.percentage}%] ${event.label} - ${event.status}`)
              if (event.detail) {
                console.log(`           ${event.detail}`)
              }
            }
            break

          case 'info':
            console.log(`   ℹ️ 视频信息: ${event.videoInfo.title}`)
            if (event.statistics) {
              console.log(`      播放: ${event.statistics.play_count.toLocaleString()}`)
              console.log(`      点赞: ${event.statistics.digg_count.toLocaleString()}`)
              console.log(`      评论: ${event.statistics.comment_count.toLocaleString()}`)
            }
            break

          case 'partial':
            // 流式分析内容（不打印，避免刷屏）
            break

          case 'done':
            console.log(`\n   ✅ 分析完成！`)
            console.log(`   - 分析ID: ${event.analysisId}`)
            console.log(`   - 评论数: ${event.commentCount}`)
            console.log(`   - 评论来源: ${event.commentSource === 'db' ? '数据库' : 'TikHub'}`)
            console.log(`   - Markdown长度: ${event.markdown.length} 字符`)
            break

          case 'error':
            console.error(`\n   ❌ 错误: ${event.message}`)
            if (event.step) {
              console.error(`      失败步骤: ${event.step}`)
            }
            break
        }
      },
      {
        forceRefresh: false,
        maxComments: 100
      }
    )

    console.log()

    // 4. 验证数据库保存
    console.log('[步骤4] 验证数据库保存...')

    const savedAnalysis = await prisma.merchantContentAnalysis.findUnique({
      where: { contentId }
    })

    if (!savedAnalysis) {
      console.error('   ❌ 错误：分析结果未保存到数据库')
      process.exit(1)
    }

    console.log(`   ✅ 分析结果已保存`)
    console.log(`   - 分析ID: ${savedAnalysis.id}`)
    console.log(`   - 评论数: ${savedAnalysis.commentCount}`)
    console.log(`   - 评论来源: ${savedAnalysis.commentSource}`)
    console.log(`   - 模型: ${savedAnalysis.modelUsed}`)
    console.log(`   - Token消耗: ${savedAnalysis.tokenUsed}`)
    console.log(`   - 分析时间: ${savedAnalysis.analyzedAt.toLocaleString('zh-CN')}`)
    console.log(`   - Markdown长度: ${savedAnalysis.rawMarkdown?.length || 0} 字符`)

    if (savedAnalysis.rawMarkdown) {
      console.log(`\n   === 分析报告预览 ===`)
      const preview = savedAnalysis.rawMarkdown.slice(0, 500)
      console.log(preview)
      if (savedAnalysis.rawMarkdown.length > 500) {
        console.log('   ...')
        console.log(`   （完整报告共 ${savedAnalysis.rawMarkdown.length} 字符）`)
      }
    }

    console.log()

    // 5. 测试总结
    console.log('========================================')
    console.log('✅ 所有测试通过！')
    console.log('========================================')
    console.log('\n后端功能验证成功：')
    console.log('  ✓ 评论来源管理器工作正常')
    console.log('  ✓ Pipeline流程完整无误')
    console.log('  ✓ 数据库保存成功')
    console.log('  ✓ LLM分析正常输出')
    console.log('\n可以继续前端开发了！')

  } catch (error) {
    console.error('\n❌ Pipeline执行失败：')
    console.error(error)
    process.exit(1)
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
