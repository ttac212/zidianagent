import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { createErrorResponse } from '@/lib/api/error-handler'

/**
 * 用户认证状态端点
 * 生产环境仅返回基本认证状态，开发环境可返回详细信息用于调试
 */
export async function GET(request: NextRequest) {
  // 速率限制检查 - 认证API使用严格限制
  const rateLimitCheck = checkRateLimit(request, 'AUTH')
  if (!rateLimitCheck.allowed && rateLimitCheck.error) {
    return createErrorResponse(rateLimitCheck.error)
  }
  try {
    const token = await getToken({ req: request as any })
    
    if (!token) {
      return NextResponse.json({
        authenticated: false,
        message: '未认证或会话已过期'
      }, { status: 401 })
    }

    const isProduction = process.env.NODE_ENV === 'production'

    if (isProduction) {
      // 生产环境：仅返回基本认证状态，不暴露敏感token信息
      return NextResponse.json({
        authenticated: true,
        user: {
          id: (token as any).id,
          email: token.email,
          name: token.name,
          role: (token as any).role,
        },
        message: 'NextAuth 会话有效'
      })
    } else {
      // 开发环境：返回详细token信息用于调试
      return NextResponse.json({
        authenticated: true,
        token: {
          sub: token.sub,
          email: token.email,
          name: token.name,
          // 自定义字段
          id: (token as any).id,
          role: (token as any).role,
          displayName: (token as any).displayName,
          currentMonthUsage: (token as any).currentMonthUsage,
          monthlyTokenLimit: (token as any).monthlyTokenLimit,
          // 标准字段
          iat: token.iat,
          exp: token.exp,
          jti: token.jti,
        },
        message: 'NextAuth 会话有效 (开发环境调试信息)'
      })
    }
  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      error: '获取会话信息失败'
    }, { status: 500 })
  }
}
