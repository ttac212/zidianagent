// 测试使用量记录机制
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testUsageRecording() {
  try {
    // 1. 检查UsageStats表结构
    const sampleStats = await prisma.usageStats.findFirst({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            currentMonthUsage: true,
            totalTokenUsed: true
          }
        }
      }
    })
    
    if (sampleStats) {
      .split('T')[0]}`)
      '}`)
      } else {
      }

    // 2. 检查按模型分组的统计
    const modelStats = await prisma.usageStats.findMany({
      where: {
        modelId: {
          not: null
        }
      },
      orderBy: [
        { date: 'desc' },
        { totalTokens: 'desc' }
      ],
      take: 5,
      include: {
        user: {
          select: { email: true }
        }
      }
    })

    if (modelStats.length > 0) {
      modelStats.forEach((stat, index) => {
        .split('T')[0]}`)
        `)
        `)
      })
      } else {
      }

    // 3. 检查Message表中的token记录
    const messages = await prisma.message.findMany({
      where: {
        totalTokens: {
          gt: 0
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
      include: {
        conversation: {
          select: {
            user: {
              select: { email: true }
            }
          }
        }
      }
    })

    if (messages.length > 0) {
      messages.forEach((msg, index) => {
        `)
        }`)
      })
      } else {
      }

    // 4. 汇总报告
    const totalUsers = await prisma.user.count()
    const totalConversations = await prisma.conversation.count()
    const totalMessages = await prisma.message.count()
    const totalUsageStats = await prisma.usageStats.count()
    const statsWithModels = await prisma.usageStats.count({
      where: { modelId: { not: null } }
    })

    // 5. 验证数据一致性
    const usersWithUsage = await prisma.user.findMany({
      where: {
        OR: [
          { currentMonthUsage: { gt: 0 } },
          { totalTokenUsed: { gt: 0 } }
        ]
      },
      select: {
        email: true,
        currentMonthUsage: true,
        totalTokenUsed: true
      }
    })

    if (usersWithUsage.length > 0) {
      usersWithUsage.forEach(user => {
        })
    } else {
      }

    } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

testUsageRecording().catch(console.error)