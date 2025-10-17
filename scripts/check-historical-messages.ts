import { PrismaClient } from '@prisma/client'
import path from 'path'

process.env.DATABASE_URL = `file:${path.join(process.cwd(), 'prisma', 'dev.db')}`

const prisma = new PrismaClient()

async function checkHistoricalMessages() {
  try {
    console.log('🔍 检查历史消息数据...\n')

    // 检查总消息数
    const totalMessages = await prisma.message.count()
    console.log(`📊 消息总数: ${totalMessages}`)

    // 检查userId为空的消息
    const emptyUserIdMessages = await prisma.message.count({
      where: {
        userId: ''
      }
    })
    console.log(`⚠️  userId为空的消息: ${emptyUserIdMessages}`)

    // 检查userId不为空的消息
    const validMessages = await prisma.message.count({
      where: {
        userId: {
          not: ''
        }
      }
    })
    console.log(`✅ userId有效的消息: ${validMessages}`)

    // 随机抽查5条消息
    const sampleMessages = await prisma.message.findMany({
      take: 5,
      select: {
        id: true,
        conversationId: true,
        userId: true,
        role: true,
        content: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log('\n📝 最近5条消息样本:')
    sampleMessages.forEach((msg, index) => {
      console.log(`\n${index + 1}. ID: ${msg.id}`)
      console.log(`   对话: ${msg.conversationId}`)
      console.log(`   用户: ${msg.userId || '(空)'}`)
      console.log(`   角色: ${msg.role}`)
      console.log(`   内容: ${msg.content.substring(0, 50)}...`)
      console.log(`   时间: ${msg.createdAt}`)
    })

    // 检查每个对话的消息数量
    const conversations = await prisma.conversation.findMany({
      select: {
        id: true,
        title: true,
        messageCount: true,
        _count: {
          select: {
            messages: true
          }
        }
      },
      take: 10,
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log('\n\n💬 最近10个对话的消息统计:')
    conversations.forEach((conv, index) => {
      const mismatch = conv.messageCount !== conv._count.messages
      console.log(`${index + 1}. ${conv.title}`)
      console.log(`   记录的消息数: ${conv.messageCount}`)
      console.log(`   实际消息数: ${conv._count.messages}`)
      if (mismatch) {
        console.log(`   ⚠️  数量不匹配!`)
      }
    })

  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkHistoricalMessages()
