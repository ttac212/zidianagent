/**
 * 商家客群分析版本历史
 * GET /api/merchants/[id]/audience/versions
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
        select: { id: true }
      })
      if (!merchant) return notFound('商家不存在')

      const versions = await prisma.merchantAudienceAnalysisVersion.findMany({
        where: { merchantId: id },
        orderBy: { createdAt: 'desc' },
        take: 10
      })

      return success({ versions })
    } catch (error) {
      return createErrorResponse(error as Error, generateRequestId())
    }
  })
}
