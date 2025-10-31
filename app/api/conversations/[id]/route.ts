import { NextRequest } from "next/server"
import { prisma } from '@/lib/prisma'
import { getToken } from 'next-auth/jwt'
import { generateConversationTitle } from '@/lib/ai/title-generator'
import * as dt from '@/lib/utils/date-toolkit'
import {
  success,
  notFound,
  forbidden,
  unauthorized,
  serverError,
  validationError
} from '@/lib/api/http-response'
import { CHAT_HISTORY_CONFIG } from '@/lib/config/chat-config'

const MAX_MESSAGES_WINDOW = CHAT_HISTORY_CONFIG.maxWindow

function parseWindowSize(value: string | null) {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) {
    return NaN
  }
  return parsed
}

// 获取单个对话详情（包含消息，受保护）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request as any })
    if (!token?.sub) return unauthorized('未认证')
    
    const userId = String(token.sub)
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const includeMessages = searchParams.get('includeMessages') !== 'false'
    const takeParam = parseWindowSize(searchParams.get('take'))
    const beforeId = searchParams.get('beforeId') ?? undefined

    if (takeParam !== undefined) {
      if (Number.isNaN(takeParam)) {
        return validationError('take 参数必须是数字')
      }

      if (takeParam < 1) {
        return validationError('take 参数必须大于0')
      }

      if (takeParam > MAX_MESSAGES_WINDOW) {
        return validationError(`单次加载消息数量不能超过 ${MAX_MESSAGES_WINDOW}`)
      }
    }

    const windowSize = takeParam ?? (beforeId ? CHAT_HISTORY_CONFIG.initialWindow : undefined)
    let hasMoreBefore = false
    
    if (beforeId) {
      const messageExists = await prisma.message.findFirst({
        where: { id: beforeId, conversationId: id },
        select: { id: true }
      })

      if (!messageExists) {
        return validationError('无效的 beforeId 参数')
      }
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            status: true,
          }
        },
        messages: includeMessages ? {
          orderBy: [
            { createdAt: 'desc' as const },
            { id: 'desc' as const }
          ],
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
          },
          ...(windowSize ? { take: windowSize + 1 } : {}),
          ...(beforeId ? { cursor: { id: beforeId }, skip: 1 } : {})
        } : false,
        _count: {
          select: {
            messages: true
          }
        }
      }
    })
    
    if (!conversation) {
      return notFound('对话不存在')
    }
    
    // 验证用户权限
    if (conversation.userId !== userId) {
      return forbidden('无权限访问此对话')
    }
    
    // 检查用户状态
    if (conversation.user.status === 'DELETED') {
      return notFound('对话所属用户已被删除')
    }

    // 映射响应数据字段 - 修复模型字段映射问题
    let messages = conversation.messages as any[] | undefined

    if (includeMessages && messages) {
      if (windowSize && messages.length > windowSize) {
        hasMoreBefore = true
        messages = messages.slice(0, windowSize)
      }

      // 还原为按时间顺序排列
      messages = messages.slice().reverse()
    }

    const mappedConversation = {
      ...conversation,
      model: conversation.modelId, // 映射 modelId 到 model 字段以匹配 TypeScript 类型
      messages: messages ? messages.map((msg: any) => {
        const reasoning = (msg.metadata as any)?.reasoning || undefined
        const reasoningEffort = (msg.metadata as any)?.reasoningEffort || undefined

        return {
          ...msg,
          model: msg.modelId, // 映射消息中的 modelId 到 model 字段
          timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : dt.timestamp(), // 映射 createdAt 到 timestamp (number)
          status: 'completed' as const, // 默认状态为已完成（历史消息都是完成状态）
          totalTokens: (msg.promptTokens || 0) + (msg.completionTokens || 0), // 修复字段名匹配
          // ✅ 确保从metadata中读取reasoning
          reasoning: reasoning,
          metadata: {
            ...(typeof msg.metadata === 'object' && msg.metadata !== null ? msg.metadata : {}),
            model: msg.modelId, // 确保 metadata 中也有 model
            // ✅ 确保从metadata中读取reasoningEffort
            reasoningEffort: reasoningEffort
          }
        }
      }) : conversation.messages,
      messageCount: conversation._count.messages,
      messagesWindow: includeMessages ? {
        size: messages ? messages.length : 0,
        hasMoreBefore,
        oldestMessageId: messages && messages.length > 0 ? messages[0].id : null,
        newestMessageId: messages && messages.length > 0 ? messages[messages.length - 1].id : null,
        request: {
          take: windowSize ?? null,
          beforeId: beforeId ?? null
        }
      } : undefined
    }

    return success(mappedConversation)
  } catch (_error) {
    // error handled
    return serverError('获取对话详情失败')
  }
}

// 更新对话
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request as any })
    if (!token?.sub) return unauthorized('未认证')
    
    const userId = String(token.sub)
    const { id } = await params
    const body = await request.json()
    const { title, modelId, temperature, maxTokens, contextAware, metadata } = body
    
    // 检查对话是否存在并验证所有权
    const existingConversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, status: true }
        }
      }
    })
    
    if (!existingConversation) {
      return notFound('对话不存在')
    }
    
    // 验证用户权限
    if (existingConversation.userId !== userId) {
      return forbidden('无权限操作此对话')
    }
    
    if (existingConversation.user.status === 'DELETED') {
      return notFound('对话所属用户已被删除')
    }
    
    // 准备更新数据
    const updateData: any = {
      ...(title !== undefined && { title }),
      ...(modelId !== undefined && { modelId }),
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens !== undefined && { maxTokens }),
      ...(contextAware !== undefined && { contextAware }),
      // 修复：使用 merge 而非覆盖，避免破坏服务端字段（Never break userspace）
      ...(metadata !== undefined && {
        metadata: {
          // 类型安全的 merge：Prisma.JsonValue 需要类型断言
          ...(typeof existingConversation.metadata === 'object' && existingConversation.metadata !== null
            ? existingConversation.metadata as Record<string, any>
            : {}),
          ...metadata
        }
      }),
      updatedAt: dt.now(),
    }

    // 如果没有提供标题但是当前标题是默认值，尝试生成智能标题
    if (title === undefined && existingConversation.title === '新对话') {
      const firstMessage = await prisma.message.findFirst({
        where: {
          conversationId: id,
          role: 'USER'
        },
        orderBy: { createdAt: 'asc' },
        select: { content: true }
      })

      if (firstMessage) {
        updateData.title = generateConversationTitle(firstMessage.content)
      }
    }

    // 更新对话
    const updatedConversation = await prisma.conversation.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          }
        },
        // 【关键修复】返回完整对话数据，包括最后一条消息用于侧栏显示
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          }
        },
        _count: {
          select: {
            messages: true
          }
        }
      }
    })

    // 计算总token数（简单求和，避免全表扫描）
    const totalTokensResult = await prisma.message.aggregate({
      where: { conversationId: id },
      _sum: {
        promptTokens: true,
        completionTokens: true,
      }
    })

    const totalTokens = (totalTokensResult._sum.promptTokens || 0) + (totalTokensResult._sum.completionTokens || 0)
    const lastMessage = updatedConversation.messages[0]

    // 映射响应数据字段 - 返回完整对话契约，防止缓存污染
    const mappedConversation = {
      ...updatedConversation,
      modelId: updatedConversation.modelId, // 保留原始字段
      messageCount: updatedConversation._count.messages,
      totalTokens,
      lastMessage: lastMessage ? {
        id: lastMessage.id,
        role: lastMessage.role,
        content: lastMessage.content,
        createdAt: lastMessage.createdAt.toISOString()
      } : null,
      messages: undefined, // 移除消息列表，PATCH只返回元数据
      _count: undefined,   // 清理内部字段
      user: undefined      // 清理敏感字段
    }

    return success(mappedConversation)
  } catch (_error) {
    // error handled
    return serverError('更新对话失败')
  }
}

// 删除对话
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request as any })
    if (!token?.sub) return unauthorized('未认证')
    
    const userId = String(token.sub)
    const { id } = await params
    
    // 检查对话是否存在并验证所有权
    const existingConversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, status: true }
        }
      }
    })
    
    if (!existingConversation) {
      return notFound('对话不存在')
    }
    
    // 验证用户权限
    if (existingConversation.userId !== userId) {
      return forbidden('无权限操作此对话')
    }
    
    // 删除对话（级联删除消息）
    await prisma.conversation.delete({
      where: { id }
    })
    
    return success({ message: '对话删除成功' })
  } catch (_error) {
    // error handled
    return serverError('删除对话失败')
  }
}
