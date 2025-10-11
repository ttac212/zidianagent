/**
 * 批次再生成 API
 * POST /api/creative/batches/:batchId/regenerate
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
import { createBatchWithAssets } from '@/lib/repositories/creative-batch-repository'
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
    const payload = await request.json().catch(() => ({}))
    const { appendPrompt } = payload ?? {}

    const sourceBatchMeta = await prisma.creativeBatch.findUnique({
      where: { id: params.batchId },
      select: { merchantId: true }
    })

    if (!sourceBatchMeta) {
      return notFound('原始批次不存在')
    }

    const accessible = await hasMerchantAccess(
      token.sub,
      sourceBatchMeta.merchantId,
      (token as any).role
    )
    if (!accessible) {
      return notFound('原始批次不存在或无权访问')
    }

    const sourceBatch = await prisma.creativeBatch.findUnique({
      where: { id: params.batchId },
      include: {
        assets: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    })

    if (!sourceBatch) {
      return notFound('原始批次不存在')
    }

    const assetInputs = sourceBatch.assets.map(asset => ({
      role: asset.role,
      assetId: asset.promptAssetId ?? asset.referenceAssetId ?? '',
      enabled: asset.isEnabled,
      sortOrder: asset.sortOrder
    }))

    if (assetInputs.some(asset => !asset.assetId)) {
      throw new Error('批次资产存在异常，无法再生成')
    }

    const { batch } = await createBatchWithAssets({
      merchantId: sourceBatch.merchantId,
      triggeredBy: token.sub,
      assets: assetInputs,
      parentBatchId: sourceBatch.id,
      metadata: appendPrompt ? {
        source: 'batch-regenerate',
        appendPrompt
      } : undefined
    })

    return NextResponse.json(
      {
        batchId: batch.id,
        parentBatchId: batch.parentBatchId,
        status: batch.status,
        statusVersion: batch.statusVersion,
        createdAt: batch.createdAt
      },
      { status: 201 }
    )
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

export const dynamic = 'force-dynamic'
