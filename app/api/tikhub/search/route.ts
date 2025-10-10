/**
 * TikHub搜索API路由
 * GET /api/tikhub/search
 *
 * 搜索抖音用户
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { searchAndImportMerchant } from '@/lib/tikhub'
import * as HttpResponse from '@/lib/api/http-response'

export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户权限
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return HttpResponse.unauthorized('请先登录')
    }

    if (session.user.role !== 'ADMIN') {
      return HttpResponse.forbidden('需要管理员权限')
    }

    // 2. 获取查询参数
    const searchParams = request.nextUrl.searchParams
    const keyword = searchParams.get('keyword')
    const autoSync = searchParams.get('autoSync') === 'true'
    const categoryId = searchParams.get('categoryId') || undefined
    const businessType = (searchParams.get('businessType') as 'B2B' | 'B2C' | 'B2B2C') || undefined

    if (!keyword) {
      return HttpResponse.badRequest('缺少搜索关键词')
    }

    // 3. 执行搜索
    const result = await searchAndImportMerchant(keyword, {
      categoryId,
      businessType,
      autoSync,
    })

    // 4. 返回结果
    if (result.success) {
      return HttpResponse.ok(
        '搜索完成',
        {
          merchants: result.merchants,
          total: result.merchants.length,
          synced: result.merchants.filter((m) => m.synced).length,
          warnings: result.errors.length > 0 ? result.errors : undefined,
        }
      )
    } else {
      return HttpResponse.serverError(
        '搜索失败',
        { errors: result.errors }
      )
    }
  } catch (error: any) {
    console.error('TikHub搜索错误:', error)
    return HttpResponse.serverError(
      '搜索过程中发生错误',
      { message: error.message }
    )
  }
}
