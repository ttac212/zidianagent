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
import { isTranscriptionRequiredError } from '@/lib/errors/transcription-errors'

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

      console.info('[ProfileAPI] 开始生成档案:', id)

      // 调用生成函数
      const result = await generateMerchantProfile(id)

      console.info('[ProfileAPI] 档案生成成功')

      const response: GenerateProfileResponse = {
        profile: result.profile,
        tokensUsed: result.tokensUsed,
        model: result.model
      }

      return success(response)

    } catch (error: any) {
      console.error('[ProfileAPI] 生成失败:', error)

      // 1. 优先处理转录需求错误（返回202 Accepted）
      if (isTranscriptionRequiredError(error)) {
        console.warn('[ProfileAPI] 检测到转录需求:', error.toJSON())
        return NextResponse.json(
          {
            success: false,
            ...error.toJSON(),
            hint: '请先转录缺失的内容，然后重新生成档案'
          },
          {
            status: 202 // Accepted - 需要先完成转录
          }
        )
      }

      // 2. 处理其他特定错误
      if (error.message?.includes('商家不存在')) {
        return apiError('商家不存在', { status: 404 })
      }

      if (error.message?.includes('商家暂无内容')) {
        return apiError('商家暂无内容,无法生成档案。请先添加商家内容后再试。', { status: 400 })
      }

      if (error.message?.includes('未配置LLM API Key')) {
        return apiError('服务配置错误,请联系管理员', { status: 500 })
      }

      if (error.message?.includes('LLM API调用失败')) {
        return apiError('AI服务暂时不可用,请稍后重试', { status: 503 })
      }

      // 通用错误
      return createErrorResponse(error as Error, generateRequestId())
    }
  })
}
