import { prisma } from '../lib/prisma'

async function checkConversations() {
  try {
    console.log('🔍 正在检查数据库中的对话数据...\n')

    // 检查所有用户
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        status: true,
      }
    })

    console.log(`📊 用户数量: ${users.length}`)
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.displayName}) - 状态: ${user.status}`)
    })

    console.log('\n')

    // 检查所有对话
    const conversations = await prisma.conversation.findMany({
      select: {
        id: true,
        title: true,
        userId: true,
        modelId: true,
        messageCount: true,
        totalTokens: true,
        createdAt: true,
        lastMessageAt: true,
        user: {
          select: {
            email: true,
            displayName: true,
          }
        }
      },
      orderBy: {
        lastMessageAt: 'desc'
      }
    })

    console.log(`💬 对话总数: ${conversations.length}`)

    if (conversations.length === 0) {
      console.log('⚠️  数据库中没有对话数据！')
    } else {
      console.log('\n最近的对话:')
      conversations.slice(0, 10).forEach((conv, index) => {
        console.log(`\n${index + 1}. ${conv.title}`)
        console.log(`   ID: ${conv.id}`)
        console.log(`   用户: ${conv.user.email}`)
        console.log(`   模型: ${conv.modelId}`)
        console.log(`   消息数: ${conv.messageCount}`)
        console.log(`   Token数: ${conv.totalTokens}`)
        console.log(`   创建时间: ${conv.createdAt}`)
        console.log(`   最后消息: ${conv.lastMessageAt}`)
      })
    }

    // 按用户分组统计
    console.log('\n\n📈 按用户统计:')
    const userStats = conversations.reduce((acc, conv) => {
      const email = conv.user.email
      if (!acc[email]) {
        acc[email] = { count: 0, totalMessages: 0 }
      }
      acc[email].count++
      acc[email].totalMessages += conv.messageCount || 0
      return acc
    }, {} as Record<string, { count: number; totalMessages: number }>)

    Object.entries(userStats).forEach(([email, stats]) => {
      console.log(`  ${email}: ${stats.count} 个对话, ${stats.totalMessages} 条消息`)
    })

    // 检查消息表
    const messageCount = await prisma.message.count()
    console.log(`\n📨 消息总数: ${messageCount}`)

  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkConversations()