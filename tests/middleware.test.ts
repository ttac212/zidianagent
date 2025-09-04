import { describe, it, expect } from 'vitest'

// 这里提供一个最小形态的逻辑测试，验证路径分类函数的行为
// 真正的 Next.js middleware 集成测试需要运行时环境与请求对象，
// 在本最小示例中以纯函数思想进行基本分支覆盖。

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin")
}

function isProtectedApi(pathname: string) {
  return pathname === "/api/chat" || pathname.startsWith("/api/users") || pathname === "/api/conversations" || pathname.startsWith("/api/conversations/")
}

function isProtectedPage(pathname: string) {
  return pathname === "/workspace" || pathname.startsWith("/workspace/")
}

describe('middleware basic route classification', () => {
  it('should detect admin paths', () => {
    expect(isAdminPath('/admin')).toBe(true)
    expect(isAdminPath('/admin/monitoring')).toBe(true)
    expect(isAdminPath('/api/admin/users')).toBe(true)
    expect(isAdminPath('/settings')).toBe(false)
  })

  it('should detect protected apis', () => {
    expect(isProtectedApi('/api/chat')).toBe(true)
    expect(isProtectedApi('/api/users')).toBe(true)
    expect(isProtectedApi('/api/conversations')).toBe(true)
    expect(isProtectedApi('/api/merchants')).toBe(false)
  })

  it('should detect protected pages', () => {
    expect(isProtectedPage('/workspace')).toBe(true)
    expect(isProtectedPage('/workspace/abc')).toBe(true)
    expect(isProtectedPage('/')).toBe(false)
  })
})

