import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 获取邀请码列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const active = searchParams.get('active')
    
    const skip = (page - 1) * limit
    
    // 构建查询条件
    const where: any = {}
    if (active === 'true') {
      where.isActive = true
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    } else if (active === 'false') {
      where.OR = [
        { isActive: false },
        { expiresAt: { lte: new Date() } }
      ]
    }
    
    // 获取邀请码列表
    const inviteCodes = await prisma.inviteCode.findMany({
      where,
      select: {
        id: true,
        code: true,
        description: true,
        maxUses: true,
        usedCount: true,
        isActive: true,
        expiresAt: true,
        defaultRole: true,
        monthlyTokenLimit: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            usedBy: true
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
    const total = await prisma.inviteCode.count({ where })
    
    return NextResponse.json({
      success: true,
      data: {
        inviteCodes,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: '获取邀请码列表失败' },
      { status: 500 }
    )
  }
}

// 创建新邀请码
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      code,
      description,
      maxUses = 1,
      expiresAt,
      defaultRole = 'USER',
      monthlyTokenLimit = 50000,
      createdBy 
    } = body
    
    // 验证邀请码格式（6-20位字母数字）
    if (!code || !/^[A-Za-z0-9]{6,20}$/.test(code)) {
      return NextResponse.json(
        { error: '邀请码必须是6-20位字母或数字' },
        { status: 400 }
      )
    }
    
    // 检查邀请码是否已存在
    const existingCode = await prisma.inviteCode.findUnique({
      where: { code }
    })
    
    if (existingCode) {
      return NextResponse.json(
        { error: '邀请码已存在' },
        { status: 409 }
      )
    }
    
    // 创建邀请码
    const inviteCode = await prisma.inviteCode.create({
      data: {
        code,
        description,
        maxUses,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        defaultRole,
        monthlyTokenLimit,
        createdBy,
      }
    })
    
    return NextResponse.json({
      success: true,
      data: inviteCode,
      message: '邀请码创建成功'
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: '创建邀请码失败' },
      { status: 500 }
    )
  }
}