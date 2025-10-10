/**
 * TikHub状态检查API路由
 * GET /api/tikhub/status
 *
 * 检查TikHub API连接状态和用户配额
 */

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { getTikHubClient } from '@/lib/tikhub'
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

    // 2. 获取TikHub客户端
    const client = getTikHubClient()

    // 3. 测试连接
    const connected = await client.testConnection()

    if (!connected) {
      return HttpResponse.serverError('TikHub API连接失败')
    }

    // 4. 获取用户信息和使用情况
    const [userInfo, dailyUsage] = await Promise.all([
      client.getUserInfo(),
      client.getDailyUsage(),
    ])

    // 5. 返回状态
    return HttpResponse.ok('TikHub API连接正常', {
      connected: true,
      userInfo: {
        userId: userInfo.user_id,
        username: userInfo.username,
        email: userInfo.email,
        plan: userInfo.plan,
        balance: userInfo.balance,
      },
      dailyUsage: {
        date: dailyUsage.date,
        totalRequests: dailyUsage.total_requests,
        successfulRequests: dailyUsage.successful_requests,
        failedRequests: dailyUsage.failed_requests,
        totalCost: dailyUsage.total_cost,
      },
    })
  } catch (error: any) {
    console.error('TikHub状态检查错误:', error)
    return HttpResponse.serverError(
      'TikHub API连接失败',
      { message: error.message }
    )
  }
}
