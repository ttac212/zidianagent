import { randomUUID } from 'node:crypto'

import type { UserRole } from '@prisma/client'

import { prisma } from '@/lib/prisma'

type MerchantMemberRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'

const DEFAULT_MEMBER_ROLE: MerchantMemberRole = 'EDITOR'

async function queryMembershipExists(userId: string, merchantId: string) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(1) as count
    FROM merchant_members
    WHERE "userId" = ${userId} AND "merchantId" = ${merchantId}
  `

  const count = rows?.[0]?.count
  return Number(count ?? 0) > 0
}

/**
 * 判断用户是否有访问指定商家的权限。
 * - 管理员默认拥有全部商家访问权限
 * - 其它角色需在 merchant_members 表中拥有成员关系
 */
export async function hasMerchantAccess(
  userId: string | null | undefined,
  merchantId: string | null | undefined,
  role?: UserRole | string | null
): Promise<boolean> {
  if (!userId || !merchantId) {
    return false
  }

  if (role === 'ADMIN') {
    return true
  }

  try {
    return await queryMembershipExists(userId, merchantId)
  } catch (error) {
    console.error('[merchant-access] 查询成员权限失败:', error)
    return false
  }
}

/**
 * 确保用户拥有指定商家的成员关系。
 * 若不存在则创建，存在则直接返回。
 */
export async function ensureMerchantMembership(
  userId: string,
  merchantId: string,
  role: MerchantMemberRole = DEFAULT_MEMBER_ROLE
): Promise<boolean> {
  if (!userId || !merchantId) {
    throw new Error('ensureMerchantMembership 需要提供有效的 userId 和 merchantId')
  }

  const alreadyExists = await queryMembershipExists(userId, merchantId)
  if (alreadyExists) {
    return false
  }

  const now = new Date()
  // PostgreSQL 枚举类型需要显式类型转换
  await prisma.$executeRaw`
    INSERT INTO merchant_members ("id","merchantId","userId","role","createdAt","updatedAt")
    VALUES (${randomUUID()}, ${merchantId}, ${userId}, ${role}::"MerchantMemberRole", ${now}, ${now})
  `

  return true
}
