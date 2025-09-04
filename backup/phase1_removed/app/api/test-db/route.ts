import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 测试数据库连接和初始化 - 仅开发环境可用
export async function GET() {
  // 仅在开发环境或明确启用时允许访问
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_TEST_ENDPOINTS) {
    return NextResponse.json(
      { error: 'Test endpoint not available in production' },
      { status: 404 }
    )
  }
  try {
    // 测试数据库连接
    await prisma.$connect()
    
    // 获取数据库信息 (SQLite)
    const result = await prisma.$queryRaw`SELECT sqlite_version() as version`
    
    // 测试创建用户
    const testUser = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        email: 'test@example.com',
        displayName: '测试用户',
        role: 'USER',
      }
    })
    
    return NextResponse.json({
      success: true,
      message: '数据库连接成功！',
      database: 'SQLite',
      version: result,
      testUser: testUser,
    })
  } catch (error) {
    console.error('数据库连接错误:', error)
    return NextResponse.json(
      {
        success: false,
        message: '数据库连接失败',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

// 初始化数据库表 - 仅开发环境可用
export async function POST() {
  // 仅在开发环境或明确启用时允许访问
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_TEST_ENDPOINTS) {
    return NextResponse.json(
      { error: 'Test endpoint not available in production' },
      { status: 404 }
    )
  }
  try {
    await prisma.$connect()
    
    // 创建测试用户
    const testUser = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        displayName: '新测试用户',
        role: 'USER',
      }
    })
    
    // 创建测试对话
    const testConversation = await prisma.conversation.create({
      data: {
        title: '测试对话',
        userId: testUser.id,
        modelId: 'gpt-3.5-turbo',
      }
    })
    
    // 创建测试消息
    const testMessage = await prisma.message.create({
      data: {
        conversationId: testConversation.id,
        role: 'USER',
        content: '这是一条测试消息',
        modelId: 'gpt-3.5-turbo',
        totalTokens: 10,
      }
    })
    
    return NextResponse.json({
      success: true,
      message: '数据库初始化完成！',
      data: {
        user: testUser,
        conversation: testConversation,
        message: testMessage,
      }
    })
  } catch (error) {
    console.error('数据库初始化错误:', error)
    return NextResponse.json(
      {
        success: false,
        message: '数据库初始化失败',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}