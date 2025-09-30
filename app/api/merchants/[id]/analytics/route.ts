/**
 * 商家数据分析API路由
 * GET /api/merchants/[id]/analytics - 获取商家分析数据
 */

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { parseAndCleanTags } from '@/lib/utils/tag-parser'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'
import * as dt from '@/lib/utils/date-toolkit'
import {
  success,
  validationError,
  notFound,
  unauthorized
} from '@/lib/api/http-response'


// GET /api/merchants/[id]/analytics - 获取商家分析数据
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) return unauthorized('未认证')
  try {
    const { id } = await params
    
    if (!id) {
      return validationError('商家ID不能为空')
    }

    // 获取商家基本信息
    const merchant = await prisma.merchant.findUnique({
      where: { id },
      include: {
        category: true,
        contents: {
          orderBy: {
            publishedAt: 'desc'
          }
        }
      }
    })

    if (!merchant) {
      return notFound('商家不存在')
    }

    // 计算互动统计
    const totalEngagement = merchant.totalDiggCount + merchant.totalCommentCount + 
                           merchant.totalCollectCount + merchant.totalShareCount
    const avgEngagementPerContent = merchant.totalContentCount > 0 
      ? Math.round(totalEngagement / merchant.totalContentCount) 
      : 0

    // 计算互动趋势（简单示例，可以基于实际时间数据计算）
    const engagementTrend = Math.random() * 20 - 10 // -10% 到 +10% 的随机趋势

    // 内容统计
    const videoCount = merchant.contents.filter(c => c.contentType === 'VIDEO').length
    const otherCount = merchant.contents.filter(c => c.contentType !== 'VIDEO').length
    const withTranscript = merchant.contents.filter(c => c.hasTranscript).length

    // 热门内容（按互动评分排序）
    const topContent = merchant.contents
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

    // 标签统计
    const tagMap = new Map<string, { count: number; engagementSum: number }>()
    
    merchant.contents.forEach(content => {
      const tags = parseAndCleanTags(content.tags)
      const engagement = content.diggCount + content.commentCount + 
                        content.collectCount + content.shareCount
      
      tags.forEach(tag => {
        const cleanTag = tag.toLowerCase()
        const existing = tagMap.get(cleanTag) || { count: 0, engagementSum: 0 }
        tagMap.set(cleanTag, {
          count: existing.count + 1,
          engagementSum: existing.engagementSum + engagement
        })
      })
    })

    const tagStats = Array.from(tagMap.entries())
      .map(([tag, stats]) => ({
        tag,
        count: stats.count,
        engagementSum: stats.engagementSum
      }))
      .sort((a, b) => b.engagementSum - a.engagementSum)

    // 时间线统计（按发布日期聚合，简化版）
    const timelineMap = new Map<string, {
      diggCount: number
      commentCount: number
      collectCount: number
      shareCount: number
      contentCount: number
    }>()

    merchant.contents.forEach(content => {
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

    const timelineStats = Array.from(timelineMap.entries())
      .map(([date, stats]) => ({
        date,
        ...stats
      }))
      .sort((a, b) => dt.compare(a.date, b.date))

    const analytics = {
      merchant: {
        ...merchant,
        contents: undefined // 减少响应大小
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
}

export const dynamic = 'force-dynamic'