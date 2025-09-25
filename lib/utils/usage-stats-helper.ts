/**
 * 使用量统计辅助函数
 * 简单、优雅、无副作用
 */

import { PrismaClient } from '@prisma/client'

interface UsageRecord {
  userId: string
  modelId: string
  modelProvider?: string | null
  promptTokens?: number
  completionTokens?: number
  messagesCreated?: number
  success?: boolean
}

/**
 * 异步记录使用量统计（发送即忘）
 * 不阻塞主流程，失败不影响用户体验
 */
export function recordUsageAsync(
  prisma: PrismaClient,
  record: UsageRecord
): void {
  // 使用 Promise 异步执行，不等待结果
  Promise.resolve().then(async () => {
    try {
      await recordUsageInternal(prisma, record)
    } catch (error) {
      // 记录但不抛出错误，避免影响主流程
      if (process.env.NODE_ENV === 'development') {
        // Usage stats recording failed - logged in development
      }
      // 生产环境静默处理，确保用户体验不受影响
    }
  })
}

/**
 * 内部记录函数（增强版 - 解决外键约束问题）
 */
async function recordUsageInternal(
  prisma: PrismaClient,
  record: UsageRecord
): Promise<void> {
  const today = getTodayUTC()
  
  // 关键修复：先验证用户存在，避免外键约束违反
  const userExists = await prisma.user.findUnique({
    where: { id: record.userId },
    select: { id: true }
  })
  
  if (!userExists) {
    if (process.env.NODE_ENV === 'development') {
      // User not found - skipped in development
    }
    return // 静默跳过，不影响主流程
  }

  // 使用优化的事务配置和错误处理
  await prisma.$transaction(
    [
      // 1. 更新总量统计
      prisma.usageStats.upsert({
        where: {
          userId_date_modelId: {
            userId: record.userId,
            date: today,
            modelId: "_total"
          }
        },
        update: {
          apiCalls: { increment: 1 },
          successfulCalls: record.success ? { increment: 1 } : undefined,
          failedCalls: !record.success ? { increment: 1 } : undefined,
          promptTokens: record.promptTokens ? { increment: record.promptTokens } : undefined,
          completionTokens: record.completionTokens ? { increment: record.completionTokens } : undefined,
          messagesCreated: record.messagesCreated ? { increment: record.messagesCreated } : undefined,
          updatedAt: new Date(),
        },
        create: {
          userId: record.userId,
          date: today,
          modelId: "_total",
          apiCalls: 1,
          successfulCalls: record.success ? 1 : 0,
          failedCalls: !record.success ? 1 : 0,
          promptTokens: record.promptTokens || 0,
          completionTokens: record.completionTokens || 0,
          messagesCreated: record.messagesCreated || 0,
        }
      }),
      
      // 2. 更新按模型统计
      prisma.usageStats.upsert({
        where: {
          userId_date_modelId: {
            userId: record.userId,
            date: today,
            modelId: record.modelId
          }
        },
        update: {
          apiCalls: { increment: 1 },
          successfulCalls: record.success ? { increment: 1 } : undefined,
          failedCalls: !record.success ? { increment: 1 } : undefined,
          promptTokens: record.promptTokens ? { increment: record.promptTokens } : undefined,
          completionTokens: record.completionTokens ? { increment: record.completionTokens } : undefined,
          messagesCreated: record.messagesCreated ? { increment: record.messagesCreated } : undefined,
          updatedAt: new Date(),
        },
        create: {
          userId: record.userId,
          date: today,
          modelId: record.modelId,
          modelProvider: record.modelProvider,
          apiCalls: 1,
          successfulCalls: record.success ? 1 : 0,
          failedCalls: !record.success ? 1 : 0,
          promptTokens: record.promptTokens || 0,
          completionTokens: record.completionTokens || 0,
          messagesCreated: record.messagesCreated || 0,
        }
      })
    ]
  )
}

/**
 * 获取UTC日期（0点）
 */
function getTodayUTC(): Date {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return today
}

export type { UsageRecord }