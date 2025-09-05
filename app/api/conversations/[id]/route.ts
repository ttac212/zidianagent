import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getToken } from 'next-auth/jwt'

// 获取单个对话详情（包含消息，受保护）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request as any })
    if (!token?.sub) return NextResponse.json({ error: '未认证' }, { status: 401 })
    
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
            totalTokens: true,
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
      return NextResponse.json(
        { error: '对话不存在' },
        { status: 404 }
      )
    }
    
    // 验证用户权限
    if (conversation.userId !== userId) {
      return NextResponse.json(
        { error: '无权限访问此对话' },
        { status: 403 }
      )
    }
    
    // 检查用户状态
    if (conversation.user.status === 'DELETED') {
      return NextResponse.json(
        { error: '对话所属用户已被删除' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: conversation
    })
  } catch (error) {
    void error
    return NextResponse.json(
      { error: '获取对话详情失败' },
      { status: 500 }
    )
  }
}

// 更新对话
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request as any })
    if (!token?.sub) return NextResponse.json({ error: '未认证' }, { status: 401 })
    
    const userId = String(token.sub)
    const { id } = await params
    const body = await request.json()
    const { title, modelId, temperature, maxTokens, contextAware } = body
    
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
      return NextResponse.json(
        { error: '对话不存在' },
        { status: 404 }
      )
    }
    
    // 验证用户权限
    if (existingConversation.userId !== userId) {
      return NextResponse.json(
        { error: '无权限操作此对话' },
        { status: 403 }
      )
    }
    
    if (existingConversation.user.status === 'DELETED') {
      return NextResponse.json(
        { error: '对话所属用户已被删除' },
        { status: 404 }
      )
    }
    
    // 更新对话
    const updatedConversation = await prisma.conversation.update({
      where: { id },
      data: {
        title,
        modelId,
        temperature,
        maxTokens,
        contextAware,
        updatedAt: new Date(),
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
      data: updatedConversation,
      message: '对话更新成功'
    })
  } catch (error) {
    void error
    return NextResponse.json(
      { error: '更新对话失败' },
      { status: 500 }
    )
  }
}

// 删除对话
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ req: request as any })
    if (!token?.sub) return NextResponse.json({ error: '未认证' }, { status: 401 })
    
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
      return NextResponse.json(
        { error: '对话不存在' },
        { status: 404 }
      )
    }
    
    // 验证用户权限
    if (existingConversation.userId !== userId) {
      return NextResponse.json(
        { error: '无权限操作此对话' },
        { status: 403 }
      )
    }
    
    // 删除对话（级联删除消息）
    await prisma.conversation.delete({
      where: { id }
    })
    
    return NextResponse.json({
      success: true,
      message: '对话删除成功'
    })
  } catch (error) {
    void error
    return NextResponse.json(
      { error: '删除对话失败' },
      { status: 500 }
    )
  }
}