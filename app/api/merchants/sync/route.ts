/**
 * 商家数据同步 API
 * POST /api/merchants/sync - 批量同步商家数据
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { updateMerchantVideos } from '@/lib/tikhub/sync-service'
import {
  success,
  validationError,
  unauthorized,
  serverError,
} from '@/lib/api/http-response'

export const maxDuration = 300 // 5分钟超时

/**
 * POST /api/merchants/sync
 * 批量手动同步商家数据
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户权限（仅管理员可手动同步）
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return unauthorized('仅管理员可执行数据同步')
    }

    // 2. 解析请求体
    const body = await request.json()
    const { merchantIds, limit = 50 } = body

    // 3. 验证参数
    if (!Array.isArray(merchantIds) || merchantIds.length === 0) {
      return validationError('请至少选择一个商家进行同步')
    }

    if (merchantIds.length > 20) {
      return validationError('单次最多同步20个商家')
    }

    // 4. 验证商家是否存在
    const merchants = await prisma.merchant.findMany({
      where: {
        id: { in: merchantIds },
      },
      select: {
        id: true,
        name: true,
        uid: true,
      },
    })

    if (merchants.length !== merchantIds.length) {
      return validationError('部分商家不存在')
    }

    // 5. 执行同步（串行处理，避免API限流）
    const results = []
    for (const merchant of merchants) {
      try {
        const result = await updateMerchantVideos(merchant.id, {
          limit,
        })

        results.push({
          merchantId: merchant.id,
          merchantName: merchant.name,
          success: result.success,
          newVideos: result.newVideos,
          updatedVideos: result.updatedVideos,
          errors: result.errors,
        })

        // 添加延迟，避免API限流
        if (merchants.indexOf(merchant) < merchants.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      } catch (error: any) {
        results.push({
          merchantId: merchant.id,
          merchantName: merchant.name,
          success: false,
          newVideos: 0,
          updatedVideos: 0,
          errors: [error.message || '同步失败'],
        })
      }
    }

    // 6. 统计结果
    const successCount = results.filter((r) => r.success).length
    const failedCount = results.filter((r) => !r.success).length
    const totalNewVideos = results.reduce((sum, r) => sum + r.newVideos, 0)
    const totalUpdatedVideos = results.reduce((sum, r) => sum + r.updatedVideos, 0)

    return success({
      summary: {
        total: results.length,
        success: successCount,
        failed: failedCount,
        newVideos: totalNewVideos,
        updatedVideos: totalUpdatedVideos,
      },
      results,
    })
  } catch (error: any) {
    console.error('批量同步商家数据失败:', error)
    return serverError('批量同步失败', {
      message: error.message,
    })
  }
}

export const dynamic = 'force-dynamic'
