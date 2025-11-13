/**
 * 商家评论来源管理器
 *
 * 策略：只从数据库读取已采集的评论（简化版）
 *
 * Linus 式设计原则：
 * - 数据结构第一：CleanedComment 统一格式
 * - 简单粗暴：只从数据库读取，没有就报错
 */

import { prisma } from '@/lib/prisma'

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
 * 获取分析用评论数据
 *
 * 策略：只从数据库读取，如果评论不足则抛出错误
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

  const dbComments = await loadCommentsFromDatabase(contentId, maxComments)

  // 检查是否有足够的评论（至少 20 条）
  if (dbComments.length < 20) {
    throw new Error(
      `该视频评论数据不足（${dbComments.length} < 20），无法进行分析。请等待系统采集更多评论数据。`
    )
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
