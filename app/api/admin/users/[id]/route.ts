/**
 * 管理员单用户管理 API
 * GET /api/admin/users/[id] - 获取用户详情
 * PATCH /api/admin/users/[id] - 更新用户
 * DELETE /api/admin/users/[id] - 删除用户
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/admin-guard'
import {
  success,
  serverError,
  badRequest,
  notFound,
} from '@/lib/api/http-response'

// GET - 获取用户详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        monthlyTokenLimit: true,
        currentMonthUsage: true,
        totalTokenUsed: true,
        createdAt: true,
        lastActiveAt: true,
        _count: {
          select: {
            conversations: true,
            messages: true,
          },
        },
      },
    })

    if (!user) {
      return notFound('用户不存在')
    }

    return success(user)
  } catch (error) {
    return serverError(
      '获取用户详情失败',
      process.env.NODE_ENV === 'development' ? String(error) : undefined
    )
  }
}

// PATCH - 更新用户
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, token } = await requireAdmin(request)
    if (error) return error
    const adminId = token!.sub

    const { id } = await params
    const body = await request.json()

    // 验证更新字段
    const allowedFields = ['role', 'status', 'monthlyTokenLimit', 'displayName']
    const updates: any = {}

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return badRequest('没有提供有效的更新字段')
    }

    // 验证角色
    if (updates.role && !['USER', 'ADMIN', 'GUEST'].includes(updates.role)) {
      return badRequest('无效的用户角色')
    }

    // 验证状态
    if (updates.status && !['ACTIVE', 'SUSPENDED'].includes(updates.status)) {
      return badRequest('无效的用户状态')
    }

    // 验证月度限额
    if (updates.monthlyTokenLimit !== undefined) {
      const limit = parseInt(updates.monthlyTokenLimit)
      if (isNaN(limit) || limit < 0) {
        return badRequest('月度Token限额必须是非负整数')
      }
      updates.monthlyTokenLimit = limit
    }

    // 防止管理员修改自己的角色
    if (updates.role && id === adminId) {
      return badRequest('不能修改自己的角色')
    }

    // 更新用户
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updates,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        monthlyTokenLimit: true,
        currentMonthUsage: true,
        totalTokenUsed: true,
      },
    })

    return success(updatedUser)
  } catch (error: any) {
    if (error.code === 'P2025') {
      return notFound('用户不存在')
    }
    return serverError(
      '更新用户失败',
      process.env.NODE_ENV === 'development' ? String(error) : undefined
    )
  }
}

// DELETE - 删除用户
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, token } = await requireAdmin(request)
    if (error) return error
    const adminId = token!.sub

    const { id } = await params

    // 防止管理员删除自己
    if (id === adminId) {
      return badRequest('不能删除自己的账户')
    }

    // 删除用户（Cascade会自动删除关联数据）
    await prisma.user.delete({
      where: { id },
    })

    return success({ deleted: true })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return notFound('用户不存在')
    }
    return serverError(
      '删除用户失败',
      process.env.NODE_ENV === 'development' ? String(error) : undefined
    )
  }
}
