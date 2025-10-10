import {
  CreativeAssetRole,
  CreativeBatchStatus,
  CreativeBatch,
  Prisma
} from '@prisma/client'

import { prisma } from '@/lib/prisma'

export interface BatchAssetInput {
  role: CreativeAssetRole
  assetId: string
  enabled?: boolean
  sortOrder?: number
}

export interface CreateBatchInput {
  merchantId: string
  triggeredBy: string
  assets: BatchAssetInput[]
  parentBatchId?: string | null
  modelId?: string
  status?: CreativeBatchStatus
}

export interface CreateBatchResult {
  batch: CreativeBatch
  parentBatch?: Pick<CreativeBatch, 'id' | 'merchantId' | 'parentBatchId' | 'status'>
}

export async function createBatchWithAssets(input: CreateBatchInput): Promise<CreateBatchResult> {
  const { merchantId, triggeredBy, assets, parentBatchId, modelId, status } = input

  if (!assets.length) {
    throw new Error('Batch requires at least one asset')
  }

  validateAssetRoles(assets)

  return prisma.$transaction(async tx => {
    let parentBatch: Pick<CreativeBatch, 'id' | 'merchantId' | 'parentBatchId' | 'status'> | undefined

    if (parentBatchId) {
      parentBatch = await tx.creativeBatch.findUnique({
        where: { id: parentBatchId },
        select: { id: true, merchantId: true, parentBatchId: true, status: true }
      })

      if (!parentBatch) {
        throw new Error(`Parent batch ${parentBatchId} not found`)
      }

      if (parentBatch.merchantId !== merchantId) {
        throw new Error(`Parent batch ${parentBatchId} does not belong to merchant ${merchantId}`)
      }
    }

    const batch = await tx.creativeBatch.create({
      data: {
        merchantId,
        parentBatchId: parentBatchId ?? null,
        triggeredBy,
        modelId: modelId ?? undefined,
        status: status ?? CreativeBatchStatus.QUEUED
      }
    })

    const payload = assets.map((asset, index) => ({
      batchId: batch.id,
      role: asset.role,
      promptAssetId: isPromptRole(asset.role) ? asset.assetId : null,
      referenceAssetId: isPromptRole(asset.role) ? null : asset.assetId,
      isEnabled: asset.enabled ?? true,
      sortOrder: asset.sortOrder ?? index
    }))

    await tx.creativeBatchAsset.createMany({ data: payload })

    return { batch, parentBatch }
  })
}

export interface UpdateBatchStatusInput {
  batchId: string
  status: CreativeBatchStatus
  startedAt?: Date | null
  completedAt?: Date | null
  errorCode?: string | null
  errorMessage?: string | null
  tokenUsage?: Prisma.JsonValue | null
}

export async function updateBatchStatus(input: UpdateBatchStatusInput) {
  const {
    batchId,
    status,
    startedAt,
    completedAt,
    errorCode,
    errorMessage,
    tokenUsage
  } = input

  const data: Prisma.CreativeBatchUpdateInput = {
    status,
    statusVersion: { increment: 1 }
  }

  if (startedAt !== undefined) {
    data.startedAt = startedAt
  }
  if (completedAt !== undefined) {
    data.completedAt = completedAt
  }
  if (errorCode !== undefined) {
    data.errorCode = errorCode
  }
  if (errorMessage !== undefined) {
    data.errorMessage = errorMessage
  }
  if (tokenUsage !== undefined) {
    data.tokenUsage = tokenUsage
  }

  return prisma.creativeBatch.update({
    where: { id: batchId },
    data
  })
}

function isPromptRole(role: CreativeAssetRole) {
  return role === CreativeAssetRole.REPORT || role === CreativeAssetRole.PROMPT
}

function validateAssetRoles(assets: BatchAssetInput[]) {
  const seen = new Map<CreativeAssetRole, number>()

  for (const asset of assets) {
    seen.set(asset.role, (seen.get(asset.role) ?? 0) + 1)
  }

  for (const role of [CreativeAssetRole.REPORT, CreativeAssetRole.PROMPT]) {
    if ((seen.get(role) ?? 0) > 1) {
      throw new Error(`Batch can only include one ${role} asset`)
    }
    if ((seen.get(role) ?? 0) === 0) {
      throw new Error(`Batch requires a ${role} asset`)
    }
  }
}
