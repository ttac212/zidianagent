/**
 * 商家视频数据增强脚本
 *
 * 功能：
 * 1. 优先采集互动评分高的视频
 * 2. 获取播放量和评论数据
 * 3. 刷量检测
 * 4. 计算互动率指标
 *
 * 使用方法：
 * npx tsx scripts/enhance-merchant-videos.ts [merchantId]
 */

import { PrismaClient } from '@prisma/client'
import { getTikHubClient } from '@/lib/tikhub'
import type { DouyinComment } from '@/lib/tikhub/types'
import { detectFraud, calculateQualityScore } from '@/lib/utils/fraud-detection'

const prisma = new PrismaClient()

interface EnhanceOptions {
  /** 每个视频采集多少条评论 */
  commentsPerVideo?: number
  /** 每次处理多少个视频 */
  batchSize?: number
  /** 是否跳过已采集的视频 */
  skipExisting?: boolean
  /** 商家ID（可选，不指定则处理所有商家） */
  merchantId?: string
}

/**
 * 计算互动评分（用于排序）
 */
function calculateEngagementScore(content: {
  diggCount: number
  commentCount: number
  collectCount: number
  shareCount: number
}): number {
  // 权重：点赞×1 + 评论×2 + 收藏×3 + 分享×4
  return (
    content.diggCount +
    content.commentCount * 2 +
    content.collectCount * 3 +
    content.shareCount * 4
  )
}

/**
 * 获取需要增强的视频列表（按互动评分排序）
 */
async function getVideosToEnhance(options: EnhanceOptions) {
  const whereClause: any = {
    playCount: 0, // 未采集播放量的视频
  }

  if (options.merchantId) {
    whereClause.merchantId = options.merchantId
  }

  const contents = await prisma.merchantContent.findMany({
    where: whereClause,
    take: options.batchSize || 50,
    orderBy: [
      { diggCount: 'desc' }, // 优先处理点赞数高的
      { commentCount: 'desc' },
    ],
    include: {
      merchant: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  // 按互动评分重新排序
  return contents.sort((a, b) => {
    const scoreA = calculateEngagementScore(a)
    const scoreB = calculateEngagementScore(b)
    return scoreB - scoreA
  })
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
        count: 20, // 每次20条
      })

      allComments.push(...response.comments)
      hasMore = response.has_more
      cursor = response.cursor

      // 达到目标数量
      if (allComments.length >= maxComments) {
        break
      }

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
 * 增强单个视频数据
 */
async function enhanceVideo(
  client: ReturnType<typeof getTikHubClient>,
  content: any,
  options: EnhanceOptions
) {
  try {
    console.log(`\n处理视频: ${content.title}`)
    console.log(`  ID: ${content.externalId}`)
    console.log(`  当前数据: 👍${content.diggCount} 💬${content.commentCount}`)

    // 1. 获取播放量统计
    console.log(`  1️⃣  获取播放量数据...`)
    const statsResponse = await client.getVideoStatistics({
      aweme_ids: content.externalId,
    })

    const stats = statsResponse.statistics[0]
    if (!stats) {
      throw new Error('未获取到统计数据')
    }

    console.log(`  ✅ 播放量: ${stats.play_count.toLocaleString()}`)

    // 2. 获取评论
    console.log(`  2️⃣  获取评论数据 (目标:${options.commentsPerVideo || 100}条)...`)
    const comments = await fetchAllComments(
      client,
      content.externalId,
      options.commentsPerVideo || 100
    )

    console.log(`  ✅ 获取评论: ${comments.length}条`)

    // 3. 刷量检测
    console.log(`  3️⃣  刷量检测...`)
    const fraudResult = detectFraud(
      {
        playCount: stats.play_count,
        diggCount: stats.digg_count,
        commentCount: stats.comment_count,
        shareCount: stats.share_count,
        collectCount: stats.collect_count,
      },
      comments.map((c) => ({
        cid: c.cid,
        text: c.text,
        digg_count: c.digg_count,
        create_time: c.create_time,
        reply_comment_total: c.reply_comment_total,
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
    const shareRate =
      stats.play_count > 0 ? (stats.share_count / stats.play_count) * 100 : 0

    console.log(`  📊 互动率: 👍${likeRate.toFixed(2)}% 💬${commentRate.toFixed(3)}% 📤${shareRate.toFixed(3)}%`)

    // 5. 质量评分
    const qualityScore = calculateQualityScore(
      {
        playCount: stats.play_count,
        diggCount: stats.digg_count,
        commentCount: stats.comment_count,
        shareCount: stats.share_count,
        collectCount: stats.collect_count,
      },
      comments.map((c) => ({
        cid: c.cid,
        text: c.text,
        digg_count: c.digg_count,
        create_time: c.create_time,
        reply_comment_total: c.reply_comment_total,
      }))
    )

    console.log(`  ⭐ 质量评分: ${qualityScore}/100`)

    // 6. 保存到数据库
    console.log(`  4️⃣  保存数据...`)

    await prisma.$transaction([
      // 更新视频数据
      prisma.merchantContent.update({
        where: { id: content.id },
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
          suspiciousReason: fraudResult.reason,
        },
      }),

      // 批量插入评论（只插入前100条）
      ...comments.map((comment) =>
        prisma.merchantContentComment.upsert({
          where: { externalId: comment.cid },
          create: {
            contentId: content.id,
            externalId: comment.cid,
            text: comment.text,
            authorName: comment.user?.nickname,
            authorUid: comment.user?.uid,
            diggCount: comment.digg_count,
            replyCount: comment.reply_comment_total || 0,
            isTop: (comment.stick_position || 0) > 0,
            createdAt: new Date(comment.create_time * 1000),
          },
          update: {
            diggCount: comment.digg_count,
            replyCount: comment.reply_comment_total || 0,
          },
        })
      ),
    ])

    console.log(`  ✅ 数据已保存`)

    return {
      success: true,
      stats,
      commentsCount: comments.length,
      fraudResult,
      qualityScore,
    }
  } catch (error: any) {
    console.error(`  ❌ 处理失败:`, error.message)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 主函数
 */
async function main() {
  const merchantId = process.argv[2] // 可选的商家ID参数

  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║      商家视频数据增强脚本                        ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  if (merchantId) {
    console.log(`🎯 目标商家: ${merchantId}`)
  } else {
    console.log(`🎯 处理所有商家的视频`)
  }

  const options: EnhanceOptions = {
    commentsPerVideo: 100, // 每个视频采集100条评论
    batchSize: 50, // 每次处理50个视频
    skipExisting: true,
    merchantId,
  }

  try {
    // 1. 获取待处理视频
    console.log(`\n📋 查询待处理视频...`)
    const contents = await getVideosToEnhance(options)
    console.log(`找到 ${contents.length} 个视频需要增强`)

    if (contents.length === 0) {
      console.log('\n✅ 所有视频数据已是最新！')
      return
    }

    // 按商家分组统计
    const merchantStats = new Map<string, number>()
    contents.forEach((c) => {
      const count = merchantStats.get(c.merchant.name) || 0
      merchantStats.set(c.merchant.name, count + 1)
    })

    console.log('\n商家分布:')
    merchantStats.forEach((count, name) => {
      console.log(`  - ${name}: ${count}个视频`)
    })

    // 2. 初始化TikHub客户端
    console.log(`\n🔌 连接TikHub API...`)
    const client = getTikHubClient()
    const connected = await client.testConnection()

    if (!connected) {
      throw new Error('TikHub API连接失败')
    }

    console.log(`✅ API连接成功`)

    // 检查余额
    const userInfo = await client.getUserInfo()
    console.log(`💰 账户余额: $${userInfo.balance}`)
    console.log(`📊 今日请求: ${userInfo.daily_requests}`)

    // 3. 批量处理视频
    console.log(`\n🚀 开始处理视频...\n`)

    let successCount = 0
    let failCount = 0
    let totalCommentsCollected = 0

    for (let i = 0; i < contents.length; i++) {
      const content = contents[i]
      console.log(`\n[${i + 1}/${contents.length}] ${content.merchant.name}`)
      console.log(`─────────────────────────────────────`)

      const result = await enhanceVideo(client, content, options)

      if (result.success) {
        successCount++
        totalCommentsCollected += result.commentsCount || 0
      } else {
        failCount++
      }

      // 每个视频间延迟2秒，避免限流
      if (i < contents.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    // 4. 输出统计
    console.log('\n\n╔══════════════════════════════════════════════════╗')
    console.log('║                处理完成                          ║')
    console.log('╚══════════════════════════════════════════════════╝\n')

    console.log(`✅ 成功: ${successCount}个视频`)
    console.log(`❌ 失败: ${failCount}个视频`)
    console.log(`💬 评论: 共采集${totalCommentsCollected}条评论`)

    // 统计疑似刷量视频
    const suspiciousCount = await prisma.merchantContent.count({
      where: { isSuspicious: true },
    })
    console.log(`⚠️  疑似刷量: ${suspiciousCount}个视频`)

    console.log('\n🎉 所有数据已增强！\n')
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

export { main as enhanceMerchantVideos }
