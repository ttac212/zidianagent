import { prisma } from '@/lib/prisma'
import { QuotaExceededError, QuotaManager } from '@/lib/security/quota-manager'
import * as dt from '@/lib/utils/date-toolkit'

export type AdjustQuotaStatus = 'success' | 'partial' | 'failed'

export interface AdjustQuotaInput {
  userId: string
  conversationId?: string
  estimatedTokens: number
  actualTokens: { promptTokens: number; completionTokens: number }
  modelId: string
  userMessage?: string
  assistantMessage?: string
  metadata?: {
    reasoning?: string
    reasoningEffort?: 'low' | 'medium' | 'high'
  }
}

export interface AdjustQuotaResult {
  status: AdjustQuotaStatus
  chargedTokens: number
  unchargedTokens?: number
  message?: string
  totalActualTokens: number
}

function toNumber(value: number | bigint | null | undefined, fallback = 0): number {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  return fallback
}

function buildMetadata(metadata: AdjustQuotaInput['metadata']): Record<string, any> | undefined {
  if (!metadata) return undefined
  const payload: Record<string, any> = {}

  if (metadata.reasoning) {
    payload.reasoning = metadata.reasoning
  }

  if (metadata.reasoningEffort) {
    payload.reasoningEffort = metadata.reasoningEffort
  }

  return Object.keys(payload).length > 0 ? payload : undefined
}

export async function adjustQuota(input: AdjustQuotaInput): Promise<AdjustQuotaResult> {
  const { userId, conversationId, estimatedTokens, actualTokens, modelId, userMessage, assistantMessage, metadata } = input

  const totalActualTokens = Math.max(0, Math.ceil(actualTokens.promptTokens + actualTokens.completionTokens))
  const adjustment = totalActualTokens - estimatedTokens
  const chargedTokens = estimatedTokens + Math.max(0, adjustment)

  if (estimatedTokens <= 0) {
    return {
      status: 'failed',
      chargedTokens: 0,
      totalActualTokens,
      message: '无效的预估token数量'
    }
  }

  const hasConversation = Boolean(conversationId)
  const metadataPayload = buildMetadata(metadata)

  try {
    if (hasConversation) {
      if (!userMessage || !assistantMessage) {
        return {
          status: 'failed',
          chargedTokens: 0,
          totalActualTokens,
          message: '缺少会话消息内容'
        }
      }

      await prisma.$transaction(async (tx) => {
        if (adjustment !== 0) {
          if (adjustment > 0) {
            const updateResult = await tx.$executeRaw`
              UPDATE users
              SET "currentMonthUsage" = "currentMonthUsage" + ${adjustment}
              WHERE id = ${userId}
              AND "currentMonthUsage" + ${adjustment} <= "monthlyTokenLimit"
            `

            if (updateResult === 0) {
              const user = await tx.user.findUnique({
                where: { id: userId },
                select: { currentMonthUsage: true, monthlyTokenLimit: true }
              })

              throw new QuotaExceededError(
                '月度配额不足',
                toNumber(user?.currentMonthUsage, 0),
                toNumber(user?.monthlyTokenLimit, 0),
                adjustment
              )
            }
          } else {
            const returnAmount = Math.abs(adjustment)
            const updateResult = await tx.$executeRaw`
              UPDATE users
              SET "currentMonthUsage" = "currentMonthUsage" - ${returnAmount}
              WHERE id = ${userId}
              AND "currentMonthUsage" >= ${returnAmount}
            `

            if (updateResult === 0) {
              throw new Error('配额返还失败')
            }
          }
        }

        await tx.message.create({
          data: {
            conversationId: conversationId!,
            userId,
            role: 'USER',
            content: userMessage,
            modelId,
            promptTokens: actualTokens.promptTokens,
            completionTokens: 0
          }
        })

        await tx.message.create({
          data: {
            conversationId: conversationId!,
            userId,
            role: 'ASSISTANT',
            content: assistantMessage,
            modelId,
            promptTokens: 0,
            completionTokens: actualTokens.completionTokens,
            metadata: metadataPayload
          }
        })

        await tx.conversation.update({
          where: { id: conversationId! },
          data: {
            lastMessageAt: dt.now(),
            messageCount: { increment: 2 },
            totalTokens: { increment: totalActualTokens }
          }
        })
      })

      return {
        status: 'success',
        chargedTokens,
        totalActualTokens
      }
    }

    if (adjustment > 0) {
      const result = await QuotaManager.reserveTokens(userId, adjustment)
      if (!result.success) {
        return {
          status: 'partial',
          chargedTokens: estimatedTokens,
          unchargedTokens: adjustment,
          totalActualTokens,
          message: '配额不足：实际用量超出预估且已达月度上限'
        }
      }
    } else if (adjustment < 0) {
      await QuotaManager.releaseTokens(userId, Math.abs(adjustment))
    }

    return {
      status: 'success',
      chargedTokens,
      totalActualTokens
    }
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return {
        status: 'partial',
        chargedTokens: estimatedTokens,
        unchargedTokens: Math.max(0, adjustment),
        totalActualTokens,
        message: error.message
      }
    }

    console.error('[QuotaAdjuster] 调整配额失败:', error)
    return {
      status: 'failed',
      chargedTokens: estimatedTokens,
      totalActualTokens,
      message: error instanceof Error ? error.message : '配额调整失败'
    }
  }
}
