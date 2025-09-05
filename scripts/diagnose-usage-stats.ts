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
        createdAt: true,
        user: {
          select: {
            email: true
          }
        }
      }
    })
    
    for (const record of recentRecords) {
      console.log(`  用户: ${record.user.email}, 模型: ${record.modelId}, 日期: ${record.date}, tokens: ${record.totalTokens}`)
    }
    
    // 3. 检查Message表的token记录
    const messagesWithTokens = await prisma.message.count({
      where: {
        totalTokens: { gt: 0 }
      }
    })
    const messagesWithoutTokens = await prisma.message.count({
      where: {
        totalTokens: {
          lte: 0
        }
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
        createdAt: true,
        conversation: {
          select: {
            title: true
          }
        }
      }
    })
    
    for (const msg of recentAIMessages) {
      console.log(`  对话: ${msg.conversation.title}, tokens: ${msg.totalTokens}, 创建时间: ${msg.createdAt}`)
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
      console.log(`  用户: ${user.email}, 本月使用: ${user.currentMonthUsage}/${user.monthlyTokenLimit} (${percentage}%)`)
    }
    
    // 6. 诊断结论
    if (totalRecords === 0) {
      console.log('没有使用量统计记录，可能是统计功能未启用')
    } else if (modelSpecificRecords === 0) {
      console.log('没有按模型的统计记录，只有总量统计')
      } else if (messagesWithTokens === 0) {
        console.log('没有Message记录token信息，请检查聊天API是否正确记录token')
      } else {
        console.log('Message表token记录正常')
      }
    
    console.log(`\n总用户数: ${users.length}`)
    console.log('👆 以上是使用量统计诊断结果')
    console.log('\n建议:')
    console.log('- 检查日期格式是否一致')
    console.log('- 验证token统计流程')
    console.log('- 确认数据库约束正确')
    
  } catch (error) {
    console.error('诊断使用量统计时出错:', error)
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