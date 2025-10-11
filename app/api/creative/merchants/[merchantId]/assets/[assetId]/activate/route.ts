/**
 * 设置资料为当前版本 API
 * POST /api/creative/merchants/:merchantId/assets/:assetId/activate
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { prisma } from '@/lib/prisma'
import {
  unauthorized,
  notFound
} from '@/lib/api/http-response'
import {
  createErrorResponse,
  generateRequestId
} from '@/lib/api/error-handler'
import { hasMerchantAccess } from '@/lib/auth/merchant-access'
import { activatePromptAsset } from '@/lib/repositories/prompt-asset-repository'

export async function POST(
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

    const asset = await prisma.merchantPromptAsset.findUnique({
      where: { id: params.assetId }
    })

    if (!asset || asset.merchantId !== params.merchantId) {
      return notFound('资料不存在')
    }

    // 使用仓储方法，带事务保护
    await activatePromptAsset(params.assetId)

    const updatedAsset = await prisma.merchantPromptAsset.findUnique({
      where: { id: params.assetId },
      select: { id: true, isActive: true }
    })

    if (!updatedAsset) {
      return notFound('资料不存在')
    }

    return NextResponse.json(
      {
        id: updatedAsset.id,
        isActive: updatedAsset.isActive
      },
      { status: 200 }
    )
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

export const dynamic = 'force-dynamic'
