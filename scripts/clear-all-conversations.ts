/**
 * 清除所有用户的对话记录
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function clearAll() {
  console.log('🗑️ 正在清除所有对话记录...')

  try {
    // 先删除消息（因为有外键约束）
    const deletedMessages = await prisma.message.deleteMany({})
    console.log(`   删除了 ${deletedMessages.count} 条消息`)

    // 再删除对话
    const deletedConversations = await prisma.conversation.deleteMany({})
    console.log(`   删除了 ${deletedConversations.count} 个对话`)

    // 重置用户的使用量统计
    const deletedStats = await prisma.usageStats.deleteMany({})
    console.log(`   清除了 ${deletedStats.count} 条使用量统计`)

    console.log('\n✅ 所有对话记录已清除！')
  } catch (error) {
    console.error('❌ 清除失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

clearAll()
