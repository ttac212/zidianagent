/**
 * Message Repository - 简单的消息持久化
 * 
 * Linus原则：做一件事，做好它
 */

import { prisma } from '@/lib/prisma'
import * as dt from '@/lib/utils/date-toolkit'

export interface MessageData {
  conversationId: string
  userId: string
  role: 'USER' | 'ASSISTANT'
  content: string
  modelId: string
  promptTokens: number
  completionTokens: number
}

/**
 * 保存消息并更新对话统计
 * 使用单个事务确保原子性
 */
export async function saveMessage(data: MessageData): Promise<boolean> {
  try {
    const totalTokens = data.promptTokens + data.completionTokens

    await prisma.$transaction(async (tx) => {
      // 1. 创建消息记录
      await tx.message.create({
        data: {
          conversationId: data.conversationId,
          userId: data.userId,
          role: data.role,
          content: data.content,
          modelId: data.modelId,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens
        }
      })

      // 2. 更新对话统计（冗余存储，优化查询性能）
      await tx.conversation.update({
        where: { id: data.conversationId },
        data: {
          lastMessageAt: dt.now(),
          messageCount: { increment: 1 },
          totalTokens: { increment: totalTokens }
        }
      })
    })

    return true
  } catch (error) {
    console.error('[MessageRepository] Save message failed:', error)
    return false
  }
}

/**
 * 批量保存消息（用于导入场景）
 */
export async function saveMessages(messages: MessageData[]): Promise<number> {
  if (messages.length === 0) return 0

  try {
    let successCount = 0

    for (const message of messages) {
      const success = await saveMessage(message)
      if (success) successCount++
    }

    return successCount
  } catch (error) {
    console.error('[MessageRepository] Batch save failed:', error)
    return 0
  }
}
