/**
 * 商家分类API路由
 * GET /api/merchants/categories - 获取商家分类列表
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/merchants/categories - 获取商家分类列表
export async function GET(request: NextRequest) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) return NextResponse.json({ error: '未认证' }, { status: 401 })
  try {
    const categories = await prisma.merchantCategory.findMany({
      include: {
        _count: {
          select: { merchants: true }
        }
      },
      orderBy: {
        sortOrder: 'asc'
      }
    })

    return NextResponse.json(categories)
    
  } catch (error) {
    return NextResponse.json(
      { error: '获取商家分类失败' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'