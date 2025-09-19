/**
 * 修复使用量追踪问题
 * 
 * 问题分析：
 * 1. SSE流中的usage信息可能在最后一个chunk，但没有正确捕获
 * 2. saveAssistantMessage是异步的但没有await
 * 3. 数据库中modelId有混合状态（null和"_total"）
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

async function fixUsageTracking() {
  try {
    // 1. 清理混合数据
    // 将所有null的modelId改为"_total"
    const updateResult = await prisma.usageStats.updateMany({
      where: { modelId: null },
      data: { modelId: "_total" }
    })
    // 2. 检查Message表中没有token的记录
    const messagesWithoutTokens = await prisma.message.findMany({
      where: {
        role: 'ASSISTANT',
        totalTokens: 0
      },
      select: {
        id: true,
        modelId: true,
        content: true,
        createdAt: true
      },
      take: 5,
      orderBy: { createdAt: 'desc' }
    })
    
    for (const msg of messagesWithoutTokens) {
      const contentLength = msg.content?.length || 0
      const estimatedTokens = Math.ceil(contentLength / 4) // 粗略估算
      }
    
    // 3. 检查用户使用量是否匹配
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        currentMonthUsage: true,
        totalTokenUsed: true
      }
    })
    
    for (const user of users) {
      // 计算实际使用量（从Message表）
      const actualUsage = await prisma.message.aggregate({
        where: {
          conversation: {
            userId: user.id
          }
        },
        _sum: {
          totalTokens: true
        }
      })
      
      const actual = actualUsage._sum.totalTokens || 0
      const recorded = user.totalTokenUsed
      const diff = Math.abs(actual - recorded)
      
      if (diff > 100) {
        console.log(`${colors.red}用户 ${user.id} 使用量不匹配: 实际=${actual}, 记录=${recorded}, 差异=${diff}${colors.reset}`)
      } else {
        console.log(`${colors.green}用户 ${user.id} 使用量正常: ${actual}${colors.reset}`)
      }
    }
    
    // 4. 生成修复建议
    console.log(`\n${colors.yellow}修复建议: 运行使用量同步脚本${colors.reset}`)
    } catch (error) {
      console.error('修复使用量统计时出错:', error)
    } finally {
    await prisma.$disconnect()
  }
}

// 运行修复
if (require.main === module) {
  fixUsageTracking()
    .catch(console.error)
    .finally(() => process.exit(0))
}

export { fixUsageTracking }