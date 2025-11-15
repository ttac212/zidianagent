/**
 * 商家数据API路由
 * GET /api/merchants - 获取商家列表
 * POST /api/merchants - 创建新商家（管理员功能）
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { MerchantFilters, MerchantListResponse } from '@/types/merchant'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'
import * as dt from '@/lib/utils/date-toolkit'
import {
  validationError,
  unauthorized,
  forbidden
} from '@/lib/api/http-response'


// GET /api/merchants - 获取商家列表
export async function GET(request: NextRequest) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) return unauthorized('未认证')
  try {
    const { searchParams } = new URL(request.url)
    
    // 解析查询参数
    const filters: MerchantFilters = {
      search: searchParams.get('search') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      location: searchParams.get('location') || undefined,
      businessType: searchParams.get('businessType') as any || undefined,
      status: searchParams.get('status') as any || undefined,
      sortBy: searchParams.get('sortBy') as any || 'createdAt',
      sortOrder: searchParams.get('sortOrder') as any || 'desc',
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    }

    // 构建查询条件
    const where: any = {}
    
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
        { location: { contains: filters.search } },
      ]
    }
    
    if (filters.categoryId) {
      where.categoryId = filters.categoryId
    }
    
    if (filters.location) {
      where.location = { contains: filters.location }
    }
    
    if (filters.businessType) {
      where.businessType = filters.businessType
    }

    // 状态过滤：支持"ALL"表示全部状态，否则默认只显示ACTIVE
    if (filters.status && filters.status !== ('ALL' as any)) {
      where.status = filters.status
    } else if (!filters.status) {
      // 如果没有传status参数，默认只显示ACTIVE状态
      where.status = 'ACTIVE'
    }
    // 如果 filters.status === 'ALL'，则不添加where.status条件，显示所有状态

    // 排序配置
    const orderBy: any = {}
    if (filters.sortBy === 'totalEngagement') {
      orderBy.totalEngagement = filters.sortOrder
    } else {
      orderBy[filters.sortBy || 'createdAt'] = filters.sortOrder
    }

    // 分页计算
    const skip = ((filters.page || 1) - 1) * (filters.limit || 20)
    const take = filters.limit || 20

    // 查询数据
    const [merchants, total] = await Promise.all([
      prisma.merchant.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
              icon: true,
            }
          }
        },
        orderBy,
        skip,
        take,
      }),
      prisma.merchant.count({ where })
    ])

    // 格式化响应数据
    const response: MerchantListResponse = {
      merchants: merchants.map(merchant => ({
        id: merchant.id,
        uid: merchant.uid,
        name: merchant.name,
        description: merchant.description,
        location: merchant.location,
        businessType: merchant.businessType,
        status: merchant.status,
        totalContentCount: merchant.totalContentCount,
        totalDiggCount: merchant.totalDiggCount,
        totalCommentCount: merchant.totalCommentCount,
        totalCollectCount: merchant.totalCollectCount,
        totalShareCount: merchant.totalShareCount,
        totalEngagement: merchant.totalEngagement,
        lastCollectedAt: merchant.lastCollectedAt,
        createdAt: merchant.createdAt,
        category: merchant.category,
      })),
      total,
      page: filters.page || 1,
      limit: filters.limit || 20,
      hasMore: total > skip + take,
    }

    const jsonResponse = NextResponse.json(response)

    // 禁用缓存，确保每次都获取最新数据
    // 商家数据可能频繁变化（添加/删除/同步），不应该缓存
    jsonResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    jsonResponse.headers.set('Pragma', 'no-cache')
    jsonResponse.headers.set('Expires', '0')

    return jsonResponse
    
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

// POST /api/merchants - 创建新商家（管理员功能）
export async function POST(request: NextRequest) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) return unauthorized('未认证')

  try {
    // 权限检查：仅管理员可创建商家
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      console.log(`[Merchants] 非管理员尝试创建商家: ${session?.user?.email || 'unknown'}`)
      return forbidden('仅管理员可创建商家')
    }

    const body = await request.json()
    const { name, description, categoryId, location, address, businessType, contactInfo } = body

    if (!name) {
      return validationError('商家名称不能为空')
    }

    const merchant = await prisma.merchant.create({
      data: {
        uid: `manual_${dt.timestamp()}`, // 手动创建的商家使用特殊前缀
        name,
        description,
        categoryId,
        location,
        address,
        businessType: businessType || 'B2C',
        contactInfo,
        dataSource: 'manual',
      },
      include: {
        category: true,
      }
    })

    console.log(`[Merchants] 管理员 ${session.user.email} 创建商家: ${merchant.name} (${merchant.id})`)
    return NextResponse.json(merchant, { status: 201 })
    
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

export const dynamic = 'force-dynamic'
