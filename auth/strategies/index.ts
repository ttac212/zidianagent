/**
 * 认证策略选择器
 * 根据环境自动选择合适的认证策略
 *
 * Linus: "Make the common case fast" - 策略模式消除条件分支
 */

import { developmentAuth } from './development'
import { productionAuth } from './production'
import type { Credentials, AuthUser } from './development'

export type { Credentials, AuthUser }

/**
 * 认证策略函数类型
 */
export type AuthStrategy = (credentials: Credentials) => Promise<AuthUser | null>

/**
 * 选择认证策略
 * 生产环境使用 productionAuth，其他环境使用 developmentAuth
 */
export function selectAuthStrategy(): AuthStrategy {
  const isProduction = process.env.NODE_ENV === 'production'

  // 生产环境安全检查
  if (isProduction && process.env.DEV_LOGIN_CODE) {
    console.error('⚠️  DEV_LOGIN_CODE detected in production environment!')
    console.error('⚠️  Remove DEV_LOGIN_CODE from production .env file')
    // 生产环境发现开发配置，强制返回失败策略
    return async () => null
  }

  return isProduction ? productionAuth : developmentAuth
}

/**
 * 统一的认证入口
 * 自动选择策略并执行认证
 */
export async function authenticate(credentials: Credentials): Promise<AuthUser | null> {
  if (!credentials || !credentials.email || !credentials.code) {
    console.log('[Auth] Missing credentials')
    return null
  }

  const strategy = selectAuthStrategy()
  return strategy(credentials)
}
