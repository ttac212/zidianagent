/**
 * 商家数据分析API路由
 * GET /api/merchants/[id]/analytics - 获取商家分析数据
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseAndCleanTags } from '@/lib/utils/tag-parser'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'
import * as dt from '@/lib/utils/date-toolkit'
import {
  success,
  validationError,
  notFound
} from '@/lib/api/http-response'
import { withMerchantAuth } from '@/lib/api/merchant-auth'


// GET /api/merchants/[id]/analytics - 获取商家分析数据
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withMerchantAuth(request, params, async (_userId, _req, params) => {
    try {
      const { id } = await params

      if (!id) {
        return validationError('商家ID不能为空')
      }

    // 获取商家基本信息（不加载全部内容）
    const merchant = await prisma.merchant.findUnique({
      where: { id },
      include: {
        category: true,
      }
    })

    if (!merchant) {
      return notFound('商家不存在')
    }

    const totalEngagement = merchant.totalEngagement ?? (
      merchant.totalDiggCount +
      merchant.totalCommentCount +
      merchant.totalCollectCount +
      merchant.totalShareCount
    )
    const avgEngagementPerContent = merchant.totalContentCount > 0
      ? Math.round(totalEngagement / merchant.totalContentCount)
      : 0

    const now = dt.now()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    const timelineStart = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000)
    const analyticsSampleSize = 1000

    const [
      recentAgg,
      previousAgg,
      contentTypeStats,
      transcriptStats,
      topContentRaw,
      analyticsContents,
    ] = await Promise.all([
      prisma.merchantContent.aggregate({
        where: {
          merchantId: id,
          publishedAt: { gte: thirtyDaysAgo }
        },
        _count: { _all: true },
        _sum: {
          diggCount: true,
          commentCount: true,
          collectCount: true,
          shareCount: true,
        }
      }),
      prisma.merchantContent.aggregate({
        where: {
          merchantId: id,
          publishedAt: {
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo,
          }
        },
        _count: { _all: true },
        _sum: {
          diggCount: true,
          commentCount: true,
          collectCount: true,
          shareCount: true,
        }
      }),
      prisma.merchantContent.groupBy({
        by: ['contentType'],
        where: { merchantId: id },
        _count: { _all: true }
      }),
      prisma.merchantContent.groupBy({
        by: ['hasTranscript'],
        where: { merchantId: id },
        _count: { _all: true }
      }),
      prisma.merchantContent.findMany({
        where: { merchantId: id },
        select: {
          id: true,
          title: true,
          diggCount: true,
          commentCount: true,
          collectCount: true,
          shareCount: true,
          publishedAt: true,
        },
        orderBy: [
          { diggCount: 'desc' },
          { commentCount: 'desc' },
          { collectCount: 'desc' },
          { shareCount: 'desc' },
        ],
        take: 50,
      }),
      prisma.merchantContent.findMany({
        where: {
          merchantId: id,
          publishedAt: { not: null, gte: timelineStart }
        },
        select: {
          tags: true,
          publishedAt: true,
          diggCount: true,
          commentCount: true,
          collectCount: true,
          shareCount: true,
        },
        orderBy: { publishedAt: 'desc' },
        take: analyticsSampleSize,
      }),
    ])

    const sumEngagement = (sum?: {
      diggCount: number | null
      commentCount: number | null
      collectCount: number | null
      shareCount: number | null
    }) =>
      (sum?.diggCount ?? 0) +
      (sum?.commentCount ?? 0) +
      (sum?.collectCount ?? 0) +
      (sum?.shareCount ?? 0)

    const recentCount = recentAgg._count._all || 0
    const previousCount = previousAgg._count._all || 0
    const recentEngagement = sumEngagement(recentAgg._sum)
    const previousEngagement = sumEngagement(previousAgg._sum)

    const recentAvg = recentCount > 0 ? recentEngagement / recentCount : 0
    const previousAvg = previousCount > 0 ? previousEngagement / previousCount : 0
    const engagementTrend = previousAvg > 0
      ? ((recentAvg - previousAvg) / previousAvg) * 100
      : 0

    const videoCount = contentTypeStats.find(s => s.contentType === 'VIDEO')?._count._all || 0
    const otherCount = Math.max(merchant.totalContentCount - videoCount, 0)
    const withTranscript = transcriptStats.find(s => s.hasTranscript === true)?._count._all || 0

    const topContent = topContentRaw
      .map(content => ({
        id: content.id,
        title: content.title,
        diggCount: content.diggCount,
        commentCount: content.commentCount,
        collectCount: content.collectCount,
        shareCount: content.shareCount,
        engagementScore: content.diggCount + content.commentCount * 2 +
                        content.collectCount * 3 + content.shareCount * 4,
        publishedAt: content.publishedAt?.toISOString() || null
      }))
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 10)

    const tagMap = new Map<string, { count: number; engagementSum: number }>()
    const timelineMap = new Map<string, {
      diggCount: number
      commentCount: number
      collectCount: number
      shareCount: number
      contentCount: number
    }>()

    analyticsContents.forEach(content => {
      const engagement = content.diggCount + content.commentCount +
                        content.collectCount + content.shareCount

      parseAndCleanTags(content.tags).forEach(tag => {
        const cleanTag = tag.toLowerCase()
        const existing = tagMap.get(cleanTag) || { count: 0, engagementSum: 0 }
        tagMap.set(cleanTag, {
          count: existing.count + 1,
          engagementSum: existing.engagementSum + engagement
        })
      })

      if (content.publishedAt) {
        const date = content.publishedAt.toISOString().split('T')[0]
        const existing = timelineMap.get(date) || {
          diggCount: 0,
          commentCount: 0,
          collectCount: 0,
          shareCount: 0,
          contentCount: 0
        }

        timelineMap.set(date, {
          diggCount: existing.diggCount + content.diggCount,
          commentCount: existing.commentCount + content.commentCount,
          collectCount: existing.collectCount + content.collectCount,
          shareCount: existing.shareCount + content.shareCount,
          contentCount: existing.contentCount + 1
        })
      }
    })

    const tagStats = Array.from(tagMap.entries())
      .map(([tag, stats]) => ({
        tag,
        count: stats.count,
        engagementSum: stats.engagementSum
      }))
      .sort((a, b) => b.engagementSum - a.engagementSum)
      .slice(0, 50)

    const timelineStats = Array.from(timelineMap.entries())
      .map(([date, stats]) => ({
        date,
        ...stats
      }))
      .sort((a, b) => dt.compare(a.date, b.date))

    const analytics = {
      merchant: {
        ...merchant,
      },
      engagementStats: {
        totalEngagement,
        avgEngagementPerContent,
        engagementTrend
      },
      contentStats: {
        totalContent: merchant.totalContentCount,
        videoCount,
        otherCount,
        withTranscript
      },
      timelineStats,
      topContent,
      tagStats
    }

      return success(analytics)

    } catch (error) {
      return createErrorResponse(error as Error, generateRequestId())
    }
  })
}

export const dynamic = 'force-dynamic'
