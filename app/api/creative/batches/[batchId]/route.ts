/**
 * 批次详情 API
 * GET /api/creative/batches/:batchId
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { prisma } from '@/lib/prisma'
import {
  unauthorized,
  notFound,
  success
} from '@/lib/api/http-response'
import {
  createErrorResponse,
  generateRequestId
} from '@/lib/api/error-handler'
import { hasMerchantAccess } from '@/lib/auth/merchant-access'

export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) {
    return unauthorized('未认证访问')
  }

  try {
    const batchMeta = await prisma.creativeBatch.findUnique({
      where: { id: params.batchId },
      select: { merchantId: true }
    })

    if (!batchMeta) {
      return notFound('批次不存在')
    }

    const accessible = await hasMerchantAccess(
      token.sub,
      batchMeta.merchantId,
      (token as any).role
    )
    if (!accessible) {
      return notFound('批次不存在')
    }

    const batch = await prisma.creativeBatch.findUnique({
      where: { id: params.batchId },
      include: {
        parent: {
          select: { id: true, status: true, createdAt: true }
        },
        assets: {
          orderBy: { sortOrder: 'asc' },
          include: {
            promptAsset: {
              select: {
                id: true,
                type: true,
                title: true,
                version: true,
                isActive: true
              }
            },
            referenceAsset: {
              select: {
                id: true,
                kind: true,
                summary: true,
                isDefaultEnabled: true
              }
            }
          }
        },
        copies: {
          orderBy: { sequence: 'asc' },
          include: {
            regenerations: {
              select: { id: true }
            }
          }
        },
        exceptions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    })

    if (!batch) {
      return notFound('批次不存在')
    }

    const assets = batch.assets.map(asset => ({
      id: asset.id,
      role: asset.role,
      isEnabled: asset.isEnabled,
      sortOrder: asset.sortOrder,
      promptAsset: asset.promptAsset
        ? {
            id: asset.promptAsset.id,
            type: asset.promptAsset.type,
            title: asset.promptAsset.title,
            version: asset.promptAsset.version,
            isActive: asset.promptAsset.isActive
          }
        : undefined,
      referenceAsset: asset.referenceAsset
        ? {
            id: asset.referenceAsset.id,
            kind: asset.referenceAsset.kind,
            summary: asset.referenceAsset.summary,
            isDefaultEnabled: asset.referenceAsset.isDefaultEnabled
          }
        : undefined
    }))

    const copies = batch.copies.map(copy => ({
      id: copy.id,
      batchId: copy.batchId,
      sequence: copy.sequence,
      state: copy.state,
      markdownContent: copy.markdownContent,
      userOverride: copy.userOverride,
      contentVersion: copy.contentVersion,
      regeneratedFromId: copy.regeneratedFromId,
      editedBy: copy.editedBy,
      editedAt: copy.editedAt,
      createdAt: copy.createdAt,
      updatedAt: copy.updatedAt,
      regenerationIds: copy.regenerations.map(item => item.id)
    }))

    const exceptions = batch.exceptions.map(exception => ({
      id: exception.id,
      errorCode: exception.errorCode,
      status: exception.status,
      createdAt: exception.createdAt
    }))

    return success({
      id: batch.id,
      merchantId: batch.merchantId,
      parentBatch: batch.parent
        ? {
            id: batch.parent.id,
            status: batch.parent.status,
            createdAt: batch.parent.createdAt
          }
        : null,
      status: batch.status,
      statusVersion: batch.statusVersion,
      modelId: batch.modelId,
      triggeredBy: batch.triggeredBy,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt,
      errorCode: batch.errorCode,
      errorMessage: batch.errorMessage,
      tokenUsage: batch.tokenUsage,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      metadata: batch.metadata,
      copyCount: copies.length,
      assets,
      copies,
      exceptionCount: batch.exceptions.length,
      exceptions
    })
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

export async function DELETE(
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
      select: { merchantId: true }
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

    // 软删除：只删除批次和文案记录，不删除资产
    await prisma.$transaction([
      // 删除文案修订记录
      prisma.creativeCopyRevision.deleteMany({
        where: {
          copy: {
            batchId: params.batchId
          }
        }
      }),
      // 删除文案
      prisma.creativeCopy.deleteMany({
        where: { batchId: params.batchId }
      }),
      // 删除批次资产关联
      prisma.creativeBatchAsset.deleteMany({
        where: { batchId: params.batchId }
      }),
      // 删除批次
      prisma.creativeBatch.delete({
        where: { id: params.batchId }
      })
    ])

    return NextResponse.json(
      { success: true },
      { status: 200 }
    )
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

export const dynamic = 'force-dynamic'
