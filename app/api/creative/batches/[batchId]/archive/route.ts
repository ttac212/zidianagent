/**
 * 归档批次 API
 * POST /api/creative/batches/:batchId/archive
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

export async function POST(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) {
    return unauthorized('未认证访问')
  }

  try {
    const batch = await prisma.creativeBatch.findUnique({
      where: { id: params.batchId },
      select: { merchantId: true, metadata: true }
    })

    if (!batch) {
      return notFound('批次不存在')
    }

    const accessible = await hasMerchantAccess(
      token.sub,
      batch.merchantId,
      (token as any).role
    )
    if (!accessible) {
      return notFound('批次不存在或无权访问')
    }

    // 更新 metadata 添加 archived 标记
    const currentMetadata = (batch.metadata as any) || {}
    
    await prisma.creativeBatch.update({
      where: { id: params.batchId },
      data: {
        metadata: {
          ...currentMetadata,
          archived: true,
          archivedAt: new Date().toISOString(),
          archivedBy: token.sub
        }
      }
    })

    return NextResponse.json(
      {
        id: params.batchId,
        archived: true
      },
      { status: 200 }
    )
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

export const dynamic = 'force-dynamic'
