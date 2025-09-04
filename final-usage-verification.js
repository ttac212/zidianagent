// 完整验证使用量记录和显示流程
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function verifyCompleteUsageFlow() {
  try {
    // 1. 模拟新对话后的记录状态检查
    const activeUsers = await prisma.user.findMany({
      where: {
        OR: [
          { currentMonthUsage: { gt: 0 } },
          { conversations: { some: {} } }
        ]
      },
      include: {
        conversations: {
          take: 1,
          orderBy: { updatedAt: 'desc' }
        },
        usageStats: {
          where: {
            date: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 最近7天
            }
          },
          orderBy: { date: 'desc' }
        }
      }
    })

    for (const user of activeUsers) {
      // 分析该用户的使用量统计
      const totalStats = user.usageStats.filter(s => !s.modelId)
      const modelStats = user.usageStats.filter(s => s.modelId)
      
      if (modelStats.length > 0) {
        const modelGroups = {}
        modelStats.forEach(stat => {
          if (!modelGroups[stat.modelId]) {
            modelGroups[stat.modelId] = { tokens: 0, calls: 0, provider: stat.modelProvider }
          }
          modelGroups[stat.modelId].tokens += stat.totalTokens
          modelGroups[stat.modelId].calls += stat.apiCalls
        })
        
        Object.entries(modelGroups).forEach(([modelId, data]) => {
          : ${data.tokens}tokens, ${data.calls}次调用`)
        })
      } else {
        }
    }

    // 2. 验证settings页面API需要的数据格式
    if (activeUsers.length > 0) {
      const testUser = activeUsers[0]
      const userId = testUser.id
      const days = 30
      
      // 模拟 /api/users/[id]/model-stats 的查询逻辑
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      startDate.setUTCHours(0, 0, 0, 0)

      const usageStats = await prisma.usageStats.findMany({
        where: {
          userId,
          date: { gte: startDate }
        },
        select: {
          date: true,
          modelId: true,
          modelProvider: true,
          totalTokens: true,
          apiCalls: true,
          promptTokens: true,
          completionTokens: true,
        },
        orderBy: { date: 'desc' }
      })

      const totalStats = usageStats.filter(stat => !stat.modelId)
      const modelStats = usageStats.filter(stat => stat.modelId)

      const totalTokens = totalStats.reduce((sum, stat) => sum + stat.totalTokens, 0)
      const totalRequests = totalStats.reduce((sum, stat) => sum + stat.apiCalls, 0)

      :`);
      if (modelStats.length > 0) {
        // 模拟前端需要的模型统计格式
        const modelAggregated = {}
        modelStats.forEach(stat => {
          if (!modelAggregated[stat.modelId]) {
            modelAggregated[stat.modelId] = {
              totalTokens: 0,
              requests: 0,
              provider: stat.modelProvider || 'Unknown'
            }
          }
          modelAggregated[stat.modelId].totalTokens += stat.totalTokens
          modelAggregated[stat.modelId].requests += stat.apiCalls
        })

        Object.entries(modelAggregated).forEach(([modelId, data]) => {
          const percentage = totalTokens > 0 ? ((data.totalTokens / totalTokens) * 100).toFixed(1) : 0
          ${data.requests}次`)
        })
        
        } else {
        }
    }

    // 3. 健康检查总结
    const totalUsersWithStats = await prisma.user.count({
      where: {
        usageStats: { some: {} }
      }
    })

    const totalModelStatsToday = await prisma.usageStats.count({
      where: {
        modelId: { not: null },
        date: {
          gte: new Date(new Date().setUTCHours(0, 0, 0, 0))
        }
      }
    })

    const totalStatsToday = await prisma.usageStats.count({
      where: {
        date: {
          gte: new Date(new Date().setUTCHours(0, 0, 0, 0))
        }
      }
    })

    if (totalModelStatsToday > 0) {
      } else {
      }

  } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

verifyCompleteUsageFlow().catch(console.error)