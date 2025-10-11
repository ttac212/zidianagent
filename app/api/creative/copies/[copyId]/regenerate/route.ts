/**
 * 单条文案重新生成 API
 * POST /api/creative/copies/:copyId/regenerate
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { prisma } from '@/lib/prisma'
import type { BatchAssetInput } from '@/lib/repositories/creative-batch-repository'
import {
  unauthorized,
  notFound
} from '@/lib/api/http-response'
import {
  createErrorResponse,
  generateRequestId
} from '@/lib/api/error-handler'
import { hasMerchantAccess } from '@/lib/auth/merchant-access'
import { createBatchWithAssets } from '@/lib/repositories/creative-batch-repository'

export async function POST(
  request: NextRequest,
  { params }: { params: { copyId: string } }
) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) {
    return unauthorized('未认证访问')
  }

  try {
    const payload = await request.json()
    const { mode, appendPrompt, note } = payload ?? {}

    const copy = await prisma.creativeCopy.findUnique({
      where: { id: params.copyId },
      include: {
        batch: {
          include: {
            assets: {
              orderBy: { sortOrder: 'asc' }
            }
          }
        }
      }
    })

    if (!copy) {
      return notFound('文案不存在')
    }

    const accessible = await hasMerchantAccess(
      token.sub,
      copy.batch.merchantId,
      (token as any).role
    )
    if (!accessible) {
      return notFound('文案不存在')
    }

    // 复制原批次的资产配置
    const assets: BatchAssetInput[] = copy.batch.assets.map((asset, index) => {
      const assetId = asset.promptAssetId ?? asset.referenceAssetId
      if (!assetId) {
        throw new Error('批次资产异常，缺少关联资产ID')
      }

      return {
        role: asset.role,
        assetId: String(assetId),
        enabled: asset.isEnabled,
        sortOrder: asset.sortOrder ?? index
      }
    })

    // 创建新批次
    const { batch } = await createBatchWithAssets({
      merchantId: copy.batch.merchantId,
      triggeredBy: token.sub,
      assets,
      parentBatchId: copy.batchId,
      metadata: {
        source: 'copy-regenerate',
        parentCopyId: copy.id,
        mode: mode || 'fresh',
        appendPrompt: appendPrompt ?? null,
        basedOnContent: mode === 'based-on-current' ? copy.markdownContent : null,
        note: note ?? null
      }
    })

    return NextResponse.json(
      {
        batchId: batch.id,
        parentCopyId: copy.id,
        mode: mode || 'fresh',
        status: 'QUEUED',
        createdAt: batch.createdAt
      },
      { status: 201 }
    )
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

export const dynamic = 'force-dynamic'
