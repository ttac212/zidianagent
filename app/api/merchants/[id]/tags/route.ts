/**
 * 商家标签分析API路由
 * GET /api/merchants/[id]/tags - 获取商家标签分析数据
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { PrismaClient } from '@prisma/client'
import { parseAndCleanTags } from '@/lib/utils/tag-parser'

const prisma = new PrismaClient()

// GET /api/merchants/[id]/tags - 获取商家标签分析数据
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) return NextResponse.json({ error: '未认证' }, { status: 401 })
  try {
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: '商家ID不能为空' },
        { status: 400 }
      )
    }

    // 获取商家及其内容
    const merchant = await prisma.merchant.findUnique({
      where: { id },
      include: {
        contents: {
          select: {
            id: true,
            tags: true,
            contentType: true,
            diggCount: true,
            commentCount: true,
            collectCount: true,
            shareCount: true,
          }
        }
      }
    })

    if (!merchant) {
      return NextResponse.json(
        { error: '商家不存在' },
        { status: 404 }
      )
    }

    // 标签统计数据结构
    const tagMap = new Map<string, {
      count: number
      engagementSum: number
      contentIds: string[]
      contentTypes: Set<string>
    }>()

    let totalTagCount = 0

    // 处理每个内容的标签
    merchant.contents.forEach(content => {
      const tags = parseAndCleanTags(content.tags)
      const engagement = content.diggCount + content.commentCount + 
                        content.collectCount + content.shareCount
      
      tags.forEach(tag => {
        const cleanTag = tag.toLowerCase()
        
        if (!tagMap.has(cleanTag)) {
          tagMap.set(cleanTag, {
            count: 0,
            engagementSum: 0,
            contentIds: [],
            contentTypes: new Set<string>()
          })
        }
        
        const existing = tagMap.get(cleanTag)!
        
        // 只有当这个内容ID还没有计入这个标签时才增加计数
        if (!existing.contentIds.includes(content.id)) {
          totalTagCount++
          existing.count++
          existing.engagementSum += engagement
          existing.contentIds.push(content.id)
          existing.contentTypes.add(content.contentType)
        }
      })
    })

    // 转换为标签统计数组
    const tagStats = Array.from(tagMap.entries())
      .map(([tag, stats]) => ({
        tag,
        count: stats.count,
        engagementSum: stats.engagementSum,
        avgEngagement: Math.round(stats.engagementSum / stats.count),
        contentIds: stats.contentIds,
        contentTypes: Array.from(stats.contentTypes)
      }))
      .sort((a, b) => b.count - a.count)

    // 高表现标签（按平均互动排序，且使用次数>=3）
    const highPerformingTags = tagStats
      .filter(tag => tag.count >= 3)
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 10)

    // 成长中的标签（使用频率高但平均互动也不错的标签）
    const growingTags = tagStats
      .filter(tag => tag.count >= 2 && tag.avgEngagement > 0)
      .sort((a, b) => (b.count * b.avgEngagement) - (a.count * a.avgEngagement))
      .slice(0, 10)

    // 按内容类型分类标签
    const categoryTagMap = new Map<string, Set<string>>()
    
    merchant.contents.forEach(content => {
      const tags = parseAndCleanTags(content.tags)
      const contentType = content.contentType
      
      if (!categoryTagMap.has(contentType)) {
        categoryTagMap.set(contentType, new Set<string>())
      }
      
      tags.forEach(tag => {
        categoryTagMap.get(contentType)?.add(tag.toLowerCase())
      })
    })

    const categoryTags = Array.from(categoryTagMap.entries()).map(([category, tags]) => ({
      category,
      tags: Array.from(tags),
      count: tags.size
    }))

    // 构建响应数据
    const analysisData = {
      totalTags: totalTagCount,
      uniqueTags: tagMap.size,
      topTags: tagStats,
      categoryTags,
      engagementAnalysis: {
        highPerformingTags,
        growingTags
      }
    }

    return NextResponse.json(analysisData)
    
  } catch (error) {
    return NextResponse.json(
      { error: '获取标签分析数据失败' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'