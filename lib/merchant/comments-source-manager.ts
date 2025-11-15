/**
 * 商家评论来源管理器
 *
 * 策略：优先从数据库读取，不足时自动从TikHub采集
 *
 * Linus 式设计原则：
 * - 数据结构第一：CleanedComment 统一格式
 * - 自动修复：评论不足时自动采集，而不是报错
 */

import { prisma } from '@/lib/prisma'
import { getTikHubClient } from '@/lib/tikhub'
import type { DouyinComment } from '@/lib/tikhub/types'

export interface CleanedComment {
  user: string
  text: string
  likes: number
  location: string
}

export interface CommentSource {
  source: 'db'
  comments: CleanedComment[]
  total: number
}

/**
 * 清理评论文本（移除表情符号 [xxx]）
 */
function cleanCommentText(text: string): string {
  return text.replace(/\[.*?\]/g, '').trim()
}

/**
 * 从数据库加载评论
 */
async function loadCommentsFromDatabase(
  contentId: string,
  maxComments: number
): Promise<CleanedComment[]> {
  const dbComments = await prisma.merchantContentComment.findMany({
    where: { contentId },
    orderBy: { diggCount: 'desc' },
    take: maxComments,
    select: {
      text: true,
      authorName: true,
      diggCount: true,
      createdAt: true
    }
  })

  return dbComments
    .map(c => {
      const cleanText = cleanCommentText(c.text)
      // 过滤掉清理后为空或太短的评论
      if (!cleanText || cleanText.length < 2) {
        return null
      }

      return {
        user: c.authorName || '匿名用户',
        text: cleanText,
        likes: c.diggCount,
        location: '' // 数据库中暂未存储地域信息
      }
    })
    .filter((c): c is CleanedComment => c !== null)
}

/**
 * 从TikHub采集评论并存储到数据库
 */
async function fetchAndStoreCommentsFromTikHub(
  contentId: string,
  maxComments: number
): Promise<CleanedComment[]> {
  console.log(`[CommentsSource] 评论数据不足，开始从TikHub采集 (contentId=${contentId})`)

  // 1. 获取视频的externalId (aweme_id)
  const content = await prisma.merchantContent.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      externalId: true,
      title: true
    }
  })

  if (!content || !content.externalId) {
    throw new Error(`无法找到内容或缺少externalId: ${contentId}`)
  }

  console.log(`[CommentsSource] 视频: ${content.title} (awemeId=${content.externalId})`)

  // 2. 从TikHub采集评论
  const client = getTikHubClient()
  const allComments: DouyinComment[] = []
  let cursor = 0
  let hasMore = true
  let pageCount = 0
  const maxPages = 5 // 最多5页，避免采集过多

  while (hasMore && allComments.length < maxComments && pageCount < maxPages) {
    try {
      const response = await client.getVideoComments({
        aweme_id: content.externalId,
        cursor,
        count: 20
      })

      allComments.push(...response.comments)
      hasMore = response.has_more
      cursor = response.cursor
      pageCount++

      console.log(`[CommentsSource] 已采集 ${allComments.length} 条评论 (第${pageCount}页)`)

      if (allComments.length >= maxComments) {
        break
      }

      // 延迟避免限流
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error: any) {
      console.warn(`[CommentsSource] 采集评论失败 (游标=${cursor}):`, error.message)
      break
    }
  }

  const commentsToStore = allComments.slice(0, maxComments)

  if (commentsToStore.length === 0) {
    console.log(`[CommentsSource] 未采集到任何评论`)
    return []
  }

  // 3. 存储到数据库
  console.log(`[CommentsSource] 存储 ${commentsToStore.length} 条评论到数据库`)

  const upsertPromises = commentsToStore.map((comment) =>
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
  )

  await prisma.$transaction(upsertPromises)

  console.log(`[CommentsSource] ✅ 评论采集完成`)

  // 4. 转换为清洁格式返回
  return commentsToStore
    .map(c => {
      const cleanText = cleanCommentText(c.text)
      if (!cleanText || cleanText.length < 2) {
        return null
      }

      return {
        user: c.user?.nickname || '匿名用户',
        text: cleanText,
        likes: c.digg_count,
        location: (c as any).ip_label || '' // 地域标签（如果有）
      }
    })
    .filter((c): c is CleanedComment => c !== null)
}


/**
 * 获取分析用评论数据
 *
 * 策略：优先从数据库读取，不足20条时自动从TikHub采集
 *
 * @param contentId - 内容ID
 * @param options - 选项
 * @returns 评论数据和来源信息
 */
export async function fetchCommentsForAnalysis(
  contentId: string,
  options: {
    maxComments?: number
    signal?: AbortSignal
  } = {}
): Promise<CommentSource> {
  const { maxComments = 100 } = options

  // 1. 先从数据库加载
  let dbComments = await loadCommentsFromDatabase(contentId, maxComments)

  // 2. 检查评论数量
  if (dbComments.length < 20) {
    console.log(`[CommentsSource] 数据库评论不足 (${dbComments.length} < 20)，触发TikHub采集`)

    try {
      // 自动从TikHub采集评论
      const freshComments = await fetchAndStoreCommentsFromTikHub(contentId, maxComments)

      if (freshComments.length > 0) {
        // 采集成功，使用新采集的评论
        dbComments = freshComments
        console.log(`[CommentsSource] ✅ 采集成功，现有评论数: ${dbComments.length}`)
      }
    } catch (error: any) {
      console.error(`[CommentsSource] TikHub采集失败:`, error.message)
      // 采集失败，继续使用已有的评论（如果有的话）
    }

    // 3. 再次检查评论数量
    if (dbComments.length < 20) {
      throw new Error(
        `该视频评论数据仍然不足（${dbComments.length} < 20）。` +
        `已尝试从TikHub采集，但未获取到足够评论。可能原因：` +
        `\n- 视频本身评论较少` +
        `\n- TikHub API限流或错误` +
        `\n- 视频ID无效或已被删除`
      )
    }
  }

  return {
    source: 'db',
    comments: dbComments,
    total: dbComments.length
  }
}

/**
 * 获取内容的评论统计
 * （用于决策是否需要重新抓取）
 */
export async function getCommentStats(contentId: string): Promise<{
  dbCount: number
  lastCollectedAt: Date | null
}> {
  const result = await prisma.merchantContentComment.aggregate({
    where: { contentId },
    _count: true
  })

  const latest = await prisma.merchantContentComment.findFirst({
    where: { contentId },
    orderBy: { collectedAt: 'desc' },
    select: { collectedAt: true }
  })

  return {
    dbCount: result._count || 0,
    lastCollectedAt: latest?.collectedAt || null
  }
}
