/**
 * 商家内容API路由
 * GET /api/merchants/[id]/contents - 获取商家内容列表
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ContentFilters, ContentListResponse } from '@/types/merchant'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'
import {
  success,
  validationError,
  notFound
} from '@/lib/api/http-response'
import { withMerchantAuth } from '@/lib/api/merchant-auth'


// GET /api/merchants/[id]/contents - 获取商家内容列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withMerchantAuth(request, params, async (_userId, req, params) => {
    try {
      const { id } = await params
      const { searchParams } = new URL(req.url)
    
    if (!id) {
      return validationError('商家ID不能为空')
    }

    // 验证商家是否存在
    const merchant = await prisma.merchant.findUnique({
      where: { id }
    })

    if (!merchant) {
      return notFound('商家不存在')
    }

    // 解析查询参数
    const filters: ContentFilters = {
      merchantId: id,
      contentType: searchParams.get('contentType') as any || undefined,
      search: searchParams.get('search') || undefined,
      dateFrom: searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined,
      dateTo: searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined,
      hasTranscript: searchParams.get('hasTranscript') === 'true' ? true : undefined,
      minEngagement: searchParams.get('minEngagement') ? parseInt(searchParams.get('minEngagement')!) : undefined,
      sortBy: searchParams.get('sortBy') as any || 'publishedAt',
      sortOrder: searchParams.get('sortOrder') as any || 'desc',
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    }

    // 构建查询条件
    const where: any = {
      merchantId: id
    }
    
    // 收集所有OR条件
    const orConditions: any[] = []
    
    if (filters.search) {
      orConditions.push(
        { title: { contains: filters.search } },
        { content: { contains: filters.search } },
        { transcript: { contains: filters.search } }
      )
    }
    
    if (filters.contentType) {
      where.contentType = filters.contentType
    }
    
    if (filters.dateFrom || filters.dateTo) {
      where.publishedAt = {}
      if (filters.dateFrom) {
        where.publishedAt.gte = filters.dateFrom
      }
      if (filters.dateTo) {
        where.publishedAt.lte = filters.dateTo
      }
    }
    
    if (filters.hasTranscript !== undefined) {
      where.hasTranscript = filters.hasTranscript
    }
    
    // 如果有最小互动量过滤，计算总互动量
    // 注释：我们不在这里直接过滤 totalEngagement，因为历史数据可能为 0
    // 过滤逻辑将在查询后处理中进行（见下文）

    if (orConditions.length > 0) {
      // 只有搜索条件
      where.OR = orConditions
    }

    // 排序配置
    const orderBy: any = {}
    // 使用数据库层的 totalEngagement 字段进行排序（已优化性能）
    if (filters.sortBy === 'shareCount') {
      orderBy.shareCount = filters.sortOrder
    } else if (filters.sortBy === 'engagement') {
      // 使用数据库字段 totalEngagement 排序，避免内存计算
      orderBy.totalEngagement = filters.sortOrder
    } else {
      orderBy[filters.sortBy || 'publishedAt'] = filters.sortOrder
    }

    // 分页计算
    const skip = ((filters.page || 1) - 1) * (filters.limit || 20)
    const take = filters.limit || 20

    // 注意：不在数据库层面过滤 minEngagement，因为历史数据的 totalEngagement 可能为 0
    // 我们将在查询后动态计算并过滤

    // 统一查询路径（不再区分 engagement 排序）
    const [contents, total] = await Promise.all([
      prisma.merchantContent.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      prisma.merchantContent.count({ where })
    ])

    // 处理内容数据，解析JSON字段，并对 totalEngagement = 0 的记录动态计算
    let processedContents = contents.map(content => {
      // 动态计算 totalEngagement（兼容历史数据）
      const calculatedEngagement = content.totalEngagement === 0
        ? content.diggCount + content.commentCount + content.collectCount + content.shareCount
        : content.totalEngagement

      return {
        ...content,
        totalEngagement: calculatedEngagement, // 使用计算值覆盖
        parsedTags: (() => {
          try {
            return JSON.parse(content.tags)
          } catch {
            return []
          }
        })(),
        parsedTextExtra: (() => {
          try {
            return JSON.parse(content.textExtra)
          } catch {
            return []
          }
        })()
      }
    })

    // 如果启用了 minEngagement 过滤，需要在后处理中过滤（针对动态计算的值）
    if (filters.minEngagement !== undefined && filters.minEngagement > 0) {
      processedContents = processedContents.filter(
        content => content.totalEngagement >= filters.minEngagement!
      )
    }

    // 格式化响应数据
    const response: ContentListResponse = {
      contents: processedContents,
      total,
      page: filters.page || 1,
      limit: filters.limit || 20,
      hasMore: total > skip + take,
    }

      return success(response)

    } catch (error) {
      return createErrorResponse(error as Error, generateRequestId())
    }
  })
}

export const dynamic = 'force-dynamic'