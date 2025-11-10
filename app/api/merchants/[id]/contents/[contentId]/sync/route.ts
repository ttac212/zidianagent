/**
 * 单个视频内容同步 API
 * POST /api/merchants/[id]/contents/[contentId]/sync - 更新单个视频数据
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { updateSingleVideo } from '@/lib/tikhub/sync-service'
import {
  success,
  notFound,
  unauthorized,
  serverError,
} from '@/lib/api/http-response'

export const maxDuration = 60 // 1分钟超时

/**
 * POST /api/merchants/[id]/contents/[contentId]/sync
 * 手动同步单个视频的最新数据
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contentId: string }> }
) {
  try {
    // 1. 验证用户权限（仅管理员可手动同步）
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return unauthorized('仅管理员可执行数据同步')
    }

    const { id: merchantId, contentId } = await params

    // 2. 验证内容是否存在
    const content = await prisma.merchantContent.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        externalId: true,
        merchantId: true,
        title: true,
      },
    })

    if (!content) {
      return notFound('视频内容不存在')
    }

    // 3. 验证内容是否属于该商家
    if (content.merchantId !== merchantId) {
      return unauthorized('该视频不属于此商家')
    }

    // 4. 执行单视频同步
    const result = await updateSingleVideo(merchantId, content.externalId)

    if (!result.success) {
      return serverError('同步失败', {
        errors: result.errors,
      })
    }

    // 5. 获取更新后的数据
    const updatedContent = await prisma.merchantContent.findUnique({
      where: { id: contentId },
    })

    return success({
      updated: result.updated,
      content: updatedContent,
      message: '视频数据已更新',
    })
  } catch (error: any) {
    console.error('同步单个视频失败:', error)
    return serverError('同步失败', {
      message: error.message,
    })
  }
}

export const dynamic = 'force-dynamic'
