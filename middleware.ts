import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import '@/lib/config/env-init'

// 公开路径 - 无需认证
const PUBLIC_PATHS = new Set([
  '/', '/login', '/api/auth'
])

const PUBLIC_PREFIXES = [
  '/_next/', '/favicon', '/icons/', '/images/', '/assets/', '/api/auth/'
]

// 需要保护的路径
const PROTECTED_PATHS = new Set([
  '/workspace', '/settings', '/admin', '/merchants'
])

const PROTECTED_API_PREFIXES = [
  '/api/chat', '/api/conversations', '/api/users', '/api/admin',
  '/api/merchants', '/api/workspace', '/api/keyword-data'
]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  return PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

function needsAuth(pathname: string): boolean {
  // 检查受保护页面
  for (const path of PROTECTED_PATHS) {
    if (pathname === path || pathname.startsWith(path + '/')) {
      return true
    }
  }

  // 检查受保护API
  return PROTECTED_API_PREFIXES.some(prefix =>
    pathname === prefix || pathname.startsWith(prefix + '/')
  )
}

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/') ||
         pathname === '/api/admin' || pathname.startsWith('/api/admin/')
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // E2E测试模式 - 仅在测试环境启用，需要secret
  const isE2ETest = process.env.NODE_ENV === 'test' &&
                    process.env.E2E_BYPASS_AUTH === 'true' &&
                    req.headers.get('x-e2e-test-secret') === process.env.E2E_SECRET

  if (isE2ETest) {
    const response = NextResponse.next()
    response.headers.set('X-E2E-Test-Mode', 'true')
    return response
  }

  // 公开路径直接放行
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // 需要认证的路径
  if (needsAuth(pathname)) {
    try {
      // 直接验证token，不缓存
      const token = await getToken({ req })

      if (!token?.sub) {
        // 未登录，重定向到登录页
        if (pathname.startsWith('/api/')) {
          return new NextResponse('Unauthorized', { status: 401 })
        }

        const url = req.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('callbackUrl', req.url)
        return NextResponse.redirect(url)
      }

      const userId = token.sub as string
      const role = (token as any)?.role as string

      // 管理员权限检查
      if (isAdminPath(pathname) && role !== 'ADMIN') {
        return new NextResponse('Forbidden', { status: 403 })
      }

      // API请求添加用户ID到header
      if (pathname.startsWith('/api/')) {
        const response = NextResponse.next()
        response.headers.set('x-user-id', userId)
        if (role) {
          response.headers.set('x-user-role', role)
        }
        return response
      }

      return NextResponse.next()
    } catch (error) {
      // token验证失败
      console.error('Auth error:', error)

      if (pathname.startsWith('/api/')) {
        return new NextResponse('Internal Server Error', { status: 500 })
      }

      const url = req.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}