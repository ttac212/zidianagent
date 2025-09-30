/**
 * 商家内容API路由
 * GET /api/merchants/[id]/contents - 获取商家内容列表
 */

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import type { ContentFilters, ContentListResponse } from '@/types/merchant'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'
import {
  success,
  validationError,
  notFound,
  unauthorized
} from '@/lib/api/http-response'


// GET /api/merchants/[id]/contents - 获取商家内容列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) return unauthorized('未认证')
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    
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
    
    // 如果有最小互动量过滤，需要与搜索条件合并
    if (filters.minEngagement) {
      const engagementConditions = [
        { diggCount: { gte: filters.minEngagement } },
        { commentCount: { gte: filters.minEngagement } },
        { collectCount: { gte: filters.minEngagement } },
      ]
      
      if (orConditions.length > 0) {
        // 如果有搜索条件，需要组合AND逻辑
        where.AND = [
          { OR: orConditions },
          { OR: engagementConditions }
        ]
      } else {
        // 只有互动量过滤
        where.OR = engagementConditions
      }
    } else if (orConditions.length > 0) {
      // 只有搜索条件
      where.OR = orConditions
    }

    // 排序配置
    const orderBy: any = {}
    orderBy[filters.sortBy || 'publishedAt'] = filters.sortOrder

    // 分页计算
    const skip = ((filters.page || 1) - 1) * (filters.limit || 20)
    const take = filters.limit || 20

    // 查询数据
    const [contents, total] = await Promise.all([
      prisma.merchantContent.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      prisma.merchantContent.count({ where })
    ])

    // 处理内容数据，解析JSON字段
    const processedContents = contents.map(content => ({
      ...content,
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
    }))

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
}

export const dynamic = 'force-dynamic'