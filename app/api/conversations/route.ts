import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getToken } from 'next-auth/jwt'
import { DEFAULT_MODEL, isAllowed } from '@/lib/ai/models'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import {
  success,
  error,
  notFound,
  unauthorized,
  validationError,
  serverError
} from '@/lib/api/http-response'

// DoS保护配置（修复R3）
const MAX_LIMIT = 50 // 最大页面大小
const MAX_LIMIT_WITH_MESSAGES = 10 // 包含消息时的最大页面大小
const MAX_MESSAGES_PER_CONVERSATION = 100 // 每个对话最多返回的消息数


// 获取对话列表（受保护）
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any })
    if (!token?.sub) return unauthorized('未认证')

    // 速率限制检查
    const rateLimitResult = await checkRateLimit(request, 'GENERAL', String(token.sub))
    if (!rateLimitResult.allowed) {
      return error(rateLimitResult.error?.message || '请求过于频繁', { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const includeMessages = searchParams.get('includeMessages') === 'true'

    // 参数校验（修复R3：DoS保护）
    if (page < 1) {
      return validationError('页码必须大于0')
    }

    if (limit < 1) {
      return validationError('页面大小必须大于0')
    }

    // 根据是否包含消息设置不同的限制
    const maxAllowedLimit = includeMessages ? MAX_LIMIT_WITH_MESSAGES : MAX_LIMIT
    if (limit > maxAllowedLimit) {
      return validationError(
        includeMessages
          ? `包含消息时页面大小不能超过${MAX_LIMIT_WITH_MESSAGES}`
          : `页面大小不能超过${MAX_LIMIT}`
      )
    }

    const skip = (page - 1) * limit

    // 优化查询：只获取必要字段，减少数据传输
    const conversations = await prisma.conversation.findMany({
      where: {
        userId: String(token.sub)
      },
      select: {
        id: true,
        title: true,
        modelId: true,
        temperature: true,
        maxTokens: true,
        contextAware: true,
        messageCount: true,
        totalTokens: true,
        metadata: true, // 修复：返回metadata字段（包含pinned、tags等）
        createdAt: true,
        updatedAt: true,
        lastMessageAt: true,
        // 根据includeMessages决定消息查询策略
        messages: includeMessages ? {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            promptTokens: true,
            completionTokens: true,
            modelId: true,
            createdAt: true,
          },
          // 严格限制消息数量
          take: MAX_MESSAGES_PER_CONVERSATION,
        } : {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          }
        },
      },
      orderBy: [
        { lastMessageAt: 'desc' },
        { createdAt: 'desc' }
      ],
      skip,
      take: limit,
    })

    // 获取总数 - 简化查询
    const total = await prisma.conversation.count({
      where: {
        userId: String(token.sub)
      }
    })

    // 映射响应数据 - 修复模型字段映射问题
    const conversationsWithCount = conversations.map((conv: any) => {
      const lastMessage = !includeMessages && conv.messages?.[0] ? conv.messages[0] : null

      // 映射消息字段（如果需要）
      const mappedMessages = includeMessages && conv.messages ? conv.messages.map((msg: any) => ({
        ...msg,
        model: msg.modelId, // 映射 modelId 到 model 字段
        timestamp: new Date(msg.createdAt).getTime(), // 映射 createdAt 到 timestamp (number)
        status: 'completed' as const, // 默认状态为已完成
        totalTokens: (msg.promptTokens || 0) + (msg.completionTokens || 0), // 修复字段名匹配
        metadata: {
          model: msg.modelId // 确保 metadata 中也有 model
        }
      })) : undefined

      return {
        ...conv,
        model: conv.modelId, // 映射 modelId 到 model 字段以匹配 TypeScript 类型
        lastMessage,
        messages: mappedMessages,
      }
    })

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
   console.error("处理请求失败", error)
    // error handled
    return serverError('获取对话列表失败')
  }
}

// 创建新对话（受保护）
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any })
    if (!token?.sub) return unauthorized('未认证')

    const userId = String(token.sub)

    // 速率限制检查
    const rateLimitResult = await checkRateLimit(request, 'GENERAL', userId)
    if (!rateLimitResult.allowed) {
      return error(rateLimitResult.error?.message || '请求过于频繁', { status: 429 })
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
      return notFound('用户不存在或已被删除')
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

    // 映射响应数据字段 - 修复模型字段映射问题
    const mappedConversation = {
      ...conversation,
      model: conversation.modelId, // 映射 modelId 到 model 字段以匹配 TypeScript 类型
    }

    return success(mappedConversation)
  } catch (error) {
   console.error("处理请求失败", error)
    // error handled
    return serverError('创建对话失败')
  }
}
