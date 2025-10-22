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
  unauthorized
} from '@/lib/api/http-response'
import {
  createErrorResponse,
  generateRequestId
} from '@/lib/api/error-handler'
import {
  CreativeAssetRole,
  PromptAssetType,
  ReferenceKind
} from '@prisma/client'
import {
  createBatchWithAssets,
  type BatchAssetInput
} from '@/lib/repositories/creative-batch-repository'

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

function isPromptRole(role: CreativeAssetRole) {
  return (
    role === CreativeAssetRole.REPORT || role === CreativeAssetRole.PROMPT
  )
}

function getExpectedPromptType(role: CreativeAssetRole): PromptAssetType {
  return role === CreativeAssetRole.REPORT
    ? PromptAssetType.REPORT
    : PromptAssetType.PROMPT
}

function getExpectedReferenceKind(role: CreativeAssetRole): ReferenceKind {
  switch (role) {
    case CreativeAssetRole.ATTACHMENT:
      return ReferenceKind.RAW_ATTACHMENT
    case CreativeAssetRole.TOPIC:
      return ReferenceKind.TOPIC
    case CreativeAssetRole.BENCHMARK:
      return ReferenceKind.BENCHMARK
    default:
      throw new Error(`Unsupported reference role: ${role}`)
  }
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
      return validationError(
        '请求参数不合法',
        parsed.error.flatten().fieldErrors
      )
    }

    const { merchantId, parentBatchId } = parsed.data
    const assetsInput = parsed.data.assets.map(
      (asset, index): BatchAssetInput => ({
        role: asset.role,
        assetId: asset.assetId,
        enabled: asset.enabled ?? true,
        sortOrder: asset.sortOrder ?? index
      })
    )

    const reportAsset = assetsInput.find(
      asset => asset.role === CreativeAssetRole.REPORT
    )
    const promptAsset = assetsInput.find(
      asset => asset.role === CreativeAssetRole.PROMPT
    )

    if (!reportAsset || !promptAsset) {
      return validationError('必须同时提供报告和提示资产')
    }

    // 校验提示/报告资产归属和类型
    const promptAssetIds = assetsInput
      .filter(asset => isPromptRole(asset.role))
      .map(asset => asset.assetId)

    if (promptAssetIds.length) {
      const promptAssets = await prisma.merchantPromptAsset.findMany({
        where: {
          id: { in: promptAssetIds },
          merchantId
        },
        select: { id: true, type: true }
      })

      const promptAssetMap = new Map(
        promptAssets.map(asset => [asset.id, asset.type])
      )

      for (const asset of assetsInput.filter(asset => isPromptRole(asset.role))) {
        const recordType = promptAssetMap.get(asset.assetId)
        if (!recordType) {
          return validationError(`资产 ${asset.assetId} 不属于该商家`)
        }
        if (recordType !== getExpectedPromptType(asset.role)) {
          return validationError(`资产 ${asset.assetId} 类型与角色不匹配`)
        }
      }
    }

    // 校验引用类资产归属和类型
    const referenceAssetIds = assetsInput
      .filter(asset => !isPromptRole(asset.role))
      .map(asset => asset.assetId)

    if (referenceAssetIds.length) {
      const referenceAssets = await prisma.referenceAsset.findMany({
        where: {
          id: { in: referenceAssetIds },
          merchantId
        },
        select: { id: true, kind: true }
      })

      const referenceMap = new Map(
        referenceAssets.map(asset => [asset.id, asset.kind])
      )

      for (const asset of assetsInput.filter(
        asset => !isPromptRole(asset.role)
      )) {
        const recordKind = referenceMap.get(asset.assetId)
        if (!recordKind) {
          return validationError(`引用资产 ${asset.assetId} 不属于该商家`)
        }
        if (recordKind !== getExpectedReferenceKind(asset.role)) {
          return validationError(`引用资产 ${asset.assetId} 类型与角色不匹配`)
        }
      }
    }

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
