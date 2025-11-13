/**
 * 商家内容TOP5洞察API
 * GET /api/merchants/[id]/top-insights - 获取近6个月内容的TOP5数据（点赞/评论/互动）
 */

import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'
import { validationError, notFound, success } from '@/lib/api/http-response'
import { withMerchantAuth } from '@/lib/api/merchant-auth'

// 计算互动评分
function calculateEngagementScore(content: {
  diggCount: number
  commentCount: number
  collectCount: number
  shareCount: number
}) {
  return (
    content.diggCount +
    content.commentCount * 2 +
    content.collectCount * 3 +
    content.shareCount * 4
  )
}

// GET /api/merchants/[id]/top-insights - 获取近6个月TOP5洞察
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

      // 检查商家是否存在
      const merchant = await prisma.merchant.findUnique({
        where: { id },
        select: { id: true, name: true }
      })

      if (!merchant) {
        return notFound('商家不存在')
      }

      const now = new Date()
      const sixMonthsAgo = new Date(now)
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

      const baseWhere = {
        merchantId: id,
        publishedAt: {
          gte: sixMonthsAgo
        }
      }

      const [
        totalContents,
        topLikesRaw,
        topCommentsRaw,
        topEngagementIdRows
      ] = await Promise.all([
        prisma.merchantContent.count({ where: baseWhere }),
        prisma.merchantContent.findMany({
          where: baseWhere,
          orderBy: [
            { diggCount: 'desc' },
            { publishedAt: 'desc' }
          ],
          take: 5,
          include: {
            comments: {
              orderBy: { diggCount: 'desc' },
              take: 5
            }
          }
        }),
        prisma.merchantContent.findMany({
          where: baseWhere,
          orderBy: [
            { commentCount: 'desc' },
            { publishedAt: 'desc' }
          ],
          take: 5,
          include: {
            comments: {
              orderBy: { diggCount: 'desc' },
              take: 5
            }
          }
        }),
        prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT "id"
          FROM "merchant_contents"
          WHERE "merchantId" = ${id}
            AND "publishedAt" >= ${sixMonthsAgo}
          ORDER BY ("diggCount" + "commentCount" * 2 + "collectCount" * 3 + "shareCount" * 4) DESC,
                   "publishedAt" DESC
          LIMIT 5
        `)
      ])

      const dateRange = {
        from: sixMonthsAgo.toISOString(),
        to: now.toISOString()
      }

      if (totalContents === 0) {
        return success({
          topLikes: [],
          topComments: [],
          topEngagement: [],
          totalContents: 0,
          dateRange
        })
      }

      const topEngagementIds = topEngagementIdRows.map(row => row.id)
      const topEngagementRaw = topEngagementIds.length
        ? await prisma.merchantContent.findMany({
            where: { id: { in: topEngagementIds } },
            include: {
              comments: {
                orderBy: { diggCount: 'desc' },
                take: 5
              }
            }
          })
        : []

      const engagementMap = new Map(topEngagementRaw.map(content => [content.id, content]))
      const orderedTopEngagement = topEngagementIds
        .map(contentId => engagementMap.get(contentId))
        .filter((content): content is typeof topEngagementRaw[number] => Boolean(content))

      const toEntry = (content: any) => ({
        id: content.id,
        title: content.title,
        diggCount: content.diggCount,
        commentCount: content.commentCount,
        collectCount: content.collectCount,
        shareCount: content.shareCount,
        engagementScore: calculateEngagementScore(content),
        publishedAt: content.publishedAt,
        shareUrl: content.shareUrl,
        comments: (content.comments || []).map((comment: any) => ({
          id: comment.id,
          text: comment.text,
          diggCount: comment.diggCount,
          replyCount: comment.replyCount,
          createdAt: comment.createdAt
        }))
      })

      return success({
        topLikes: topLikesRaw.map(toEntry),
        topComments: topCommentsRaw.map(toEntry),
        topEngagement: orderedTopEngagement.map(toEntry),
        totalContents,
        dateRange
      })

    } catch (error) {
      return createErrorResponse(error as Error, generateRequestId())
    }
  })
}

export const dynamic = 'force-dynamic'
