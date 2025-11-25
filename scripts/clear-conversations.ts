/**
 * 清除用户对话记录
 * 用法: npx tsx scripts/clear-conversations.ts [email]
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { PrismaClient } from '@prisma/client'

// 加载环境变量
config({ path: resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function clearConversations() {
  const email = process.argv[2]

  console.log('🔍 正在连接数据库...')

  try {
    if (email) {
      // 清除指定用户的对话
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, displayName: true }
      })

      if (!user) {
        console.error(`❌ 找不到用户: ${email}`)
        process.exit(1)
      }

      console.log(`📋 找到用户: ${user.displayName || user.email} (${user.id})`)

      // 先删除消息
      const deletedMessages = await prisma.message.deleteMany({
        where: { userId: user.id }
      })
      console.log(`   删除了 ${deletedMessages.count} 条消息`)

      // 再删除对话
      const deletedConversations = await prisma.conversation.deleteMany({
        where: { userId: user.id }
      })
      console.log(`   删除了 ${deletedConversations.count} 个对话`)

      console.log(`\n✅ 已清除用户 ${email} 的所有对话记录`)

    } else {
      // 列出所有用户
      console.log('\n📋 所有用户列表:')
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          displayName: true,
          _count: {
            select: { conversations: true, messages: true }
          }
        }
      })

      if (users.length === 0) {
        console.log('   (没有用户)')
      } else {
        users.forEach(user => {
          console.log(`   - ${user.email} (${user.displayName || 'no name'})`)
          console.log(`     对话: ${user._count.conversations}, 消息: ${user._count.messages}`)
        })
      }

      console.log('\n💡 用法: npx tsx scripts/clear-conversations.ts <email>')
      console.log('   例如: npx tsx scripts/clear-conversations.ts admin@example.com')
    }

  } catch (error) {
    console.error('❌ 操作失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

clearConversations()
