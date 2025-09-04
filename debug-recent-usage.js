// 调试最近对话的使用量记录问题
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function debugRecentUsage() {
  try {
    // 1. 检查最近的对话和消息
    const recentConversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 3,
      include: {
        user: {
          select: { email: true, currentMonthUsage: true, totalTokenUsed: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            role: true,
            modelId: true,
            totalTokens: true,
            promptTokens: true,
            completionTokens: true,
            createdAt: true,
            content: true
          }
        }
      }
    })

    if (recentConversations.length > 0) {
      recentConversations.forEach((conv, index) => {
        }`)
        }`)
        if (conv.messages.length > 0) {
          conv.messages.forEach((msg, msgIndex) => {
            const preview = msg.content.slice(0, 50) + (msg.content.length > 50 ? '...' : '')
            })
        }
      })
    } else {
      }

    // 2. 检查最近的使用量统计
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const recentStats = await prisma.usageStats.findMany({
      where: {
        date: {
          gte: yesterday
        }
      },
      orderBy: [
        { date: 'desc' },
        { updatedAt: 'desc' }
      ],
      take: 10,
      include: {
        user: {
          select: { email: true }
        }
      }
    })

    if (recentStats.length > 0) {
      recentStats.forEach((stat, index) => {
        .split('T')[0]}`)
        '}`)
        `)
        `)
        }`)
      })
    } else {
      }

    // 3. 按用户分析使用量差异
    const usersWithActivity = await prisma.user.findMany({
      where: {
        OR: [
          { conversations: { some: {} } },
          { usageStats: { some: {} } }
        ]
      },
      select: {
        id: true,
        email: true,
        currentMonthUsage: true,
        totalTokenUsed: true,
        updatedAt: true
      }
    })

    for (const user of usersWithActivity) {
      // 计算Message表中该用户的总token使用量
      const messageTokens = await prisma.message.aggregate({
        where: {
          conversation: {
            userId: user.id
          },
          role: 'ASSISTANT' // 只统计AI回复的token
        },
        _sum: {
          totalTokens: true,
          promptTokens: true,
          completionTokens: true
        }
      })

      // 计算UsageStats表中该用户的总token使用量
      const statsTokens = await prisma.usageStats.aggregate({
        where: {
          userId: user.id
        },
        _sum: {
          totalTokens: true
        }
      })

      }`)

      // 检查数据一致性
      const msgTotal = messageTokens._sum.totalTokens || 0
      const userTotal = user.totalTokenUsed
      if (Math.abs(msgTotal - userTotal) > 10) { // 允许10tokens的误差
        }`)
      }
    }

    // 4. 检查今天是否有按模型的统计记录
    const todayModelStats = await prisma.usageStats.findMany({
      where: {
        date: today,
        modelId: {
          not: null
        }
      },
      include: {
        user: {
          select: { email: true }
        }
      }
    })

    if (todayModelStats.length > 0) {
      todayModelStats.forEach(stat => {
        })
    } else {
      }

    } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

debugRecentUsage().catch(console.error)