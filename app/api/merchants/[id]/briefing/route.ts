/**
 * 商家对齐数据聚合
 * GET /api/merchants/[id]/briefing
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withMerchantAuth } from '@/lib/api/merchant-auth'
import { success, validationError, notFound } from '@/lib/api/http-response'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withMerchantAuth(request, params, async (_userId, _req, params) => {
    try {
      const { id } = await params
      if (!id) return validationError('商家ID不能为空')

      const merchant = await prisma.merchant.findUnique({
        where: { id },
        include: {
          category: true
        }
      })
      if (!merchant) return notFound('商家不存在')

      const profile = await prisma.merchantProfile.findUnique({
        where: { merchantId: id }
      })

      const audience = await prisma.merchantAudienceAnalysis.findUnique({
        where: { merchantId: id }
      })

      return success({
        merchant,
        profile,
        audience
      })
    } catch (error) {
      return createErrorResponse(error as Error, generateRequestId())
    }
  })
}
