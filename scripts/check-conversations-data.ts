import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkConversations() {
  try {
    console.log('🔍 检查对话数据...\n')

    // 统计对话总数
    const totalConversations = await prisma.conversation.count()
    console.log(`📊 对话总数: ${totalConversations}`)

    if (totalConversations > 0) {
      // 获取最近的10条对话
      const recentConversations = await prisma.conversation.findMany({
        take: 10,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          _count: {
            select: { messages: true }
          }
        }
      })

      console.log('\n📋 最近的对话:')
      recentConversations.forEach((conv, index) => {
        console.log(`${index + 1}. ID: ${conv.id}`)
        console.log(`   标题: ${conv.title}`)
        console.log(`   模型: ${conv.modelId}`)
        console.log(`   消息数: ${conv._count.messages}`)
        console.log(`   创建时间: ${conv.createdAt}`)
        console.log(`   最后消息时间: ${conv.lastMessageAt}`)
        console.log('')
      })

      // 检查用户信息
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          _count: {
            select: { conversations: true, messages: true }
          }
        }
      })

      console.log('\n👥 用户信息:')
      users.forEach(user => {
        console.log(`- ${user.username} (ID: ${user.id})`)
        console.log(`  对话数: ${user._count.conversations}`)
        console.log(`  消息数: ${user._count.messages}`)
        console.log('')
      })
    } else {
      console.log('\n⚠️ 数据库中没有对话记录！')
    }
  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkConversations()
