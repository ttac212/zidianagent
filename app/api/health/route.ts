/**
 * Linus式极简健康检查API
 *
 * 前端只需要知道：服务器能响应 = HTTP 200
 * 其他都是垃圾过度设计
 */

import { NextResponse } from 'next/server'
import { success, serverError } from '@/lib/api/http-response'
import * as dt from '@/lib/utils/date-toolkit'

export async function GET() {
  // 检查是否禁用（唯一需要的配置检查）
  if (process.env.NEXT_PUBLIC_CONNECTION_MONITORING === 'disabled') {
    return serverError('Connection monitoring is disabled', {
      status: 'disabled'
    })
  }

  // 服务器能响应就是健康的
  return success({
    status: 'ok',
    timestamp: dt.toISO()
  }, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    }
  })
}

// HEAD请求支持
export async function HEAD() {
  if (process.env.NEXT_PUBLIC_CONNECTION_MONITORING === 'disabled') {
    return new NextResponse(null, { status: 503 })
  }

  return new NextResponse(null, { status: 200 })
}