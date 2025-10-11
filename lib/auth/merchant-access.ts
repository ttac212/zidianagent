import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { MerchantMemberRole, UserRole } from '@prisma/client'

export async function ensureMerchantMembership(
  userId: string,
  merchantId: string,
  role: MerchantMemberRole = 'EDITOR'
): Promise<void> {
  try {
    await prisma.merchantMember.create({
      data: {
        merchantId,
        userId,
        role
      }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return
      }

      throw error
    }

    throw error
  }
}

export async function hasMerchantAccess(
  userId: string,
  merchantId: string,
  userRole?: UserRole | string | null
): Promise<boolean> {
  if (!userId || !merchantId) {
    return false
  }

  // 管理员可访问所有商家
  if (userRole === 'ADMIN') {
    return true
  }

  // 仅基于成员表判断（可撤销）
  const membership = await prisma.merchantMember.findUnique({
    where: {
      merchantId_userId: {
        merchantId,
        userId
      }
    },
    select: { id: true }
  })

  return !!membership
}
