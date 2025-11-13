// 加载环境变量（必须在所有导入之前）
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

/**
 * TOP5视频评论采集脚本
 *
 * 功能：
 * - 只采集商家TOP5视频（点赞/评论/互动）的评论数据
 * - 比完整脚本更快、更精准、成本更低
 *
 * 使用方法：
 * npx tsx scripts/enhance-top5-videos.ts <merchantId>
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

  // 去重并标记分类
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
    if (!videoMap.has(v.id)) {
      videoMap.set(v.id, { ...v, category: 'engagement' as const })
    }
  })

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
  console.log(`\n[${video.category.toUpperCase()}] ${video.title.slice(0, 60)}...`)
  console.log(`  ID: ${video.externalId}`)
  console.log(`  当前数据: 👍${video.diggCount} 💬${video.commentCount}`)

  try {
    // 1. 获取播放量统计
    console.log(`  1️⃣  获取播放量数据...`)
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
    console.log(`  ✅ 播放量: ${stats.play_count.toLocaleString()}`)

    // 2. 获取评论
    console.log(`  2️⃣  获取评论数据 (目标:100条)...`)
    const comments = await fetchAllComments(client, video.externalId, 100)
    console.log(`  ✅ 获取评论: ${comments.length}条`)

    // 3. 刷量检测
    console.log(`  3️⃣  刷量检测...`)
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

    if (fraudResult.isSuspicious) {
      console.log(
        `  ⚠️  疑似刷量 (置信度:${fraudResult.confidence}%): ${fraudResult.reason}`
      )
    } else {
      console.log(`  ✅ 数据真实`)
    }

    // 4. 计算互动率
    const likeRate =
      stats.play_count > 0 ? (stats.digg_count / stats.play_count) * 100 : 0
    const commentRate =
      stats.play_count > 0 ? (stats.comment_count / stats.play_count) * 100 : 0

    console.log(`  📊 互动率: 👍${likeRate.toFixed(2)}% 💬${commentRate.toFixed(3)}%`)

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

    console.log(`  ⭐ 质量评分: ${qualityScore}/100`)

    // 6. 保存到数据库
    console.log(`  4️⃣  保存数据...`)

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

    console.log(`  ✅ 数据已保存`)

    return { success: true, commentsCount: comments.length }
  } catch (error: any) {
    console.error(`  ❌ 处理失败:`, error.message)
    return { success: false, error: error.message }
  }
}

/**
 * 主函数
 */
async function main() {
  const merchantId = process.argv[2]

  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║      TOP5视频评论采集脚本                        ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  if (!merchantId) {
    console.error('❌ 请提供商家ID参数')
    console.log('\n使用方法:')
    console.log('  npx tsx scripts/enhance-top5-videos.ts <merchantId>\n')
    process.exit(1)
  }

  try {
    // 1. 验证商家
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, name: true }
    })

    if (!merchant) {
      console.error(`❌ 商家不存在: ${merchantId}`)
      process.exit(1)
    }

    console.log(`🎯 商家: ${merchant.name}`)

    // 2. 获取TOP5视频
    console.log(`\n📋 查询TOP5视频...`)
    const videos = await getTop5Videos(merchantId)

    if (videos.length === 0) {
      console.log('\n✅ 所有TOP5视频已有评论数据！')
      return
    }

    console.log(`找到 ${videos.length} 个视频需要采集评论\n`)

    // 按分类统计
    const categories = videos.reduce(
      (acc, v) => {
        acc[v.category] = (acc[v.category] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    console.log('分类分布:')
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`  - ${cat}: ${count}个视频`)
    })

    // 3. 初始化TikHub客户端
    console.log(`\n🔌 连接TikHub API...`)
    const apiKey = process.env.TIKHUB_API_KEY
    if (!apiKey) {
      throw new Error('TIKHUB_API_KEY not found in environment variables')
    }

    const client = getTikHubClient({ apiKey })
    const connected = await client.testConnection()

    if (!connected) {
      throw new Error('TikHub API连接失败')
    }

    console.log(`✅ API连接成功`)

    // 4. 处理视频
    console.log(`\n🚀 开始采集评论...\n`)

    let successCount = 0
    let failCount = 0
    let totalComments = 0

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i]
      console.log(`\n[${i + 1}/${videos.length}]`)
      console.log(`─────────────────────────────────────`)

      const result = await enhanceVideo(client, video)

      if (result.success) {
        successCount++
        totalComments += result.commentsCount || 0
      } else {
        failCount++
      }

      // 延迟2秒，避免限流
      if (i < videos.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    // 5. 输出统计
    console.log('\n\n╔══════════════════════════════════════════════════╗')
    console.log('║                处理完成                          ║')
    console.log('╚══════════════════════════════════════════════════╝\n')

    console.log(`✅ 成功: ${successCount}个视频`)
    console.log(`❌ 失败: ${failCount}个视频`)
    console.log(`💬 评论: 共采集${totalComments}条评论`)

    console.log('\n🎉 TOP5视频评论数据已采集完成！\n')
    console.log('💡 现在你可以在商家详情页查看评论洞察了\n')
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

export { main as enhanceTop5Videos }
