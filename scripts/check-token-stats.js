/**
 * 检查totalTokens统计的准确性
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkTokenStats() {
  console.info('🔍 检查对话token统计准确性...')

  try {
    // 1. 找出totalTokens为0但有消息的对话
    const conversationsWithMessages = await prisma.conversation.findMany({
      where: {
        totalTokens: 0,
        messages: {
          some: {}
        }
      },
      include: {
        _count: {
          select: { messages: true }
        },
        messages: {
          select: {
            promptTokens: true,
            completionTokens: true
          }
        }
      },
      take: 10
    })

    console.info(`\n📊 发现 ${conversationsWithMessages.length} 个对话的totalTokens为0但有消息`)

    if (conversationsWithMessages.length > 0) {
      console.info('\n🔍 样本分析:')
      for (const conv of conversationsWithMessages.slice(0, 5)) {
        const actualTokens = conv.messages.reduce((sum, msg) =>
          sum + (msg.promptTokens || 0) + (msg.completionTokens || 0), 0
        )
        console.info(`  - 对话 ${conv.id}: ${conv.messages.length}条消息, 实际tokens: ${actualTokens}, 记录: ${conv.totalTokens}`)
      }
    }

    // 2. 统计需要修复的总量
    const totalBrokenConversations = await prisma.conversation.count({
      where: {
        totalTokens: 0,
        messages: {
          some: {}
        }
      }
    })

    // 3. 检查messageCount准确性
    const conversationsWithWrongCount = await prisma.conversation.findMany({
      where: {
        messages: {
          some: {}
        }
      },
      include: {
        _count: {
          select: { messages: true }
        }
      },
      take: 5
    })

    let countMismatches = 0
    for (const conv of conversationsWithWrongCount) {
      if (conv.messageCount !== conv._count.messages) {
        countMismatches++
      }
    }

    console.info(`\n📈 统计结果:`)
    console.info(`  - 需要修复totalTokens的对话: ${totalBrokenConversations} 个`)
    console.info(`  - messageCount不匹配的对话: ${countMismatches} 个（样本）`)

    if (totalBrokenConversations > 0) {
      console.info('\n💡 建议运行: npx tsx scripts/backfill-last-message-at.ts')
    } else {
      console.info('\n✅ 所有统计数据都准确！')
    }

  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkTokenStats()