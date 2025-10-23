/**
 * 商家详情API路由
 * GET /api/merchants/[id] - 获取商家详情
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import type { MerchantDetailResponse } from '@/types/merchant'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'
import {
  validationError,
  notFound,
  unauthorized
} from '@/lib/api/http-response'


// GET /api/merchants/[id] - 获取商家详情
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

    const merchant = await prisma.merchant.findUnique({
      where: { id },
      include: {
        category: true,
        contents: {
          orderBy: {
            publishedAt: 'desc'
          },
          take: 20 // 默认只返回最新的20条内容
        },
        _count: {
          select: { contents: true }
        }
      }
    })

    if (!merchant) {
      return notFound('商家不存在')
    }

    // 处理内容数据，解析JSON字段
    const processedContents = merchant.contents.map(content => ({
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

    const response: MerchantDetailResponse = {
      merchant: {
        ...merchant,
        contents: processedContents
      }
    }

    return NextResponse.json(response)
    
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

// PATCH /api/merchants/[id] - 更新商家信息
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req: request as any })

  // 只允许管理员更新商家信息
  if (!token?.sub) return unauthorized('未认证')
  if (token.role !== 'ADMIN') {
    return unauthorized('只有管理员可以编辑商家信息')
  }

  try {
    const { id } = await params

    if (!id) {
      return validationError('商家ID不能为空')
    }

    // 检查商家是否存在
    const existingMerchant = await prisma.merchant.findUnique({
      where: { id }
    })

    if (!existingMerchant) {
      return notFound('商家不存在')
    }

    // 解析请求体
    const body = await request.json()
    const {
      name,
      description,
      location,
      address,
      businessType,
      status,
      categoryId,
    } = body

    // 验证必填字段
    if (name !== undefined && !name.trim()) {
      return validationError('商家名称不能为空')
    }

    // 如果指定了分类ID，检查分类是否存在
    if (categoryId && categoryId !== null) {
      const categoryExists = await prisma.merchantCategory.findUnique({
        where: { id: categoryId }
      })
      if (!categoryExists) {
        return validationError('指定的分类不存在')
      }
    }

    // 更新商家信息
    const updatedMerchant = await prisma.merchant.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(location !== undefined && { location: location?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(businessType !== undefined && { businessType }),
        ...(status !== undefined && { status }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        updatedAt: new Date(),
      },
      include: {
        category: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        merchant: updatedMerchant
      }
    })

  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

export const dynamic = 'force-dynamic'