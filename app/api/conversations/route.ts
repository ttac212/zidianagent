import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getToken } from 'next-auth/jwt'
import { DEFAULT_MODEL, isAllowed } from '@/lib/ai/models'
import { checkRateLimit } from '@/lib/security/rate-limiter'

// 获取对话列表（受保护）
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any })
    if (!token?.sub) return NextResponse.json({ error: '未认证' }, { status: 401 })

    // 速率限制检查
    const rateLimitResult = await checkRateLimit(request, 'GENERAL', String(token.sub))
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: rateLimitResult.error?.message || '请求过于频繁' },
        { status: 429 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const includeMessages = searchParams.get('includeMessages') === 'true'

    // userId 从 token 解析，无需校验查询参数

    const skip = (page - 1) * limit

    // 获取对话列表
    const conversations = await prisma.conversation.findMany({
      where: {
        userId: String(token.sub),
        user: {
          status: { not: 'DELETED' }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          }
        },
        _count: {
          select: {
            messages: true
          }
        },
        messages: includeMessages ? {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            promptTokens: true,
            completionTokens: true,
            modelId: true,
            temperature: true,
            finishReason: true,
            metadata: true,
            createdAt: true,
          }
        } : false,
      },
      orderBy: [
        { lastMessageAt: 'desc' },
        { createdAt: 'desc' }  // 使用createdAt作为第二排序，有索引支持
      ],
      skip,
      take: limit,
    })
    
    // 获取总数
    const total = await prisma.conversation.count({
      where: {
        userId: String(token.sub),
        user: {
          status: { not: 'DELETED' }
        }
      }
    })
    
    // 映射消息计数到messageCount字段
    const conversationsWithCount = conversations.map((conv: any) => ({
      ...conv,
      messageCount: conv._count?.messages || 0,
      _count: undefined  // 移除内部字段，不暴露给前端
    }))

    return NextResponse.json({
      success: true,
      data: {
        conversations: conversationsWithCount,
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

    const userId = String(token.sub)

    // 速率限制检查
    const rateLimitResult = await checkRateLimit(request, 'GENERAL', userId)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: rateLimitResult.error?.message || '请求过于频繁' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const {
      title = '新对话',
      modelId,
      temperature = 0.7,
      maxTokens = 2000,
      contextAware = true
    } = body
    
    // 验证并设置模型ID
    let validatedModelId = modelId
    if (!validatedModelId || !isAllowed(validatedModelId)) {
      // 如果没有提供模型或模型不在允许列表中，使用默认模型
      validatedModelId = DEFAULT_MODEL
    }

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
        modelId: validatedModelId,
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