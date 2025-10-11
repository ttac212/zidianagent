/**
 * 文案详情 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { prisma } from '@/lib/prisma'
import type { BatchAssetInput } from '@/lib/repositories/creative-batch-repository'
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
import { createBatchWithAssets } from '@/lib/repositories/creative-batch-repository'
import { CreativeCopyState } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { copyId: string } }
) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) {
    return unauthorized('未认证访问')
  }

  try {
    const copyMeta = await prisma.creativeCopy.findUnique({
      where: { id: params.copyId },
      select: {
        batch: {
          select: {
            merchantId: true
          }
        }
      }
    })

    if (!copyMeta?.batch) {
      return notFound('文案不存在')
    }

    const accessible = await hasMerchantAccess(
      token.sub,
      copyMeta.batch.merchantId,
      (token as any).role
    )
    if (!accessible) {
      return notFound('文案不存在')
    }

    const copy = await prisma.creativeCopy.findUnique({
      where: { id: params.copyId },
      include: {
        batch: {
          select: {
            id: true,
            merchantId: true,
            status: true
          }
        },
        revisions: {
          orderBy: { version: 'asc' }
        }
      }
    })

    if (!copy) {
      return notFound('文案不存在')
    }

    return success({
      id: copy.id,
      batchId: copy.batchId,
      sequence: copy.sequence,
      state: copy.state,
      markdownContent: copy.markdownContent,
      userOverride: copy.userOverride,
      rawModelOutput: copy.rawModelOutput,
      contentVersion: copy.contentVersion,
      regeneratedFromId: copy.regeneratedFromId,
      editedBy: copy.editedBy,
      editedAt: copy.editedAt,
      createdAt: copy.createdAt,
      updatedAt: copy.updatedAt,
      batch: copy.batch,
      revisions: copy.revisions.map(revision => ({
        id: revision.id,
        version: revision.version,
        content: revision.content,
        source: revision.source,
        note: revision.note,
        createdBy: revision.createdBy,
        createdAt: revision.createdAt
      }))
    })
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { copyId: string } }
) {
  const token = await getToken({ req: request as any })
  if (!token?.sub) {
    return unauthorized('未认证访问')
  }

  try {
    const payload = await request.json()
    const { content, state, note } = payload ?? {}

    if (!content && !state) {
      return validationError('必须提供 content 或 state 其中之一')
    }

    const copy = await prisma.creativeCopy.findUnique({
      where: { id: params.copyId },
      include: {
        batch: {
          select: { merchantId: true }
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

    const updates: any = {
      updatedAt: new Date()
    }

    if (typeof content === 'string') {
      updates.userOverride = content
      updates.contentVersion = copy.contentVersion + 1
      updates.editedBy = token.sub
      updates.editedAt = new Date()
    }

    if (state) {
      if (!Object.values(CreativeCopyState).includes(state)) {
        return validationError('状态取值无效')
      }
      updates.state = state
    }

    const updated = await prisma.$transaction(async tx => {
      const result = await tx.creativeCopy.update({
        where: { id: copy.id },
        data: updates
      })

      if (typeof content === 'string') {
        await tx.creativeCopyRevision.create({
          data: {
            copyId: copy.id,
            version: result.contentVersion,
            content,
            source: 'USER',
            note: note ?? null,
            createdBy: String(token.sub)
          }
        })
      }

      return result
    })

    return success({
      id: updated.id,
      batchId: updated.batchId,
      sequence: updated.sequence,
      state: updated.state,
      markdownContent: updated.markdownContent,
      userOverride: updated.userOverride,
      contentVersion: updated.contentVersion,
      editedBy: updated.editedBy,
      editedAt: updated.editedAt,
      updatedAt: updated.updatedAt
    })
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

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
    const { appendPrompt, editedContent, note } = payload ?? {}

    const copy = await prisma.creativeCopy.findUnique({
      where: { id: params.copyId },
      include: {
        batch: {
          include: {
            assets: true
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

    const assets: BatchAssetInput[] = []
    copy.batch.assets.forEach((asset, index) => {
      const assetId = asset.promptAssetId ?? asset.referenceAssetId
      if (assetId === null || assetId === undefined) {
        throw new Error('批次资产存在异常，缺少关联资产ID')
      }

      const ensuredAssetId = String(assetId)

      assets.push({
        role: asset.role,
        assetId: ensuredAssetId,
        enabled: asset.isEnabled,
        sortOrder: asset.sortOrder ?? index
      })
    })

    // 创建新批次，等待 Worker 生成文案（不预先插入）
    const { batch } = await createBatchWithAssets({
      merchantId: copy.batch.merchantId,
      triggeredBy: token.sub,
      assets,
      parentBatchId: copy.batchId,
      metadata: {
        source: 'copy-regenerate',
        parentCopyId: copy.id,
        targetSequence: copy.sequence, // Worker 只生成此序号的文案
        appendPrompt: appendPrompt ?? null,
        editedContentProvided: !!editedContent,
        editedContent: editedContent ?? null,
        note: note ?? null
      } as unknown
    })

    // Linus: "不要预先插入，让 Worker 统一写入，保证批次恒定 5 条"
    // Worker 会检查 metadata.targetSequence，只生成对应序号的文案

    return NextResponse.json(
      {
        batchId: batch.id,
        parentCopyId: copy.id,
        targetSequence: copy.sequence,
        status: 'QUEUED',
        createdAt: batch.createdAt,
        appendPrompt: appendPrompt ?? null
      },
      { status: 201 }
    )
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

export const dynamic = 'force-dynamic'
