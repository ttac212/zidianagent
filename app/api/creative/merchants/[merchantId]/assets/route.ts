/**
 * 商家资料 API
 * GET /api/creative/merchants/:merchantId/assets?type=REPORT|PROMPT
 * POST /api/creative/merchants/:merchantId/assets
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { prisma } from '@/lib/prisma'
import {
  unauthorized,
  notFound,
  success,
  validationError
} from '@/lib/api/http-response'
import {
  createErrorResponse,
  generateRequestId
} from '@/lib/api/error-handler'
import { hasMerchantAccess } from '@/lib/auth/merchant-access'
import { createPromptAssetVersion } from '@/lib/repositories/prompt-asset-repository'
import { PromptAssetType } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { merchantId: string } }
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

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (!type || !['REPORT', 'PROMPT'].includes(type)) {
      return validationError('type 参数必须是 REPORT 或 PROMPT')
    }

    const assets = await prisma.merchantPromptAsset.findMany({
      where: {
        merchantId: params.merchantId,
        type: type as PromptAssetType
      },
      orderBy: [
        { isActive: 'desc' },
        { version: 'desc' }
      ],
      select: {
        id: true,
        type: true,
        title: true,
        version: true,
        isActive: true,
        content: true,
        createdAt: true,
        createdBy: true
      }
    })

    return success({
      assets: assets.map(asset => ({
        id: asset.id,
        type: asset.type,
        title: asset.title,
        version: asset.version,
        isActive: asset.isActive,
        content: asset.content,
        createdAt: asset.createdAt,
        createdBy: asset.createdBy
      }))
    })
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { merchantId: string } }
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

    const payload = await request.json()
    const { type, title, content, isActive } = payload ?? {}

    if (!type || !['REPORT', 'PROMPT'].includes(type)) {
      return validationError('type 必须是 REPORT 或 PROMPT')
    }

    if (!title || !content) {
      return validationError('title 和 content 不能为空')
    }

    // 使用仓储方法，带事务和 P2002 重试
    const asset = await createPromptAssetVersion({
      merchantId: params.merchantId,
      type: type as PromptAssetType,
      title,
      content,
      createdBy: token.sub,
      activate: isActive ?? false
    })

    return NextResponse.json(
      {
        id: asset.id,
        type: asset.type,
        title: asset.title,
        version: asset.version,
        isActive: asset.isActive,
        createdAt: asset.createdAt
      },
      { status: 201 }
    )
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

export const dynamic = 'force-dynamic'
