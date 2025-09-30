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

export const dynamic = 'force-dynamic'