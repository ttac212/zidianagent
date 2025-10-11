/**
 * 单个资料 API
 * PUT /api/creative/merchants/:merchantId/assets/:assetId
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { prisma } from '@/lib/prisma'
import {
  unauthorized,
  notFound,
  validationError
} from '@/lib/api/http-response'
import {
  createErrorResponse,
  generateRequestId
} from '@/lib/api/error-handler'
import { hasMerchantAccess } from '@/lib/auth/merchant-access'
import { createPromptAssetVersion } from '@/lib/repositories/prompt-asset-repository'

export async function PUT(
  request: NextRequest,
  { params }: { params: { merchantId: string; assetId: string } }
) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) {
    return unauthorized('未认证访问')
  }

  try {
    const accessible = await hasMerchantAccess(
      token.sub,
      params.merchantId,
      (token as any).role
    )
    if (!accessible) {
      return notFound('商家不存在或无权访问')
    }

    const existingAsset = await prisma.merchantPromptAsset.findUnique({
      where: { id: params.assetId }
    })

    if (!existingAsset || existingAsset.merchantId !== params.merchantId) {
      return notFound('资料不存在')
    }

    const payload = await request.json()
    const { title, content, isActive } = payload ?? {}

    if (!title || !content) {
      return validationError('title 和 content 不能为空')
    }

    // 使用仓储方法，带事务和 P2002 重试
    const newAsset = await createPromptAssetVersion({
      merchantId: params.merchantId,
      type: existingAsset.type,
      title,
      content,
      createdBy: token.sub,
      parentId: params.assetId,
      activate: isActive ?? false
    })

    return NextResponse.json(
      {
        id: newAsset.id,
        type: newAsset.type,
        title: newAsset.title,
        version: newAsset.version,
        isActive: newAsset.isActive,
        createdAt: newAsset.createdAt
      },
      { status: 200 }
    )
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

export const dynamic = 'force-dynamic'
