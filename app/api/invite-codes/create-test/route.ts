import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createErrorResponse, generateRequestId } from '@/lib/api/error-handler'

// 创建测试邀请码 - 仅开发环境可用
export async function POST() {
  // 仅在开发环境或明确启用时允许访问
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_TEST_ENDPOINTS) {
    return NextResponse.json(
      { error: 'Test endpoint not available in production' },
      { status: 404 }
    )
  }
  try {
    // 生成测试邀请码
    const testCodes = []
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30天后过期

    for (let i = 1; i <= 50; i++) {
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase()
      const code = `ZHIDIAN${randomStr}${i.toString().padStart(2, '0')}`
      
      testCodes.push({
        code,
        description: `第一批测试邀请码 (${i}/50)`,
        maxUses: 1,
        expiresAt,
        defaultRole: 'USER' as const,
        monthlyTokenLimit: 50000,
        createdBy: 'system',
      })
    }

    // 逐个创建邀请码（避免批量创建问题）
    const created = []
    for (const codeData of testCodes) {
      try {
        const invite = await prisma.inviteCode.create({
          data: codeData
        })
        created.push(invite)
      } catch (error) {
        void error
        }
    }

    return NextResponse.json({
      success: true,
      data: {
        count: created.length,
        codes: created.map(code => ({
          code: code.code,
          description: code.description,
          maxUses: code.maxUses,
          expiresAt: code.expiresAt,
          createdAt: code.createdAt
        }))
      },
      message: `成功生成 ${created.length} 个测试邀请码`
    })

  } catch (error) {
    return createErrorResponse(error as Error, generateRequestId())
  }
}