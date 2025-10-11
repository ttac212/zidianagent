import {
  CreativeAssetRole,
  CreativeBatchStatus,
  CreativeBatch,
  Prisma,
  PromptAssetType,
  ReferenceKind
} from '@prisma/client'

import { prisma, toJsonInput } from '@/lib/prisma'

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
  metadata?: unknown
}

export interface CreateBatchResult {
  batch: CreativeBatch
  parentBatch?: Pick<CreativeBatch, 'id' | 'merchantId' | 'parentBatchId' | 'status'>
}

export async function createBatchWithAssets(input: CreateBatchInput): Promise<CreateBatchResult> {
  const { merchantId, triggeredBy, assets, parentBatchId, modelId, status, metadata } = input

  if (!assets.length) {
    throw new Error('Batch requires at least one asset')
  }

  validateAssetRoles(assets)

  return prisma.$transaction(async tx => {
    // 在事务内校验资产归属
    await validateAssetOwnership(tx, merchantId, assets)

    let parentBatch: Pick<CreativeBatch, 'id' | 'merchantId' | 'parentBatchId' | 'status'> | undefined

    if (parentBatchId) {
      const existingParent = await tx.creativeBatch.findUnique({
        where: { id: parentBatchId },
        select: { id: true, merchantId: true, parentBatchId: true, status: true }
      })

      if (!existingParent) {
        throw new Error(`Parent batch ${parentBatchId} not found`)
      }

      if (existingParent.merchantId !== merchantId) {
        throw new Error(`Parent batch ${parentBatchId} does not belong to merchant ${merchantId}`)
      }

      parentBatch = existingParent
    }

    const batch = await tx.creativeBatch.create({
      data: {
        merchantId,
        parentBatchId: parentBatchId ?? null,
        triggeredBy,
        modelId: modelId ?? undefined,
        status: status ?? CreativeBatchStatus.QUEUED,
        metadata: metadata !== undefined ? toJsonInput(metadata) : undefined
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
  tokenUsage?: unknown
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
    data.tokenUsage = tokenUsage === null ? Prisma.JsonNull : toJsonInput(tokenUsage)
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

async function validateAssetOwnership(
  tx: Prisma.TransactionClient,
  merchantId: string,
  assets: BatchAssetInput[]
): Promise<void> {
  const promptAssetIds = assets
    .filter(asset => isPromptRole(asset.role))
    .map(asset => asset.assetId)
    .filter(Boolean)

  const referenceAssetIds = assets
    .filter(asset => !isPromptRole(asset.role))
    .map(asset => asset.assetId)
    .filter(Boolean)

  // 批量查询 prompt 类资产
  if (promptAssetIds.length > 0) {
    const promptAssets = await tx.merchantPromptAsset.findMany({
      where: {
        id: { in: promptAssetIds },
        merchantId
      },
      select: { id: true, type: true }
    })

    const foundIds = new Set(promptAssets.map(a => a.id))
    const missingIds = promptAssetIds.filter(id => !foundIds.has(id))
    
    if (missingIds.length > 0) {
      throw new Error(
        `Prompt assets [${missingIds.join(', ')}] do not belong to merchant ${merchantId}`
      )
    }

    // 校验类型匹配
    const assetTypeMap = new Map(promptAssets.map(a => [a.id, a.type]))
    for (const asset of assets.filter(a => isPromptRole(a.role))) {
      const expectedType = getExpectedPromptType(asset.role)
      const actualType = assetTypeMap.get(asset.assetId)
      
      if (actualType !== expectedType) {
        throw new Error(
          `Asset ${asset.assetId} type mismatch: expected ${expectedType}, got ${actualType}`
        )
      }
    }
  }

  // 批量查询 reference 类资产
  if (referenceAssetIds.length > 0) {
    const referenceAssets = await tx.referenceAsset.findMany({
      where: {
        id: { in: referenceAssetIds },
        merchantId
      },
      select: { id: true, kind: true }
    })

    const foundIds = new Set(referenceAssets.map(a => a.id))
    const missingIds = referenceAssetIds.filter(id => !foundIds.has(id))
    
    if (missingIds.length > 0) {
      throw new Error(
        `Reference assets [${missingIds.join(', ')}] do not belong to merchant ${merchantId}`
      )
    }

    // 校验类型匹配
    const assetKindMap = new Map(referenceAssets.map(a => [a.id, a.kind]))
    for (const asset of assets.filter(a => !isPromptRole(a.role))) {
      const expectedKind = getExpectedReferenceKind(asset.role)
      const actualKind = assetKindMap.get(asset.assetId)
      
      if (actualKind !== expectedKind) {
        throw new Error(
          `Asset ${asset.assetId} kind mismatch: expected ${expectedKind}, got ${actualKind}`
        )
      }
    }
  }
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
