// 加载环境变量（必须在所有导入之前）
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

/**
 * 批量为所有商家采集TOP5视频评论数据
 *
 * 功能：
 * - 列出所有商家
 * - 逐个处理每个商家的TOP5视频评论
 * - 显示进度和统计
 * - 自动跳过已有评论的视频
 *
 * 使用方法：
 * npx tsx scripts/batch-enhance-all-merchants.ts
 */

import { PrismaClient } from '@prisma/client'
import { getTikHubClient } from '@/lib/tikhub'
import type { DouyinComment } from '@/lib/tikhub/types'
import { detectFraud, calculateQualityScore } from '@/lib/utils/fraud-detection'

const prisma = new PrismaClient()

interface VideoToEnhance {
  id: string
  externalId: string
  title: string
  diggCount: number
  commentCount: number
  shareCount: number
  collectCount: number
  category: 'likes' | 'comments' | 'engagement'
}

/**
 * 获取商家的TOP5视频列表
 */
async function getTop5Videos(merchantId: string): Promise<VideoToEnhance[]> {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const baseWhere = {
    merchantId,
    publishedAt: { gte: sixMonthsAgo }
  }

  // 并行获取三个TOP5列表
  const [topLikes, topComments, topEngagement] = await Promise.all([
    // 点赞TOP5
    prisma.merchantContent.findMany({
      where: baseWhere,
      orderBy: [{ diggCount: 'desc' }, { publishedAt: 'desc' }],
      take: 5,
      select: {
        id: true,
        externalId: true,
        title: true,
        diggCount: true,
        commentCount: true,
        shareCount: true,
        collectCount: true,
        _count: { select: { comments: true } }
      }
    }),

    // 评论TOP5
    prisma.merchantContent.findMany({
      where: baseWhere,
      orderBy: [{ commentCount: 'desc' }, { publishedAt: 'desc' }],
      take: 5,
      select: {
        id: true,
        externalId: true,
        title: true,
        diggCount: true,
        commentCount: true,
        shareCount: true,
        collectCount: true,
        _count: { select: { comments: true } }
      }
    }),

    // 互动评分TOP5
    prisma.$queryRaw<Array<{
      id: string
      externalId: string
      title: string
      diggCount: number
      commentCount: number
      shareCount: number
      collectCount: number
    }>>`
      SELECT
        id,
        "externalId",
        title,
        "diggCount",
        "commentCount",
        "shareCount",
        "collectCount"
      FROM "merchant_contents"
      WHERE "merchantId" = ${merchantId}
        AND "publishedAt" >= ${sixMonthsAgo}
      ORDER BY ("diggCount" + "commentCount" * 2 + "collectCount" * 3 + "shareCount" * 4) DESC,
               "publishedAt" DESC
      LIMIT 5
    `
  ])

  // 去重并标记分类，只返回没有评论的视频
  const videoMap = new Map<string, VideoToEnhance>()

  topLikes.forEach((v: any) => {
    if (v._count.comments === 0) {
      videoMap.set(v.id, { ...v, category: 'likes' as const })
    }
  })

  topComments.forEach((v: any) => {
    if (v._count.comments === 0 && !videoMap.has(v.id)) {
      videoMap.set(v.id, { ...v, category: 'comments' as const })
    }
  })

  topEngagement.forEach((v) => {
    // 检查是否已有评论
    const existing = videoMap.get(v.id)
    if (!existing) {
      // 需要查询评论数量
      prisma.merchantContent.findUnique({
        where: { id: v.id },
        select: { _count: { select: { comments: true } } }
      }).then(result => {
        if (result && result._count.comments === 0) {
          videoMap.set(v.id, { ...v, category: 'engagement' as const })
        }
      })
    }
  })

  // 等待异步查询完成
  await new Promise(resolve => setTimeout(resolve, 100))

  return Array.from(videoMap.values())
}

/**
 * 分页获取评论
 */
async function fetchAllComments(
  client: ReturnType<typeof getTikHubClient>,
  awemeId: string,
  maxComments: number
): Promise<DouyinComment[]> {
  const allComments: DouyinComment[] = []
  let cursor = 0
  let hasMore = true

  while (hasMore && allComments.length < maxComments) {
    try {
      const response = await client.getVideoComments({
        aweme_id: awemeId,
        cursor,
        count: 20
      })

      allComments.push(...response.comments)
      hasMore = response.has_more
      cursor = response.cursor

      if (allComments.length >= maxComments) break

      // 延迟避免限流
      await new Promise((resolve) => setTimeout(resolve, 500))
    } catch (error: any) {
      console.warn(`  ⚠️  获取评论失败 (游标:${cursor}):`, error.message)
      break
    }
  }

  return allComments.slice(0, maxComments)
}

/**
 * 增强单个视频
 */
async function enhanceVideo(
  client: ReturnType<typeof getTikHubClient>,
  video: VideoToEnhance
) {
  try {
    console.log(`      ${video.title.slice(0, 50)}...`)
    console.log(`      ID: ${video.externalId}`)

    // 1. 获取播放量统计
    const statsResponse = await client.getVideoStatistics({
      aweme_ids: video.externalId
    })

    const statisticsList =
      (statsResponse as { statistics_list?: typeof statsResponse.statistics })
        ?.statistics_list ?? statsResponse.statistics

    if (!statisticsList || statisticsList.length === 0) {
      throw new Error('未获取到统计数据')
    }

    const stats = statisticsList[0]

    // 2. 获取评论
    const comments = await fetchAllComments(client, video.externalId, 100)

    // 3. 刷量检测
    const fraudResult = detectFraud(
      {
        playCount: stats.play_count,
        diggCount: stats.digg_count,
        commentCount: stats.comment_count,
        shareCount: stats.share_count,
        collectCount: stats.collect_count
      },
      comments.map((c) => ({
        cid: c.cid,
        text: c.text,
        digg_count: c.digg_count,
        create_time: c.create_time,
        reply_comment_total: c.reply_comment_total
      }))
    )

    // 4. 计算互动率
    const likeRate =
      stats.play_count > 0 ? (stats.digg_count / stats.play_count) * 100 : 0
    const commentRate =
      stats.play_count > 0 ? (stats.comment_count / stats.play_count) * 100 : 0

    // 5. 质量评分
    const qualityScore = calculateQualityScore(
      {
        playCount: stats.play_count,
        diggCount: stats.digg_count,
        commentCount: stats.comment_count,
        shareCount: stats.share_count,
        collectCount: stats.collect_count
      },
      comments.map((c) => ({
        cid: c.cid,
        text: c.text,
        digg_count: c.digg_count,
        create_time: c.create_time,
        reply_comment_total: c.reply_comment_total
      }))
    )

    // 6. 保存到数据库
    await prisma.$transaction([
      // 更新视频数据
      prisma.merchantContent.update({
        where: { id: video.id },
        data: {
          playCount: stats.play_count,
          diggCount: stats.digg_count,
          commentCount: stats.comment_count,
          shareCount: stats.share_count,
          collectCount: stats.collect_count,
          forwardCount: stats.forward_count || 0,
          likeRate,
          commentRate,
          isSuspicious: fraudResult.isSuspicious,
          suspiciousReason: fraudResult.reason
        }
      }),

      // 批量插入评论
      ...comments.map((comment) =>
        prisma.merchantContentComment.upsert({
          where: { externalId: comment.cid },
          create: {
            contentId: video.id,
            externalId: comment.cid,
            text: comment.text,
            authorName: comment.user?.nickname,
            authorUid: comment.user?.uid,
            diggCount: comment.digg_count,
            replyCount: comment.reply_comment_total || 0,
            isTop: (comment.stick_position || 0) > 0,
            createdAt: new Date(comment.create_time * 1000)
          },
          update: {
            diggCount: comment.digg_count,
            replyCount: comment.reply_comment_total || 0
          }
        })
      )
    ])

    console.log(`      ✅ 成功采集 ${comments.length} 条评论`)
    return { success: true, commentsCount: comments.length }
  } catch (error: any) {
    console.error(`      ❌ 失败:`, error.message)
    return { success: false, error: error.message }
  }
}

/**
 * 处理单个商家
 */
async function processMerchant(
  client: ReturnType<typeof getTikHubClient>,
  merchant: { id: string; name: string; totalContentCount: number }
) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`📦 商家: ${merchant.name}`)
  console.log(`   总内容数: ${merchant.totalContentCount}`)
  console.log(`${'='.repeat(70)}`)

  try {
    // 获取TOP5视频
    const videos = await getTop5Videos(merchant.id)

    if (videos.length === 0) {
      console.log('   ✅ 所有TOP5视频已有评论数据，跳过\n')
      return {
        merchantName: merchant.name,
        skipped: true,
        videosProcessed: 0,
        commentsCollected: 0
      }
    }

    console.log(`   找到 ${videos.length} 个视频需要采集评论\n`)

    let successCount = 0
    let totalComments = 0

    // 逐个处理视频
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i]
      console.log(`   [${i + 1}/${videos.length}] [${video.category.toUpperCase()}]`)

      const result = await enhanceVideo(client, video)

      if (result.success) {
        successCount++
        totalComments += result.commentsCount || 0
      }

      // 延迟2秒，避免限流
      if (i < videos.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    console.log(`\n   📊 统计: 成功 ${successCount}/${videos.length}, 采集 ${totalComments} 条评论`)

    return {
      merchantName: merchant.name,
      skipped: false,
      videosProcessed: videos.length,
      videosSuccess: successCount,
      commentsCollected: totalComments
    }
  } catch (error: any) {
    console.error(`   ❌ 处理失败:`, error.message)
    return {
      merchantName: merchant.name,
      skipped: false,
      videosProcessed: 0,
      error: error.message
    }
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║   批量采集所有商家TOP5视频评论数据              ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  try {
    // 1. 初始化TikHub客户端
    console.log('🔌 连接TikHub API...')
    const apiKey = process.env.TIKHUB_API_KEY
    if (!apiKey) {
      throw new Error('TIKHUB_API_KEY not found in environment variables')
    }

    const client = getTikHubClient({ apiKey })
    const connected = await client.testConnection()

    if (!connected) {
      throw new Error('TikHub API连接失败')
    }
    console.log('✅ API连接成功\n')

    // 2. 获取所有商家
    console.log('📋 查询商家列表...')
    const merchants = await prisma.merchant.findMany({
      where: {
        totalContentCount: { gt: 0 } // 只处理有内容的商家
      },
      select: {
        id: true,
        name: true,
        totalContentCount: true
      },
      orderBy: {
        totalContentCount: 'desc' // 按内容数量降序
      }
    })

    console.log(`找到 ${merchants.length} 个商家\n`)

    if (merchants.length === 0) {
      console.log('✅ 没有需要处理的商家')
      return
    }

    // 3. 批量处理商家
    const results = []
    let processedCount = 0
    let skippedCount = 0
    let totalVideosProcessed = 0
    let totalCommentsCollected = 0

    for (let i = 0; i < merchants.length; i++) {
      const merchant = merchants[i]
      console.log(`\n进度: [${i + 1}/${merchants.length}]`)

      const result = await processMerchant(client, merchant)
      results.push(result)

      if (result.skipped) {
        skippedCount++
      } else {
        processedCount++
        totalVideosProcessed += result.videosProcessed || 0
        totalCommentsCollected += result.commentsCollected || 0
      }

      // 商家之间延迟3秒
      if (i < merchants.length - 1) {
        console.log('\n⏱️  等待3秒后继续...')
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    }

    // 4. 输出总结
    console.log('\n\n╔══════════════════════════════════════════════════╗')
    console.log('║                批量处理完成                      ║')
    console.log('╚══════════════════════════════════════════════════╝\n')

    console.log(`📊 商家统计:`)
    console.log(`   总商家数: ${merchants.length}`)
    console.log(`   已处理: ${processedCount}`)
    console.log(`   跳过(已有数据): ${skippedCount}`)

    console.log(`\n📹 视频统计:`)
    console.log(`   总视频数: ${totalVideosProcessed}`)
    console.log(`   总评论数: ${totalCommentsCollected}`)

    console.log('\n📋 详细结果:')
    results.forEach((r, i) => {
      if (r.skipped) {
        console.log(`   ${i + 1}. ${r.merchantName}: 跳过 ✓`)
      } else if (r.error) {
        console.log(`   ${i + 1}. ${r.merchantName}: 失败 - ${r.error}`)
      } else {
        console.log(
          `   ${i + 1}. ${r.merchantName}: ${r.videosSuccess}/${r.videosProcessed} 视频, ${r.commentsCollected} 评论 ✓`
        )
      }
    })

    console.log('\n🎉 批量采集完成！\n')
  } catch (error: any) {
    console.error('\n❌ 脚本执行失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行脚本
if (require.main === module) {
  main()
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
    .finally(() => {
      process.exit(0)
    })
}

export { main as batchEnhanceAllMerchants }
