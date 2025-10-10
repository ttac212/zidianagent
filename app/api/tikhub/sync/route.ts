/**
 * TikHub同步API路由
 * POST /api/tikhub/sync
 *
 * 同步商家数据从TikHub API
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { syncMerchantData } from '@/lib/tikhub'
import * as HttpResponse from '@/lib/api/http-response'
import { z } from 'zod'

// 请求体验证schema
const syncRequestSchema = z.object({
  sec_uid: z.string().min(1, 'sec_uid是必需的'),
  categoryId: z.string().optional(),
  businessType: z.enum(['B2B', 'B2C', 'B2B2C']).optional(),
  maxVideos: z.number().min(1).max(500).optional(),
})

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户权限
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return HttpResponse.unauthorized('请先登录')
    }

    // 仅允许管理员访问
    if (session.user.role !== 'ADMIN') {
      return HttpResponse.forbidden('需要管理员权限')
    }

    // 2. 解析并验证请求体
    const body = await request.json()
    const validation = syncRequestSchema.safeParse(body)

    if (!validation.success) {
      return HttpResponse.badRequest(
        '请求参数无效',
        validation.error.errors
      )
    }

    const { sec_uid, categoryId, businessType, maxVideos } = validation.data

    // 3. 执行同步
    const result = await syncMerchantData(sec_uid, {
      categoryId,
      businessType,
      maxVideos: maxVideos || 100,
    })

    // 4. 返回结果
    if (result.success) {
      return HttpResponse.ok(
        '商家数据同步成功',
        {
          merchantId: result.merchantId,
          totalVideos: result.totalVideos,
          newVideos: result.newVideos,
          updatedVideos: result.updatedVideos,
          warnings: result.errors.length > 0 ? result.errors : undefined,
        }
      )
    } else {
      return HttpResponse.serverError(
        '商家数据同步失败',
        { errors: result.errors }
      )
    }
  } catch (error: any) {
    console.error('TikHub同步错误:', error)
    return HttpResponse.serverError(
      '同步过程中发生错误',
      { message: error.message }
    )
  }
}
