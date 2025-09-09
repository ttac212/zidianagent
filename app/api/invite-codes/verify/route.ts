import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 验证邀请码
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code } = body
    
    if (!code) {
      return NextResponse.json(
        { error: '邀请码不能为空' },
        { status: 400 }
      )
    }
    
    // 标准化邀请码为大写
    const normalized = String(code).trim().toUpperCase()

    // 查找邀请码
    const inviteCode = await prisma.inviteCode.findUnique({
      where: { code: normalized },
      include: {
        _count: {
          select: {
            usedBy: true
          }
        }
      }
    })
    
    if (!inviteCode) {
      return NextResponse.json(
        { error: '邀请码不存在' },
        { status: 404 }
      )
    }
    
    // 检查邀请码状态
    if (!inviteCode.isActive) {
      return NextResponse.json(
        { error: '邀请码已被禁用' },
        { status: 403 }
      )
    }
    
    // 检查是否过期
    if (inviteCode.expiresAt && new Date() > inviteCode.expiresAt) {
      return NextResponse.json(
        { error: '邀请码已过期' },
        { status: 403 }
      )
    }
    
    // 检查使用次数
    if (inviteCode.usedCount >= inviteCode.maxUses) {
      return NextResponse.json(
        { error: '邀请码使用次数已达上限' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: inviteCode.id,
        code: inviteCode.code,
        description: inviteCode.description,
        defaultRole: inviteCode.defaultRole,
        monthlyTokenLimit: inviteCode.monthlyTokenLimit,
        remainingUses: inviteCode.maxUses - inviteCode.usedCount,
        expiresAt: inviteCode.expiresAt,
      },
      message: '邀请码验证成功'
    })
  } catch (error) {
    void error
    return NextResponse.json(
      { error: '验证邀请码失败' },
      { status: 500 }
    )
  }
}