/**
 * 生产环境认证策略
 * 只允许预先创建的用户登录，需要邮箱验证
 *
 * Linus: "Security should be simple" - 不自动创建用户，不允许未验证邮箱
 */

import { prisma } from '@/lib/prisma'
import type { Credentials, AuthUser } from './development'

/**
 * 生产环境认证逻辑
 * - 使用 ADMIN_LOGIN_PASSWORD 验证
 * - 只允许已存在且邮箱已验证的用户
 * - 不自动创建用户
 */
export async function productionAuth(credentials: Credentials): Promise<AuthUser | null> {
  try {
    // 必须配置管理员密码
    const adminPassword = process.env.ADMIN_LOGIN_PASSWORD
    if (!adminPassword) {
      console.error('[ProdAuth] ADMIN_LOGIN_PASSWORD not configured')
      return null
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(credentials.email)) {
      console.log('[ProdAuth] Invalid email format')
      return null
    }

    // 查找用户（生产环境不自动创建）
    const user = await prisma.user.findUnique({
      where: { email: credentials.email }
    })

    if (!user) {
      console.log(`[ProdAuth] User not found: ${credentials.email}`)
      return null
    }

    // 验证邮箱是否已验证
    if (!user.emailVerified) {
      console.log(`[ProdAuth] Email not verified: ${credentials.email}`)
      return null
    }

    // 验证密码
    if (credentials.code !== adminPassword) {
      console.log('[ProdAuth] Invalid password')
      return null
    }

    // 检查用户状态
    if (user.status !== 'ACTIVE') {
      console.log(`[ProdAuth] User not active: ${credentials.email}`)
      return null
    }

    return {
      id: user.id,
      email: user.email,
      name: user.displayName || user.username || user.email,
      role: user.role,
      displayName: user.displayName,
      currentMonthUsage: 0, // 从数据库加载更准确
      monthlyTokenLimit: 1000000
    }
  } catch (error) {
    console.error('[ProdAuth] Error:', error)
    return null
  }
}
