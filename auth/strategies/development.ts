/**
 * 开发环境认证策略
 * 使用开发登录码，自动创建不存在的用户
 *
 * Linus: "每个函数只做一件事" - 这个函数只负责开发环境认证
 */

import { prisma } from '@/lib/prisma'

export interface Credentials {
  email: string
  code: string
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  displayName: string | null
  currentMonthUsage: number
  monthlyTokenLimit: number
}

/**
 * 开发环境认证逻辑
 * - 使用 DEV_LOGIN_CODE 验证
 * - 自动创建不存在的用户
 * - 无需邮箱验证
 */
export async function developmentAuth(credentials: Credentials): Promise<AuthUser | null> {
  try {
    const devCode = process.env.DEV_LOGIN_CODE

    // 必须配置开发登录码
    if (!devCode) {
      console.error('[DevAuth] DEV_LOGIN_CODE not configured')
      return null
    }

    // 验证登录码
    if (credentials.code !== devCode) {
      console.log('[DevAuth] Invalid dev code')
      return null
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(credentials.email)) {
      console.log('[DevAuth] Invalid email format')
      return null
    }

    // 查找或创建用户
    let user = await prisma.user.findUnique({
      where: { email: credentials.email }
    })

    if (!user) {
      console.log(`[DevAuth] Creating new user: ${credentials.email}`)
      user = await prisma.user.create({
        data: {
          email: credentials.email,
          username: credentials.email.split('@')[0],
          displayName: credentials.email.split('@')[0],
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: new Date() // 开发环境自动验证邮箱
        }
      })
    }

    return {
      id: user.id,
      email: user.email,
      name: user.displayName || user.username || user.email,
      role: user.role,
      displayName: user.displayName,
      currentMonthUsage: 0, // 从数据库加载更准确，这里简化
      monthlyTokenLimit: 1000000
    }
  } catch (error) {
    console.error('[DevAuth] Error:', error)
    return null
  }
}
