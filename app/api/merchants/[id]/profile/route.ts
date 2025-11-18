/**
 * 商家创作档案API路由
 * GET /api/merchants/[id]/profile - 获取商家档案
 * PATCH /api/merchants/[id]/profile - 更新用户编辑部分
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { MerchantProfileResponse, UpdateProfileData } from '@/types/merchant'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'
import {
  validationError,
  notFound,
  success
} from '@/lib/api/http-response'
import { withMerchantAuth, withMerchantAdminAuth } from '@/lib/api/merchant-auth'

// 长度限制（防止性能问题）
const MAX_NOTES_LENGTH = 10000       // 10k 字符
const MAX_CUSTOM_FIELD_LENGTH = 5000  // 5k 字符
const MAX_BRIEF_JSON_LENGTH = 20000   // 20k 字符（JSON 序列化后）

function buildProfileUpdateData(body: UpdateProfileData) {
  const data: any = {}

  // ✅ 长度校验：customBackground
  if (body.customBackground !== undefined) {
    if (body.customBackground && body.customBackground.length > MAX_CUSTOM_FIELD_LENGTH) {
      throw new Error(`创业背景过长（${body.customBackground.length} 字符），超过限制（${MAX_CUSTOM_FIELD_LENGTH} 字符）`)
    }
    data.customBackground = body.customBackground || null
  }

  // ✅ 长度校验：customOfflineInfo
  if (body.customOfflineInfo !== undefined) {
    if (body.customOfflineInfo && body.customOfflineInfo.length > MAX_CUSTOM_FIELD_LENGTH) {
      throw new Error(`线下信息过长（${body.customOfflineInfo.length} 字符），超过限制（${MAX_CUSTOM_FIELD_LENGTH} 字符）`)
    }
    data.customOfflineInfo = body.customOfflineInfo || null
  }

  // ✅ 长度校验：customProductDetails
  if (body.customProductDetails !== undefined) {
    if (body.customProductDetails && body.customProductDetails.length > MAX_CUSTOM_FIELD_LENGTH) {
      throw new Error(`产品详情过长（${body.customProductDetails.length} 字符），超过限制（${MAX_CUSTOM_FIELD_LENGTH} 字符）`)
    }
    data.customProductDetails = body.customProductDetails || null
  }

  // ✅ 长度校验：customDosAndDonts
  if (body.customDosAndDonts !== undefined) {
    if (body.customDosAndDonts && body.customDosAndDonts.length > MAX_CUSTOM_FIELD_LENGTH) {
      throw new Error(`禁忌清单过长（${body.customDosAndDonts.length} 字符），超过限制（${MAX_CUSTOM_FIELD_LENGTH} 字符）`)
    }
    data.customDosAndDonts = body.customDosAndDonts || null
  }

  // ✅ 长度校验：manualNotes
  if (body.manualNotes !== undefined) {
    if (body.manualNotes && body.manualNotes.length > MAX_NOTES_LENGTH) {
      throw new Error(`人工补充信息过长（${body.manualNotes.length} 字符），超过限制（${MAX_NOTES_LENGTH} 字符）`)
    }
    data.manualNotes = body.manualNotes || null
  }

  // ✅ 长度校验：manualBrief（JSON）
  if (body.manualBrief !== undefined) {
    if (body.manualBrief) {
      const briefStr = JSON.stringify(body.manualBrief)
      if (briefStr.length > MAX_BRIEF_JSON_LENGTH) {
        throw new Error(`Brief 数据过大（${briefStr.length} 字符），超过限制（${MAX_BRIEF_JSON_LENGTH} 字符）`)
      }
    }
    data.manualBrief = body.manualBrief || null
  }

  return data
}

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
          ...buildProfileUpdateData(body)
        },
        update: {
          ...buildProfileUpdateData(body)
          // 注意: 不更新 ai* 字段(保持不变)
        }
      })

      // 写入版本历史
      await prisma.merchantProfileVersion.create({
        data: {
          merchantId: id,
          profileId: profile.id,
          snapshot: profile,
          source: 'manual'
        }
      })

      return success({ profile })

    } catch (error) {
      return createErrorResponse(error as Error, generateRequestId())
    }
  })
}
