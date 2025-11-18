/**
 * 商家客群分析人工修订
 * PATCH /api/merchants/[id]/audience/manual
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withMerchantAdminAuth } from '@/lib/api/merchant-auth'
import { validationError, notFound, success } from '@/lib/api/http-response'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'

// 长度限制（防止性能问题）
const MAX_MARKDOWN_LENGTH = 50000  // 50k 字符
const MAX_INSIGHTS_JSON_LENGTH = 20000  // 20k 字符（JSON 序列化后）

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withMerchantAdminAuth(request, params, async (_userId, req, params) => {
    try {
      const { id } = await params
      if (!id) return validationError('商家ID不能为空')

      const merchant = await prisma.merchant.findUnique({
        where: { id },
        select: { id: true }
      })
      if (!merchant) return notFound('商家不存在')

      const body = await req.json().catch(() => ({}))
      const { manualMarkdown, manualInsights } = body as {
        manualMarkdown?: string
        manualInsights?: Record<string, any> | null
      }

      // ✅ 长度校验
      if (manualMarkdown && manualMarkdown.length > MAX_MARKDOWN_LENGTH) {
        return validationError(
          `报告正文过长（${manualMarkdown.length} 字符），超过限制（${MAX_MARKDOWN_LENGTH} 字符）`
        )
      }

      if (manualInsights) {
        const insightsStr = JSON.stringify(manualInsights)
        if (insightsStr.length > MAX_INSIGHTS_JSON_LENGTH) {
          return validationError(
            `结构化洞察数据过大（${insightsStr.length} 字符），超过限制（${MAX_INSIGHTS_JSON_LENGTH} 字符）`
          )
        }
      }

      const analysis = await prisma.merchantAudienceAnalysis.findUnique({
        where: { merchantId: id }
      })

      if (!analysis) return notFound('Audience analysis not found')

      const updated = await prisma.merchantAudienceAnalysis.update({
        where: { merchantId: id },
        data: {
          manualMarkdown: manualMarkdown ?? undefined,
          manualInsights: manualInsights ?? undefined
        }
      })

      await prisma.merchantAudienceAnalysisVersion.create({
        data: {
          merchantId: id,
          analysisId: updated.id,
          snapshot: updated,
          source: 'manual'
        }
      })

      return success({ analysis: updated })
    } catch (error) {
      return createErrorResponse(error as Error, generateRequestId())
    }
  })
}
