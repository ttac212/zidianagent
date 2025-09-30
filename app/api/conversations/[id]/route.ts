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
  serverError
} from '@/lib/api/http-response'


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
    const mappedConversation = {
      ...conversation,
      model: conversation.modelId, // 映射 modelId 到 model 字段以匹配 TypeScript 类型
      messages: conversation.messages ? conversation.messages.map((msg: any) => ({
        ...msg,
        model: msg.modelId, // 映射消息中的 modelId 到 model 字段
        totalTokens: (msg.promptTokens || 0) + (msg.completionTokens || 0) // 修复字段名匹配
      })) : conversation.messages,
      messageCount: conversation._count.messages,
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
      ...(metadata !== undefined && { metadata }),
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
        }
      }
    })

    // 映射响应数据字段 - 修复模型字段映射问题
    const mappedConversation = {
      ...updatedConversation,
      model: updatedConversation.modelId, // 映射 modelId 到 model 字段以匹配 TypeScript 类型
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