/**
 * 专门修复对话统计字段不一致的脚本
 * 修复totalTokens和messageCount
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixConversationStats() {
  try {
    console.log('🚀 开始修复对话统计字段...')

    // 1. 查找所有有消息但统计可能不准确的对话
    const allConversationsWithMessages = await prisma.conversation.findMany({
      where: {
        messages: {
          some: {}
        }
      },
      select: {
        id: true,
        messageCount: true,
        totalTokens: true,
        title: true
      }
    })

    console.log(`📊 找到 ${allConversationsWithMessages.length} 个有消息的对话`)

    let fixedCount = 0
    let skippedCount = 0
    const BATCH_SIZE = 100

    // 2. 分批处理所有有消息的对话
    for (let i = 0; i < allConversationsWithMessages.length; i += BATCH_SIZE) {
      const batch = allConversationsWithMessages.slice(i, i + BATCH_SIZE)
      console.log(`🔄 处理批次 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allConversationsWithMessages.length / BATCH_SIZE)}`)

      await prisma.$transaction(async (tx) => {
        for (const conversation of batch) {
          try {
            // 计算实际的统计数据
            const stats = await tx.message.aggregate({
              where: { conversationId: conversation.id },
              _sum: {
                promptTokens: true,
                completionTokens: true
              },
              _count: true
            })

            const actualTotalTokens = (stats._sum.promptTokens || 0) + (stats._sum.completionTokens || 0)
            const actualMessageCount = stats._count

            // 检查是否需要更新
            const needsUpdate =
              conversation.totalTokens !== actualTotalTokens ||
              conversation.messageCount !== actualMessageCount

            if (needsUpdate) {
              await tx.conversation.update({
                where: { id: conversation.id },
                data: {
                  totalTokens: actualTotalTokens,
                  messageCount: actualMessageCount
                }
              })

              console.log(`  ✅ 修复对话 "${conversation.title}": tokens ${conversation.totalTokens}→${actualTotalTokens}, 消息数 ${conversation.messageCount}→${actualMessageCount}`)
              fixedCount++
            } else {
              skippedCount++
            }

          } catch (error) {
            console.error(`❌ 处理对话 ${conversation.id} 失败:`, error)
          }
        }
      })

      // 显示进度
      if (i % (BATCH_SIZE * 5) === 0) {
        console.log(`📈 进度: 已处理 ${Math.min(i + BATCH_SIZE, allConversationsWithMessages.length)}/${allConversationsWithMessages.length} 个对话`)
      }
    }

    console.log('\n✅ 统计字段修复完成！')
    console.log(`   - 成功修复: ${fixedCount} 个对话`)
    console.log(`   - 无需修复: ${skippedCount} 个对话`)

    // 3. 最终验证
    console.log('\n🔍 最终验证...')

    const brokenTokens = await prisma.conversation.count({
      where: {
        totalTokens: 0,
        messages: {
          some: {
            OR: [
              { promptTokens: { gt: 0 } },
              { completionTokens: { gt: 0 } }
            ]
          }
        }
      }
    })

    const brokenCounts = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM conversations c
      WHERE c.messageCount != (
        SELECT COUNT(*) FROM messages m WHERE m.conversationId = c.id
      );
    `

    console.log(`   - totalTokens仍有问题: ${brokenTokens} 个`)
    console.log(`   - messageCount仍有问题: ${(brokenCounts as any)[0]?.count || 0} 个`)

    if (brokenTokens === 0 && (brokenCounts as any)[0]?.count === 0) {
      console.log('\n🎉 所有统计数据已修复完毕！')
    }

  } catch (error) {
    console.error('❌ 修复过程中发生错误:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 执行修复
if (require.main === module) {
  fixConversationStats()
    .catch(console.error)
}

export { fixConversationStats }