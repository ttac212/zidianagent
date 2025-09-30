/**
 * 回填对话表的 lastMessageAt 字段
 * 解决索引 @@index([userId, lastMessageAt desc]) 对现有数据的影响
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backfillLastMessageAt() {
  try {
    console.info('🚀 开始回填 lastMessageAt 字段...')

    // 1. 先统计需要回填的数据量
    const totalCount = await prisma.conversation.count({
      where: { lastMessageAt: null }
    })

    console.info(`📊 找到 ${totalCount} 个需要回填的对话`)

    if (totalCount === 0) {
      console.info('🎉 所有对话的 lastMessageAt 已填充完毕！')
      return
    }

    let updatedCount = 0
    let skippedCount = 0
    const BATCH_SIZE = 500  // 每批处理500个对话
    let skip = 0

    // 2. 分页批量处理，避免内存溢出
    while (skip < totalCount) {
      console.info(`🔄 处理批次 ${Math.floor(skip / BATCH_SIZE) + 1}/${Math.ceil(totalCount / BATCH_SIZE)} (${skip + 1}-${Math.min(skip + BATCH_SIZE, totalCount)})`)

      // 批量获取对话ID（不包含消息数据）
      const conversationBatch = await prisma.conversation.findMany({
        where: { lastMessageAt: null },
        select: { id: true, createdAt: true, updatedAt: true },
        take: BATCH_SIZE,
        skip
      })

      if (conversationBatch.length === 0) break

      // 使用事务批量处理这一批对话
      await prisma.$transaction(async (tx) => {
        for (const conversation of conversationBatch) {
          try {
            // 查找最后一条消息（只查这一个对话的）
            const lastMessage = await tx.message.findFirst({
              where: { conversationId: conversation.id },
              orderBy: { createdAt: 'desc' },
              select: { createdAt: true }
            })

            const newLastMessageAt = lastMessage
              ? lastMessage.createdAt
              : (conversation.updatedAt || conversation.createdAt)

            // 计算对话的总token消耗（聚合所有消息的token）
            const tokenStats = await tx.message.aggregate({
              where: { conversationId: conversation.id },
              _sum: {
                promptTokens: true,
                completionTokens: true
              },
              _count: true
            })

            const totalTokens = (tokenStats._sum.promptTokens || 0) + (tokenStats._sum.completionTokens || 0)
            const messageCount = tokenStats._count

            // 更新对话统计（包含历史token计算）
            await tx.conversation.update({
              where: { id: conversation.id },
              data: {
                lastMessageAt: newLastMessageAt,
                messageCount,
                totalTokens  // 修复历史数据的token统计
              }
            })

            updatedCount++
          } catch (error) {
            console.error(`❌ 更新对话 ${conversation.id} 失败:`, error)
            skippedCount++
          }
        }
      })

      skip += BATCH_SIZE
      console.info(`✅ 批次完成，已处理 ${Math.min(skip, totalCount)}/${totalCount} 个对话`)
    }

    console.info(`✅ 回填完成！`)
    console.info(`   - 成功更新: ${updatedCount} 个对话`)
    console.info(`   - 跳过失败: ${skippedCount} 个对话`)

    // 3. 验证结果
    const nullCount = await prisma.conversation.count({
      where: { lastMessageAt: null }
    })

    console.info(`📊 验证结果: ${nullCount} 个对话的 lastMessageAt 仍为空`)

    if (nullCount === 0) {
      console.info('🎉 所有对话的 lastMessageAt 字段已成功回填！')
    }

  } catch (error) {
    console.error('❌ 回填过程中发生错误:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 执行回填
if (require.main === module) {
  backfillLastMessageAt()
    .catch(console.error)
}

export { backfillLastMessageAt }