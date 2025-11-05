/**
 * 商家API认证中间件
 * 消除所有商家API路由中的重复认证逻辑
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { unauthorized } from '@/lib/api/http-response'

/**
 * 认证后的处理器类型
 */
type AuthenticatedHandler<T = any> = (
  userId: string,
  request: NextRequest,
  params: T
) => Promise<NextResponse>

/**
 * 认证后的ADMIN处理器类型
 */
type AdminHandler<T = any> = AuthenticatedHandler<T>

/**
 * 商家API认证包装器
 *
 * 使用方式：
 * ```typescript
 * export async function GET(request: NextRequest, { params }: RouteParams) {
 *   return withMerchantAuth(request, params, async (userId, req, params) => {
 *     // 你的业务逻辑
 *     const { id } = await params
 *     return success({ merchantId: id })
 *   })
 * }
 * ```
 */
export async function withMerchantAuth<T = any>(
  request: NextRequest,
  params: T,
  handler: AuthenticatedHandler<T>
): Promise<NextResponse> {
  // 认证检查
  const token = await getToken({ req: request as any })
  if (!token?.sub) {
    return unauthorized('未认证')
  }

  // 执行业务逻辑
  return handler(String(token.sub), request, params)
}

/**
 * 商家API管理员认证包装器（需要ADMIN权限）
 *
 * 使用方式：
 * ```typescript
 * export async function PATCH(request: NextRequest, { params }: RouteParams) {
 *   return withMerchantAdminAuth(request, params, async (userId, req, params) => {
 *     // 只有管理员可以访问的逻辑
 *     return success({ updated: true })
 *   })
 * }
 * ```
 */
export async function withMerchantAdminAuth<T = any>(
  request: NextRequest,
  params: T,
  handler: AdminHandler<T>
): Promise<NextResponse> {
  // 认证检查
  const token = await getToken({ req: request as any })
  if (!token?.sub) {
    return unauthorized('未认证')
  }

  // 权限检查
  if (token.role !== 'ADMIN') {
    return unauthorized('只有管理员可以执行此操作')
  }

  // 执行业务逻辑
  return handler(String(token.sub), request, params)
}
