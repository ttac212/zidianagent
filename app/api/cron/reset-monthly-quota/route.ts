/**
 * Cron Job: 月度配额重置
 * 每月1号00:00自动执行，重置所有用户的月度token配额
 *
 * Vercel Cron配置（vercel.json）：
 * {
 *   "crons": [{
 *     "path": "/api/cron/reset-monthly-quota",
 *     "schedule": "0 0 1 * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { QuotaManager } from '@/lib/security/quota-manager'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 验证Cron Secret（防止未授权调用）
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // 生产环境必须设置CRON_SECRET
    const isProduction = process.env.NODE_ENV === 'production'

    if (isProduction && !cronSecret) {
      console.error('[Cron] CRON_SECRET must be set in production environment')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.error('[Cron] Unauthorized access attempt to reset-monthly-quota')
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }

    console.info('[Cron] Starting monthly quota reset...')
    const startTime = Date.now()

    // 执行批量重置
    const resetCount = await QuotaManager.resetAllUsersMonthlyUsage()

    const duration = Date.now() - startTime
    console.info(`[Cron] Monthly quota reset completed: ${resetCount} users, ${duration}ms`)

    return NextResponse.json({
      success: true,
      message: 'Monthly quota reset completed',
      data: {
        resetCount,
        duration,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('[Cron] Monthly quota reset failed:', error)

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// 支持POST方法（某些cron服务使用POST）
export async function POST(request: NextRequest) {
  return GET(request)
}
