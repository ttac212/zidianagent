/**
 * 商家创作档案生成API路由
 * POST /api/merchants/[id]/profile/generate - 生成或刷新AI档案
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateMerchantProfile } from '@/lib/ai/profile-generator'
import type { GenerateProfileResponse } from '@/types/merchant'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'
import {
  validationError,
  success,
  error as apiError
} from '@/lib/api/http-response'
import { withMerchantAdminAuth } from '@/lib/api/merchant-auth'

// POST /api/merchants/[id]/profile/generate - 生成或刷新AI档案
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withMerchantAdminAuth(request, params, async (_userId, _req, params) => {
    try {
      const { id } = await params

      if (!id) {
        return validationError('商家ID不能为空')
      }

      console.log('[ProfileAPI] 开始生成档案:', id)

      // 调用生成函数
      const result = await generateMerchantProfile(id)

      console.log('[ProfileAPI] 档案生成成功')

      const response: GenerateProfileResponse = {
        profile: result.profile,
        tokensUsed: result.tokensUsed,
        model: result.model
      }

      return success(response)

    } catch (error: any) {
      console.error('[ProfileAPI] 生成失败:', error)

      // 处理特定错误
      if (error.message?.includes('商家不存在')) {
        return apiError('商家不存在', 404)
      }

      if (error.message?.includes('商家暂无内容')) {
        return apiError('商家暂无内容,无法生成档案。请先添加商家内容后再试。', 400)
      }

      if (error.message?.includes('未配置LLM API Key')) {
        return apiError('服务配置错误,请联系管理员', 500)
      }

      if (error.message?.includes('LLM API调用失败')) {
        return apiError('AI服务暂时不可用,请稍后重试', 503)
      }

      // 通用错误
      return createErrorResponse(error as Error, generateRequestId())
    }
  })
}
