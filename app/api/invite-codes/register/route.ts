import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 使用邀请码注册用户
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      inviteCode, 
      email, 
      username, 
      displayName 
    } = body
    
    // 验证必填字段
    if (!inviteCode || !email) {
      return NextResponse.json(
        { error: '邀请码和邮箱是必填项' },
        { status: 400 }
      )
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '邮箱格式不正确' },
        { status: 400 }
      )
    }
    
    // 开始事务
    const result = await prisma.$transaction(async (tx) => {
      // 1. 验证邀请码
      const invite = await tx.inviteCode.findUnique({
        where: { code: inviteCode.trim().toUpperCase() }
      })
      
      if (!invite) {
        throw new Error('邀请码不存在')
      }
      
      if (!invite.isActive) {
        throw new Error('邀请码已被禁用')
      }
      
      if (invite.expiresAt && new Date() > invite.expiresAt) {
        throw new Error('邀请码已过期')
      }
      
      if (invite.usedCount >= invite.maxUses) {
        throw new Error('邀请码使用次数已达上限')
      }
      
      // 2. 检查邮箱是否已存在
      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true }
      })
      
      if (existingUser) {
        throw new Error('邮箱已被注册')
      }
      
      // 3. 检查用户名是否已存在
      if (username) {
        const existingUsername = await tx.user.findUnique({
          where: { username },
          select: { id: true }
        })
        
        if (existingUsername) {
          throw new Error('用户名已存在')
        }
      }
      
      // 4. 创建用户
      const user = await tx.user.create({
        data: {
          email,
          username,
          displayName,
          role: invite.defaultRole,
          monthlyTokenLimit: invite.monthlyTokenLimit,
          inviteCodeId: invite.id,
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
          inviteCode: {
            select: {
              code: true,
              description: true,
            }
          }
        }
      })
      
      // 5. 更新邀请码使用次数
      await tx.inviteCode.update({
        where: { id: invite.id },
        data: {
          usedCount: { increment: 1 }
        }
      })
      
      return user
    })
    
    return NextResponse.json({
      success: true,
      data: result,
      message: '用户注册成功'
    }, { status: 201 })
    
  } catch (error) {
    const message = error instanceof Error ? error.message : '注册失败'
    return NextResponse.json(
      { error: message },
      { status: 400 }
    )
  }
}