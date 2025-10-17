import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // 测试数据库连接
    const userCount = await prisma.user.count()
    const conversationCount = await prisma.conversation.count()
    const messageCount = await prisma.message.count()

    return NextResponse.json({
      success: true,
      data: {
        userCount,
        conversationCount,
        messageCount,
        databaseUrl: process.env.DATABASE_URL?.replace(/file:/, '') || 'not set'
      }
    })
  } catch (error) {
    console.error('数据库测试失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      databaseUrl: process.env.DATABASE_URL || 'not set'
    }, { status: 500 })
  }
}
