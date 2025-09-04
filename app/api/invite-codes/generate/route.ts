import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 批量生成邀请码
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      count = 10,
      prefix = 'ZHIDIAN',
      maxUses = 1,
      expiresInDays,
      defaultRole = 'USER',
      monthlyTokenLimit = 50000,
      description = '批量生成的邀请码',
      createdBy 
    } = body
    
    if (count > 100) {
      return NextResponse.json(
        { error: '单次最多生成100个邀请码' },
        { status: 400 }
      )
    }
    
    // 计算过期时间
    const expiresAt = expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null
    
    // 生成唯一邀请码函数
    function generateCode(): string {
      const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase()
      const timestamp = Date.now().toString(36).toUpperCase()
      return `${prefix}${randomStr}${timestamp}`.substring(0, 20)
    }
    
    // 批量创建邀请码
    const inviteCodes = []
    const existingCodes = new Set()
    
    for (let i = 0; i < count; i++) {
      let code = generateCode()
      
      // 确保代码唯一性
      while (existingCodes.has(code)) {
        code = generateCode()
      }
      existingCodes.add(code)
      
      inviteCodes.push({
        code,
        description: `${description} (${i + 1}/${count})`,
        maxUses,
        expiresAt,
        defaultRole,
        monthlyTokenLimit,
        createdBy,
      })
    }
    
    // 批量插入数据库
    const result = await prisma.inviteCode.createMany({
      data: inviteCodes,
      skipDuplicates: true, // 跳过重复的代码
    })
    
    // 获取创建的邀请码详情
    const createdCodes = await prisma.inviteCode.findMany({
      where: {
        code: {
          in: inviteCodes.map(invite => invite.code)
        }
      },
      select: {
        id: true,
        code: true,
        description: true,
        maxUses: true,
        expiresAt: true,
        defaultRole: true,
        monthlyTokenLimit: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    return NextResponse.json({
      success: true,
      data: {
        count: result.count,
        codes: createdCodes,
      },
      message: `成功生成 ${result.count} 个邀请码`
    }, { status: 201 })
    
  } catch (error) {
    return NextResponse.json(
      { error: '生成邀请码失败' },
      { status: 500 }
    )
  }
}