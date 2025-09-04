/**
 * 商家统计数据API路由
 * GET /api/merchants/stats - 获取商家统计数据
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { PrismaClient } from '@prisma/client'
import type { MerchantStatsResponse } from '@/types/merchant'

const prisma = new PrismaClient()

// GET /api/merchants/stats - 获取商家统计数据
export async function GET(request: NextRequest) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) return NextResponse.json({ error: '未认证' }, { status: 401 })
  try {
    // 并行查询所有统计数据
    const [
      totalMerchants,
      activeCount,
      inactiveCount,
      categoryStats,
      locationStats,
      businessTypeStats,
      contentStats,
      engagementStats
    ] = await Promise.all([
      // 总商家数
      prisma.merchant.count(),
      
      // 活跃商家数
      prisma.merchant.count({
        where: { status: 'ACTIVE' }
      }),
      
      // 停用商家数
      prisma.merchant.count({
        where: { status: { in: ['INACTIVE', 'SUSPENDED', 'DELETED'] } }
      }),
      
      // 按分类统计
      prisma.merchantCategory.findMany({
        include: {
          _count: {
            select: { merchants: true }
          }
        },
        orderBy: {
          sortOrder: 'asc'
        }
      }),
      
      // 按地区统计
      prisma.merchant.groupBy({
        by: ['location'],
        _count: { id: true },
        where: {
          location: { not: null },
          status: 'ACTIVE'
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        },
        take: 10 // 取前10个地区
      }),
      
      // 按业务类型统计
      prisma.merchant.groupBy({
        by: ['businessType'],
        _count: { id: true },
        where: { status: 'ACTIVE' }
      }),
      
      // 内容统计
      prisma.merchant.aggregate({
        _sum: {
          totalContentCount: true
        }
      }),
      
      // 互动统计
      prisma.merchant.aggregate({
        _sum: {
          totalDiggCount: true,
          totalCommentCount: true,
          totalCollectCount: true,
          totalShareCount: true
        }
      })
    ])

    // 计算总互动数
    const totalEngagement = 
      (engagementStats._sum.totalDiggCount || 0) +
      (engagementStats._sum.totalCommentCount || 0) +
      (engagementStats._sum.totalCollectCount || 0) +
      (engagementStats._sum.totalShareCount || 0)

    // 格式化响应数据
    const stats = {
      totalMerchants,
      activeCount,
      inactiveCount,
      totalContent: contentStats._sum.totalContentCount || 0,
      totalEngagement,
      categories: categoryStats.map(category => ({
        name: category.name,
        count: category._count.merchants,
        color: category.color
      })),
      locations: locationStats
        .filter(item => item.location)
        .map(item => ({
          name: item.location!,
          count: item._count.id
        })),
      businessTypes: businessTypeStats.map(item => ({
        type: item.businessType,
        count: item._count.id
      }))
    }

    const response: MerchantStatsResponse = { stats }
    return NextResponse.json(response)
    
  } catch (error) {
    return NextResponse.json(
      { error: '获取商家统计数据失败' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'