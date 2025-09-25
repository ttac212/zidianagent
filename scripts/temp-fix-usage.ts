/**
 * 临时修复使用量统计
 * 在代码完全修复前的补救措施
 */

import { prisma } from '../lib/prisma'

// Token估算函数
function estimateTokens(text: string): number {
  if (!text) return 0
  
  // 中文按字符计算，英文按单词计算
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = text.replace(/[\u4e00-\u9fa5]/g, '').split(/\s+/).filter(Boolean).length
  
  // 粗略估算：中文字符*1.5，英文单词*1.3
  return Math.ceil(chineseChars * 1.5 + englishWords * 1.3)
}

async function tempFixUsage() {
  try {
    // 1. 修复没有token的消息
    const messagesWithoutTokens = await prisma.message.findMany({
      where: {
        role: 'ASSISTANT',
        AND: [
          { promptTokens: 0 },
          { completionTokens: 0 }
        ]
      }
    })
    
    let fixedCount = 0
    for (const msg of messagesWithoutTokens) {
      if (msg.content) {
        const estimated = estimateTokens(msg.content)
        const promptTokens = Math.ceil(estimated * 0.3)
        const completionTokens = estimated
        
        await prisma.message.update({
          where: { id: msg.id },
          data: {
            promptTokens,
            completionTokens
            // Note: Message model doesn't have totalTokens field
          }
        })
        fixedCount++
      }
    }
    
    // 2. 重新计算用户使用量
    const users = await prisma.user.findMany()
    
    for (const user of users) {
      // 计算本月使用量
      const thisMonth = new Date()
      thisMonth.setDate(1)
      thisMonth.setHours(0, 0, 0, 0)
      
      const monthlyUsage = await prisma.message.aggregate({
        where: {
          conversation: {
            userId: user.id
          },
          createdAt: {
            gte: thisMonth
          }
        },
        _sum: {
          promptTokens: true,
          completionTokens: true
        }
      })
      
      // 计算总使用量
      const totalUsage = await prisma.message.aggregate({
        where: {
          conversation: {
            userId: user.id
          }
        },
        _sum: {
          promptTokens: true,
          completionTokens: true
        }
      })
      
      const currentMonth = (monthlyUsage._sum.promptTokens || 0) + (monthlyUsage._sum.completionTokens || 0)
      const total = (totalUsage._sum.promptTokens || 0) + (totalUsage._sum.completionTokens || 0)
      
      // 更新用户记录
      await prisma.user.update({
        where: { id: user.id },
        data: {
          currentMonthUsage: currentMonth,
          totalTokenUsed: total
        }
      })
      
      }
    
    // 3. 重建UsageStats记录
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    
    for (const user of users) {
      // 获取今日的消息
      const todayMessages = await prisma.message.findMany({
        where: {
          conversation: {
            userId: user.id
          },
          createdAt: {
            gte: today
          }
        },
        select: {
          modelId: true,
          promptTokens: true,
          completionTokens: true
        }
      })
      
      // 按模型分组统计
      const modelStats = new Map<string, number>()
      let totalTokens = 0

      for (const msg of todayMessages) {
        const tokens = (msg.promptTokens || 0) + (msg.completionTokens || 0)
        totalTokens += tokens
        
        if (msg.modelId) {
          const current = modelStats.get(msg.modelId) || 0
          modelStats.set(msg.modelId, current + tokens)
        }
      }
      
      // 更新或创建总量统计
      if (totalTokens > 0) {
        await prisma.usageStats.upsert({
          where: {
            userId_date_modelId: {
              userId: user.id,
              date: today,
              modelId: "_total"
            }
          },
          update: {
            promptTokens: Math.ceil(totalTokens * 0.3),
            completionTokens: Math.ceil(totalTokens * 0.7),
            messagesCreated: todayMessages.length,
            updatedAt: new Date()
          },
          create: {
            userId: user.id,
            date: today,
            modelId: "_total",
            promptTokens: Math.ceil(totalTokens * 0.3),
            completionTokens: Math.ceil(totalTokens * 0.7),
            messagesCreated: todayMessages.length,
            apiCalls: Math.ceil(todayMessages.length / 2),
            successfulCalls: Math.ceil(todayMessages.length / 2)
          }
        })
        
        }
      
      // 更新按模型统计
      for (const [modelId, tokens] of modelStats) {
        const provider = modelId.includes('claude') ? 'Claude' : 
                        modelId.includes('gemini') ? 'Google' : 'Unknown'
        
        await prisma.usageStats.upsert({
          where: {
            userId_date_modelId: {
              userId: user.id,
              date: today,
              modelId
            }
          },
          update: {
            promptTokens: Math.ceil(tokens * 0.3),
            completionTokens: Math.ceil(tokens * 0.7),
            updatedAt: new Date()
          },
          create: {
            userId: user.id,
            date: today,
            modelId,
            modelProvider: provider,
            promptTokens: Math.ceil(tokens * 0.3),
            completionTokens: Math.ceil(tokens * 0.7),
            apiCalls: 1,
            successfulCalls: 1
          }
        })
        
        }
    }
    
    } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

// 运行修复
if (require.main === module) {
  tempFixUsage()
    .catch(console.error)
    .finally(() => process.exit(0))
}

export { tempFixUsage }