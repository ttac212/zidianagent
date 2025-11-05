import { NextRequest } from "next/server"
import { prisma } from '@/lib/prisma'
import { getToken } from 'next-auth/jwt'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'
import {
  success,
  notFound,
} from '@/lib/api/http-response'


// 获取单个用户基本信息（本人可读）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request as any })

    if (!token?.sub) {
      return createErrorResponse(new Error('未认证'), generateRequestId())
    }

    const { id } = await params

    // 只允许查看自己的信息（管理员请使用 /api/admin/users/[id]）
    if (String(token.sub) !== id) {
      return createErrorResponse(
        new Error('无权访问其他用户信息'),
        generateRequestId()
      )
    }

    // 只返回配额相关的基本字段
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        status: true,
        monthlyTokenLimit: true,
        currentMonthUsage: true,
        totalTokenUsed: true,
        createdAt: true,
        lastActiveAt: true,
      }
    })

    if (!user) {
      return notFound('用户不存在')
    }

    return success(user)
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

// PATCH 和 DELETE 请使用 /api/admin/users/[id]