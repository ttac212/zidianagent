import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getToken } from 'next-auth/jwt'

// 获取单个用户详情（受保护）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request as any })
    if (!token?.sub) return NextResponse.json({ error: '未认证' }, { status: 401 })

    const { id } = await params
    
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        conversations: {
          select: {
            id: true,
            title: true,
            messageCount: true,
            totalTokens: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 5, // 最近5个对话
        },
        documents: {
          select: {
            id: true,
            title: true,
            wordCount: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 5, // 最近5个文档
        },
        usageStats: {
          select: {
            date: true,
            totalTokens: true,
            apiCalls: true,
            modelId: true,          // 新增
            modelProvider: true,    // 新增
          },
          orderBy: { date: 'desc' },
          take: 90, // 增加数量，因为有模型分组
        },
        _count: {
          select: {
            conversations: true,
            documents: true,
            feedbacks: true,
          }
        }
      }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: user
    })
  } catch (error) {
    return NextResponse.json(
      { error: '获取用户详情失败' },
      { status: 500 }
    )
  }
}

// 更新用户
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { 
      username, 
      displayName, 
      role, 
      status, 
      monthlyTokenLimit, 
      currentMonthUsage 
    } = body
    
    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id }
    })
    
    if (!existingUser) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }
    
    // 检查用户名冲突
    if (username && username !== existingUser.username) {
      const usernameExists = await prisma.user.findFirst({
        where: {
          username,
          id: { not: id }
        }
      })
      
      if (usernameExists) {
        return NextResponse.json(
          { error: '用户名已存在' },
          { status: 409 }
        )
      }
    }
    
    // 更新用户
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        username,
        displayName,
        role,
        status,
        monthlyTokenLimit,
        currentMonthUsage,
        updatedAt: new Date(),
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
        updatedAt: true,
      }
    })
    
    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: '用户更新成功'
    })
  } catch (error) {
    void error
    return NextResponse.json(
      { error: '更新用户失败' },
      { status: 500 }
    )
  }
}

// 删除用户
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // 检查用户是否存在
    const existingUser = await prisma.user.findUnique({
      where: { id }
    })
    
    if (!existingUser) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }
    
    // 软删除：更新状态为 DELETED
    const deletedUser = await prisma.user.update({
      where: { id },
      data: {
        status: 'DELETED',
        updatedAt: new Date(),
      }
    })
    
    return NextResponse.json({
      success: true,
      message: '用户删除成功'
    })
  } catch (error) {
    void error
    return NextResponse.json(
      { error: '删除用户失败' },
      { status: 500 }
    )
  }
}