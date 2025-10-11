/**
 * Auth 策略重构验证测试
 * 确保开发/生产环境认证逻辑正确
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { selectAuthStrategy, authenticate } from '@/auth/strategies'
import type { Credentials } from '@/auth/strategies'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn()
    }
  }
}))

describe('Auth 策略重构验证', () => {
  const baselineEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()

    for (const [key, value] of Object.entries(baselineEnv)) {
      if (value !== undefined) {
        vi.stubEnv(key, value)
      }
    }

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('策略选择', () => {
    it('开发环境应该选择 developmentAuth', () => {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('DEV_LOGIN_CODE', 'dev123')

      const strategy = selectAuthStrategy()

      expect(strategy.name).toBe('developmentAuth')
    })

    it('生产环境应该选择 productionAuth', () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('DEV_LOGIN_CODE', '')

      const strategy = selectAuthStrategy()

      expect(strategy.name).toBe('productionAuth')
    })

    it('生产环境检测到 DEV_LOGIN_CODE 应该返回失败策略', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('DEV_LOGIN_CODE', 'dev123') // 安全漏洞

      const strategy = selectAuthStrategy()
      const result = await strategy({
        email: 'test@example.com',
        code: 'any-code'
      })

      expect(result).toBeNull()
    })
  })

  describe('凭证验证', () => {
    it('缺少 email 应该返回 null', async () => {
      const credentials = {
        email: '',
        code: 'test-code'
      } as Credentials

      const result = await authenticate(credentials)

      expect(result).toBeNull()
    })

    it('缺少 code 应该返回 null', async () => {
      const credentials = {
        email: 'test@example.com',
        code: ''
      } as Credentials

      const result = await authenticate(credentials)

      expect(result).toBeNull()
    })

    it('无效邮箱格式应该返回 null', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('DEV_LOGIN_CODE', 'dev123')

      const credentials = {
        email: 'invalid-email',
        code: 'dev123'
      }

      const result = await authenticate(credentials)

      expect(result).toBeNull()
    })
  })

  describe('开发环境认证行为', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('DEV_LOGIN_CODE', 'dev123')
    })

    it('正确的开发码应该成功认证', async () => {
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'test',
        displayName: 'Test User',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: new Date(),
        avatar: null,
        monthlyTokenLimit: 100000,
        currentMonthUsage: 0,
        totalTokenUsed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActiveAt: null
      })

      const result = await authenticate({
        email: 'test@example.com',
        code: 'dev123'
      })

      expect(result).not.toBeNull()
      expect(result?.email).toBe('test@example.com')
      expect(result?.role).toBe('USER')
    })

    it('错误的开发码应该失败', async () => {
      const result = await authenticate({
        email: 'test@example.com',
        code: 'wrong-code'
      })

      expect(result).toBeNull()
    })

    it('不存在的用户应该自动创建', async () => {
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'new-user-1',
        email: 'newuser@example.com',
        username: 'newuser',
        displayName: 'newuser',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: new Date(),
        avatar: null,
        monthlyTokenLimit: 100000,
        currentMonthUsage: 0,
        totalTokenUsed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActiveAt: null
      })

      const result = await authenticate({
        email: 'newuser@example.com',
        code: 'dev123'
      })

      expect(result).not.toBeNull()
      expect(result?.email).toBe('newuser@example.com')
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'newuser@example.com',
          role: 'USER',
          status: 'ACTIVE'
        })
      })
    })
  })

  describe('生产环境认证行为', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('ADMIN_LOGIN_PASSWORD', 'secure-password')
      vi.stubEnv('DEV_LOGIN_CODE', '')
    })

    it('正确的密码应该成功认证', async () => {
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'admin-1',
        email: 'admin@example.com',
        username: 'admin',
        displayName: 'Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: new Date(),
        avatar: null,
        monthlyTokenLimit: 1000000,
        currentMonthUsage: 0,
        totalTokenUsed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActiveAt: null
      })

      const result = await authenticate({
        email: 'admin@example.com',
        code: 'secure-password'
      })

      expect(result).not.toBeNull()
      expect(result?.role).toBe('ADMIN')
    })

    it('错误的密码应该失败', async () => {
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'admin-1',
        email: 'admin@example.com',
        emailVerified: new Date(),
        status: 'ACTIVE'
      } as any)

      const result = await authenticate({
        email: 'admin@example.com',
        code: 'wrong-password'
      })

      expect(result).toBeNull()
    })

    it('不存在的用户应该失败（不自动创建）', async () => {
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const result = await authenticate({
        email: 'nonexistent@example.com',
        code: 'secure-password'
      })

      expect(result).toBeNull()
      expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('未验证邮箱的用户应该失败', async () => {
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        emailVerified: null, // 未验证
        status: 'ACTIVE'
      } as any)

      const result = await authenticate({
        email: 'user@example.com',
        code: 'secure-password'
      })

      expect(result).toBeNull()
    })

    it('非 ACTIVE 状态用户应该失败', async () => {
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        emailVerified: new Date(),
        status: 'SUSPENDED' // 被禁用
      } as any)

      const result = await authenticate({
        email: 'user@example.com',
        code: 'secure-password'
      })

      expect(result).toBeNull()
    })
  })

  describe('错误处理', () => {
    it('数据库错误应该返回 null', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('DEV_LOGIN_CODE', 'dev123')

      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database error'))

      const result = await authenticate({
        email: 'test@example.com',
        code: 'dev123'
      })

      expect(result).toBeNull()
    })
  })
})
