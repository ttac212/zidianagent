/**
 * 诊断使用量统计问题
 */

import { prisma } from '../lib/prisma'

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

async function diagnoseUsageStats() {
  try {
    // 1. 检查UsageStats表中的数据
    const totalRecords = await prisma.usageStats.count()
    const totalOnlyRecords = await prisma.usageStats.count({
      where: { modelId: "_total" }
    })
    const nullModelRecords = await prisma.usageStats.count({
      where: { modelId: null }
    })
    const modelSpecificRecords = await prisma.usageStats.count({
      where: {
        AND: [
          { modelId: { not: null } },
          { modelId: { not: "_total" } }
        ]
      }
    })
    // 2. 查看最近的记录
    const recentRecords = await prisma.usageStats.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        date: true,
        modelId: true,
        modelProvider: true,
        totalTokens: true,
        apiCalls: true,
        createdAt: true
      }
    })
    
    for (const record of recentRecords) {
      }]`)
      }
    
    // 3. 检查Message表的token记录
    const messagesWithTokens = await prisma.message.count({
      where: {
        totalTokens: { gt: 0 }
      }
    })
    const messagesWithoutTokens = await prisma.message.count({
      where: {
        OR: [
          { totalTokens: 0 },
          { totalTokens: null }
        ]
      }
    })
    // 4. 查看最近的AI消息
    const recentAIMessages = await prisma.message.findMany({
      where: { role: 'ASSISTANT' },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        modelId: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        createdAt: true
      }
    })
    
    for (const msg of recentAIMessages) {
      }]`)
      }
    
    // 5. 用户使用量统计
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        currentMonthUsage: true,
        totalTokenUsed: true,
        monthlyTokenLimit: true
      }
    })
    
    for (const user of users) {
      const percentage = (user.currentMonthUsage / user.monthlyTokenLimit * 100).toFixed(2)
      }
    
    // 6. 诊断结论
    if (totalRecords === 0) {
      } else if (modelSpecificRecords === 0) {
      } else if (messagesWithTokens === 0) {
      } else {
      }
    
    // 建议
    函数返回的日期格式')
    
  } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

// 运行诊断
if (require.main === module) {
  diagnoseUsageStats()
    .catch(console.error)
    .finally(() => process.exit(0))
}

export { diagnoseUsageStats }