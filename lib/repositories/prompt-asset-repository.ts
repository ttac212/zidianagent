import { Prisma, PromptAssetType } from '@prisma/client'

import { prisma } from '@/lib/prisma'

const MAX_VERSION_RETRIES = 5

export interface CreatePromptAssetInput {
  merchantId: string
  type: PromptAssetType
  title: string
  createdBy: string
  content?: string
  referenceAssetId?: string
  metadata?: Prisma.JsonValue
  parentId?: string | null
  activate?: boolean
  maxRetries?: number
}

/**
 * 创建新的商家提示/报告资产版本，采用乐观重试处理唯一约束冲突。
 */
export async function createPromptAssetVersion(
  input: CreatePromptAssetInput
) {
  const { merchantId, type, title, createdBy, content, referenceAssetId, metadata, parentId, activate } = input

  if (type === PromptAssetType.ATTACHMENT && !referenceAssetId) {
    throw new Error('Attachment asset requires referenceAssetId')
  }

  if (type !== PromptAssetType.ATTACHMENT && !content) {
    throw new Error('Report/Prompt asset requires content')
  }

  const maxRetries = input.maxRetries ?? MAX_VERSION_RETRIES

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const latest = await tx.merchantPromptAsset.findFirst({
          where: { merchantId, type },
          select: { version: true },
          orderBy: { version: 'desc' }
        })

        const nextVersion = (latest?.version ?? 0) + 1

        const asset = await tx.merchantPromptAsset.create({
          data: {
            merchantId,
            type,
            title,
            version: nextVersion,
            content: content ?? null,
            referenceAssetId: referenceAssetId ?? null,
            metadata: metadata ?? undefined,
            parentId: parentId ?? undefined,
            createdBy,
            isActive: false
          }
        })

        if (activate) {
          await tx.merchantPromptAsset.updateMany({
            where: {
              merchantId,
              type,
              isActive: true,
              id: { not: asset.id }
            },
            data: { isActive: false }
          })

          await tx.merchantPromptAsset.update({
            where: { id: asset.id },
            data: { isActive: true }
          })
        }

        return asset
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // 重试获取新版本号
        continue
      }
      throw error
    }
  }

  throw new Error(
    `Failed to create prompt asset version after ${maxRetries} attempts for merchant=${merchantId} type=${type}`
  )
}

/**
 * 设置指定资产为活动版本（在同一事务中调用时，可保证唯一性）。
 */
export async function activatePromptAsset(
  id: string
) {
  const asset = await prisma.merchantPromptAsset.findUnique({
    where: { id },
    select: { merchantId: true, type: true }
  })

  if (!asset) {
    throw new Error(`Prompt asset ${id} not found`)
  }

  await prisma.$transaction(async tx => {
    await tx.merchantPromptAsset.updateMany({
      where: {
        merchantId: asset.merchantId,
        type: asset.type,
        isActive: true,
        id: { not: id }
      },
      data: { isActive: false }
    })

    await tx.merchantPromptAsset.update({
      where: { id },
      data: { isActive: true }
    })
  })
}
