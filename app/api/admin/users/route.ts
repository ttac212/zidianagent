/**
 * 管理员用户管理 API
 * GET /api/admin/users - 获取用户列表
 * POST /api/admin/users - 创建新用户
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/admin-guard'
import {
  success,
  serverError,
  badRequest,
} from '@/lib/api/http-response'

// GET - 获取用户列表
export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const { error } = await requireAdmin(request)
    if (error) return error

    // 获取查询参数
    const url = new URL(request.url)
    const search = url.searchParams.get('search') || ''
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
    const skip = (page - 1) * limit

    // 构建查询条件
    const where = search
      ? {
          OR: [
            { email: { contains: search } },
            { displayName: { contains: search } },
            { username: { contains: search } },
          ],
        }
      : {}

    // 获取用户列表和总数
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
          _count: {
            select: {
              conversations: true,
              messages: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    return success({
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return serverError(
      '获取用户列表失败',
      process.env.NODE_ENV === 'development' ? String(error) : undefined
    )
  }
}

// POST - 创建新用户
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const { error } = await requireAdmin(request)
    if (error) return error

    const body = await request.json()
    const { email, username, displayName, role, monthlyTokenLimit } = body

    // 验证必需字段
    if (!email) {
      return badRequest('邮箱是必需的')
    }

    // 验证角色
    if (role && !['USER', 'ADMIN', 'GUEST'].includes(role)) {
      return badRequest('无效的用户角色')
    }

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return badRequest('邮箱已被使用')
    }

    // 检查用户名是否已存在
    if (username) {
      const existingUsername = await prisma.user.findUnique({
        where: { username },
      })

      if (existingUsername) {
        return badRequest('用户名已被使用')
      }
    }

    // 创建新用户
    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        displayName: displayName || username || email.split('@')[0],
        role: role || 'USER',
        status: 'ACTIVE',
        monthlyTokenLimit: monthlyTokenLimit || 100000,
        currentMonthUsage: 0,
        totalTokenUsed: 0,
      },
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
      },
    })

    return success(newUser)
  } catch (error: any) {
    return serverError(
      '创建用户失败',
      process.env.NODE_ENV === 'development' ? String(error) : undefined
    )
  }
}
