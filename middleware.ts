import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// ============================================
// 安全防护：阻止敏感路径和恶意扫描
// ============================================

// 敏感文件和路径 - 直接返回404
const BLOCKED_PATHS = [
  // 环境和配置文件
  '/.env',
  '/.env.local',
  '/.env.production',
  '/config.json',
  '/config.yaml',
  '/config.yml',

  // 版本控制
  '/.git',
  '/.svn',
  '/.hg',

  // IDE和编辑器配置
  '/.vscode',
  '/.idea',
  '/.DS_Store',

  // 服务器状态和调试
  '/server-status',
  '/server-info',
  '/telescope',
  '/actuator',
  '/debug',
  '/_profiler',

  // API文档（防止泄露）
  '/swagger',
  '/swagger-ui',
  '/swagger.json',
  '/swagger.yaml',
  '/api-docs',
  '/v2/api-docs',
  '/v3/api-docs',
  '/webjars/swagger-ui',

  // WordPress探测
  '/wp-admin',
  '/wp-content',
  '/wp-includes',
  '/wordpress',
  '/wp-login.php',
  '/xmlrpc.php',

  // PHP文件探测
  '/info.php',
  '/phpinfo.php',
  '/php.ini',

  // 数据库和后端
  '/_all_dbs',
  '/phpmyadmin',
  '/adminer',

  // 其他常见攻击目标
  '/login.action',      // Confluence/JIRA
  '/ecp/',              // Exchange
  '/owa/',              // Outlook Web Access
  '/autodiscover',
  '/v2/_catalog',       // Docker Registry
  '/@vite/env',         // Vite开发服务器
  '/graphql',           // GraphQL探测（如果不使用）
  '/api/graphql',
  '/graphql/api',
  '/api/gql',
  '/s/',                // Atlassian CVE路径
  '/META-INF',
]

// 恶意扫描器 User-Agent 关键词
const BLOCKED_USER_AGENTS = [
  'l9scan',             // LeakIX扫描器
  'masscan',
  'nmap',
  'nikto',
  'sqlmap',
  'dirbuster',
  'gobuster',
  'wpscan',
  'nuclei',
  'zgrab',
  'censys',
  'shodan',
]

// 检查是否为被阻止的路径
function isBlockedPath(pathname: string): boolean {
  const lowerPath = pathname.toLowerCase()
  return BLOCKED_PATHS.some(blocked =>
    lowerPath === blocked || lowerPath.startsWith(blocked + '/')
  )
}

// 检查是否为恶意扫描器
function isMaliciousScanner(userAgent: string | null): boolean {
  if (!userAgent) return false
  const lowerUA = userAgent.toLowerCase()
  return BLOCKED_USER_AGENTS.some(scanner => lowerUA.includes(scanner))
}

// ============================================
// 公开路径配置
// ============================================

// 公开路径 - 无需认证
const PUBLIC_PATHS = new Set([
  '/', '/login', '/api/auth'
])

const PUBLIC_PREFIXES = [
  '/_next/', '/favicon', '/icons/', '/images/', '/assets/', '/api/auth/'
]

// 需要保护的路径
const PROTECTED_PATHS = new Set([
  '/workspace', '/settings', '/merchants'
])

const PROTECTED_API_PREFIXES = [
  '/api/chat', '/api/conversations', '/api/users',
  '/api/merchants', '/api/workspace'
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

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const userAgent = req.headers.get('user-agent')

  // ============================================
  // 安全检查（最高优先级）
  // ============================================

  // 1. 阻止恶意扫描器
  if (isMaliciousScanner(userAgent)) {
    // 返回404，不给攻击者任何有用信息
    return new NextResponse(null, { status: 404 })
  }

  // 2. 阻止敏感路径访问
  if (isBlockedPath(pathname)) {
    return new NextResponse(null, { status: 404 })
  }

  // ============================================
  // 正常请求处理
  // ============================================

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
