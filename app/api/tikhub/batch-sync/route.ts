/**
 * TikHub批量同步API路由
 * POST /api/tikhub/batch-sync
 *
 * 批量同步多个商家数据
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { batchSyncMerchants } from '@/lib/tikhub'
import * as HttpResponse from '@/lib/api/http-response'
import { z } from 'zod'

// 请求体验证schema
const batchSyncRequestSchema = z.object({
  merchantUids: z.array(z.string()).min(1, '至少需要一个商家UID'),
  maxConcurrent: z.number().min(1).max(20).optional(), // 提高上限以支持10个并发
})

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户权限
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return HttpResponse.unauthorized('请先登录')
    }

    if (session.user.role !== 'ADMIN') {
      return HttpResponse.forbidden('需要管理员权限')
    }

    // 2. 解析并验证请求体
    const body = await request.json()
    const validation = batchSyncRequestSchema.safeParse(body)

    if (!validation.success) {
      return HttpResponse.badRequest(
        '请求参数无效',
        validation.error.errors
      )
    }

    const { merchantUids, maxConcurrent } = validation.data

    // 3. 执行批量同步（使用配置的默认并发数10）
    const tasks = await batchSyncMerchants({
      merchantUids,
      maxConcurrent: maxConcurrent || 10,
    })

    // 4. 统计结果
    const summary = {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      totalVideos: tasks.reduce((sum, t) => sum + t.totalVideos, 0),
      tasks: tasks.map((t) => ({
        merchantUid: t.merchantUid,
        merchantName: t.merchantName,
        status: t.status,
        totalVideos: t.totalVideos,
        result: t.result,
        errors: t.errors.length > 0 ? t.errors : undefined,
      })),
    }

    return HttpResponse.ok('批量同步完成', summary)
  } catch (error: any) {
    console.error('TikHub批量同步错误:', error)
    return HttpResponse.serverError(
      '批量同步过程中发生错误',
      { message: error.message }
    )
  }
}
