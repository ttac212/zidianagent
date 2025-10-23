/**
 * 商家数据API路由
 * GET /api/merchants - 获取商家列表
 * POST /api/merchants - 创建新商家（管理员功能）
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import type { MerchantFilters, MerchantListResponse } from '@/types/merchant'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'
import * as dt from '@/lib/utils/date-toolkit'
import {
  validationError,
  unauthorized
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
    
    if (filters.status) {
      where.status = filters.status
    }
    // 不再默认过滤状态，显示所有商家（包括ACTIVE、SUSPENDED等）

    // 排序配置
    const orderBy: any = {}
    if (filters.sortBy === 'totalEngagement') {
      orderBy.totalDiggCount = filters.sortOrder
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

// POST /api/merchants - 创建新商家（预留管理功能）
export async function POST(request: NextRequest) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) return unauthorized('未认证')
  try {
    // 这里可以添加身份验证和权限检查
    // const session = await getServerSession(authOptions)
    // if (!session || session.user.role !== 'ADMIN') {
    //   return forbidden('权限不足')
    // }

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

    return NextResponse.json(merchant, { status: 201 })
    
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

export const dynamic = 'force-dynamic'