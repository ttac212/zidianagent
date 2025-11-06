/**
 * 商家创作档案API路由
 * GET /api/merchants/[id]/profile - 获取商家档案
 * PATCH /api/merchants/[id]/profile - 更新用户编辑部分
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { MerchantProfileResponse, UpdateProfileData } from '@/types/merchant'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'
import {
  validationError,
  notFound,
  success
} from '@/lib/api/http-response'
import { withMerchantAuth, withMerchantAdminAuth } from '@/lib/api/merchant-auth'

// GET /api/merchants/[id]/profile - 获取商家档案
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withMerchantAuth(request, params, async (_userId, _req, params) => {
    try {
      const { id } = await params

      if (!id) {
        return validationError('商家ID不能为空')
      }

      // 查询商家基本信息
      const merchant = await prisma.merchant.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          totalContentCount: true
        }
      })

      if (!merchant) {
        return notFound('商家不存在')
      }

      // 查询档案(可能不存在)
      const profile = await prisma.merchantProfile.findUnique({
        where: { merchantId: id }
      })

      const response: MerchantProfileResponse = {
        profile,
        merchant
      }

      return success(response)

    } catch (error) {
      return createErrorResponse(error as Error, generateRequestId())
    }
  })
}

// PATCH /api/merchants/[id]/profile - 更新用户编辑部分
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withMerchantAdminAuth(request, params, async (_userId, req, params) => {
    try {
      const { id } = await params

      if (!id) {
        return validationError('商家ID不能为空')
      }

      // 验证商家存在
      const merchant = await prisma.merchant.findUnique({
        where: { id },
        select: { id: true }
      })

      if (!merchant) {
        return notFound('商家不存在')
      }

      // 解析请求体
      const body: UpdateProfileData = await req.json()

      // 更新或创建档案(只更新用户字段)
      const profile = await prisma.merchantProfile.upsert({
        where: { merchantId: id },
        create: {
          merchantId: id,
          customBackground: body.customBackground || null,
          customOfflineInfo: body.customOfflineInfo || null,
          customProductDetails: body.customProductDetails || null,
          customDosAndDonts: body.customDosAndDonts || null
        },
        update: {
          customBackground: body.customBackground || null,
          customOfflineInfo: body.customOfflineInfo || null,
          customProductDetails: body.customProductDetails || null,
          customDosAndDonts: body.customDosAndDonts || null
          // 注意: 不更新 ai* 字段(13个字段保持不变)
        }
      })

      return success({ profile })

    } catch (error) {
      return createErrorResponse(error as Error, generateRequestId())
    }
  })
}
