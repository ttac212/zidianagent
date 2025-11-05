/**
 * 管理员权限守卫
 * 统一的权限检查逻辑
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { unauthorized, forbidden } from '@/lib/api/http-response'

export interface AdminToken {
  sub: string
  role: string
  [key: string]: any
}

export interface AdminCheckResult {
  error?: NextResponse
  token?: AdminToken
}

/**
 * 要求管理员权限
 * @returns 包含 error 或 token 的结果对象
 */
export async function requireAdmin(request: NextRequest): Promise<AdminCheckResult> {
  const token = await getToken({ req: request as any })

  if (!token?.sub) {
    return { error: unauthorized('未认证') }
  }

  if ((token as any).role !== 'ADMIN') {
    return { error: forbidden('需要管理员权限') }
  }

  return { token: token as AdminToken }
}
