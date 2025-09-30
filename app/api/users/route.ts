import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getToken } from 'next-auth/jwt'
import { createErrorResponse, generateRequestId, requireAuth } from '@/lib/api/error-handler'
import {
  success,
  error,
  validationError
} from '@/lib/api/http-response'


// 获取用户列表（受保护 - 需要ADMIN权限）
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any })
    
    // 使用统一认证检查，需要ADMIN权限
    const authError = requireAuth(token, 'ADMIN')
    if (authError) return createErrorResponse(authError)
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    
    const skip = (page - 1) * limit
    
    // 构建查询条件
    const where = search ? {
      OR: [
        { email: { contains: search } },
        { displayName: { contains: search } },
        { username: { contains: search } },
      ]
    } : {}
    
    // 获取用户列表
    const users = await prisma.user.findMany({
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
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit,
    })
    
    // 获取总数
    const total = await prisma.user.count({ where })
    
    return NextResponse.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}

// 创建新用户（需要ADMIN权限）
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any })
    
    // 使用统一认证检查，需要ADMIN权限
    const authError = requireAuth(token, 'ADMIN')
    if (authError) return createErrorResponse(authError)
    
    const body = await request.json()
    const { email, username, displayName, role = 'USER', monthlyTokenLimit = 100000 } = body
    
    // 验证必填字段
    if (!email) {
      return validationError('邮箱是必填项')
    }
    
    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    
    if (existingUser) {
      return error('邮箱已存在', { status: 409 })
    }
    
    // 检查用户名是否已存在（如果提供了）
    if (username) {
      const existingUsername = await prisma.user.findUnique({
        where: { username }
      })
      
      if (existingUsername) {
        return error('用户名已存在', { status: 409 })
      }
    }
    
    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        username,
        displayName,
        role,
        monthlyTokenLimit,
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
      }
    })
    
    return success(user)
  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}