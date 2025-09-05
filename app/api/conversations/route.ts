import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getToken } from 'next-auth/jwt'

// 获取对话列表（受保护）
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any })
    if (!token?.sub) return NextResponse.json({ error: '未认证' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const userId = String(token.sub)

    // userId 从 token 解析，无需校验查询参数
    
    const skip = (page - 1) * limit
    
    // 获取对话列表
    const conversations = await prisma.conversation.findMany({
      where: {
        userId,
        user: {
          status: { not: 'DELETED' }
        }
      },
      select: {
        id: true,
        title: true,
        modelId: true,
        temperature: true,
        messageCount: true,
        totalTokens: true,
        createdAt: true,
        updatedAt: true,
        lastMessageAt: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          }
        }
      },
      orderBy: [
        { lastMessageAt: 'desc' },
        { updatedAt: 'desc' }
      ],
      skip,
      take: limit,
    })
    
    // 获取总数
    const total = await prisma.conversation.count({
      where: {
        userId,
        user: {
          status: { not: 'DELETED' }
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      data: {
        conversations,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    void error
    return NextResponse.json(
      { error: '获取对话列表失败' },
      { status: 500 }
    )
  }
}

// 创建新对话（受保护）
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any })
    if (!token?.sub) return NextResponse.json({ error: '未认证' }, { status: 401 })

    const body = await request.json()
    const {
      title = '新对话',
      modelId = 'gpt-3.5-turbo',
      temperature = 0.7,
      maxTokens = 2000,
      contextAware = true
    } = body

    const userId = String(token.sub)

    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })
    
    if (!user || user.status === 'DELETED') {
      return NextResponse.json(
        { error: '用户不存在或已被删除' },
        { status: 404 }
      )
    }
    
    // 创建对话
    const conversation = await prisma.conversation.create({
      data: {
        title,
        userId,
        modelId,
        temperature,
        maxTokens,
        contextAware,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          }
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      data: conversation,
      message: '对话创建成功'
    }, { status: 201 })
  } catch (error) {
    void error
    return NextResponse.json(
      { error: '创建对话失败' },
      { status: 500 }
    )
  }
}