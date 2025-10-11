/**
 * 批量文案生成批次 API
 * POST /api/creative/batches - 创建新的生成批次
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import {
  validationError,
  unauthorized,
  notFound,
  paginated
} from '@/lib/api/http-response'
import {
  createErrorResponse,
  generateRequestId
} from '@/lib/api/error-handler'
import {
  CreativeAssetRole,
  CreativeBatchStatus
} from '@prisma/client'
import {
  createBatchWithAssets,
  type BatchAssetInput
} from '@/lib/repositories/creative-batch-repository'
import {
  calculatePaginationMeta,
  extractPaginationParams
} from '@/lib/api/http-response'
import { hasMerchantAccess } from '@/lib/auth/merchant-access'

const assetSchema = z.object({
  role: z.nativeEnum(CreativeAssetRole),
  assetId: z.string().min(1),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional()
})

const requestSchema = z.object({
  merchantId: z.string().min(1),
  parentBatchId: z.string().min(1).optional(),
  assets: z.array(assetSchema).min(2)
})

function parseStatusFilter(searchParams: URLSearchParams) {
  const raw = searchParams.getAll('status')
  if (!raw.length) return []

  const allowed = new Set(Object.values(CreativeBatchStatus))
  return raw
    .flatMap(part => part.split(','))
    .map(item => item.trim().toUpperCase())
    .filter(item => allowed.has(item as CreativeBatchStatus)) as CreativeBatchStatus[]
}



export async function POST(request: NextRequest) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) {
    return unauthorized('未认证访问')
  }

  try {
    const payload = await request.json()
    const parsed = requestSchema.safeParse(payload)
    if (!parsed.success) {
      return validationError('请求参数无效', parsed.error.flatten().fieldErrors)
    }

    const { merchantId, parentBatchId } = parsed.data
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true }
    })
    if (!merchant) {
      return notFound('商家不存在')
    }

    const accessible = await hasMerchantAccess(
      token.sub,
      merchantId,
      (token as any).role
    )
    if (!accessible) {
      return notFound('商家不存在或无权访问')
    }

    if (parentBatchId) {
      const parentBatch = await prisma.creativeBatch.findFirst({
        where: { id: parentBatchId, merchantId },
        select: { id: true }
      })
      if (!parentBatch) {
        return notFound('父批次不存在或无权访问')
      }
    }
    const assetsInput = parsed.data.assets.map(
      (asset, index): BatchAssetInput => ({
        role: asset.role,
        assetId: asset.assetId,
        enabled: asset.enabled ?? true,
        sortOrder: asset.sortOrder ?? index
      })
    )

    // 仓库层会校验资产归属和类型匹配
    const { batch } = await createBatchWithAssets({
      merchantId,
      triggeredBy: token.sub,
      assets: assetsInput,
      parentBatchId: parentBatchId ?? null
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

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) {
    return unauthorized('未认证访问')
  }

  try {
    const searchParams = new URL(request.url).searchParams
    const merchantId = searchParams.get('merchantId')
    if (!merchantId) {
      return validationError('缺少必填参数 merchantId')
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true }
    })
    if (!merchant) {
      return notFound('商家不存在')
    }

    const accessible = await hasMerchantAccess(
      token.sub,
      merchantId,
      (token as any).role
    )
    if (!accessible) {
      return notFound('商家不存在或无权访问')
    }

    const { page, pageSize } = extractPaginationParams(searchParams, {
      page: 1,
      pageSize: 20
    })
    const statusFilters = parseStatusFilter(searchParams)

    const where: any = {
      merchantId
    }
    if (statusFilters.length) {
      where.status = { in: statusFilters }
    }

    const skip = (page - 1) * pageSize
    const [batches, total] = await Promise.all([
      prisma.creativeBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          parent: { select: { id: true, status: true } },
          _count: {
            select: {
              copies: true,
              exceptions: true
            }
          }
        }
      }),
      prisma.creativeBatch.count({ where })
    ])

    const items = batches.map(batch => ({
      id: batch.id,
      merchantId: batch.merchantId,
      parentBatchId: batch.parentBatchId,
      parentStatus: batch.parent?.status ?? null,
      status: batch.status,
      statusVersion: batch.statusVersion,
      modelId: batch.modelId,
      triggeredBy: batch.triggeredBy,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
      createdAt: batch.createdAt,
      copyCount: batch._count.copies,
      exceptionCount: batch._count.exceptions,
      metadata: batch.metadata as unknown
    }))

    return paginated(
      items,
      calculatePaginationMeta(page, pageSize, total)
    )
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}
