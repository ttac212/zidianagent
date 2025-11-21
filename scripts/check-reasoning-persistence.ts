/**
 * 检查数据库中推理过程的持久化情况
 */

import { prisma } from '../lib/prisma'

async function checkReasoningPersistence() {
  try {
    console.log('🔍 检查数据库中的推理过程数据...\n')

    // 查找包含reasoning的消息
    const messagesWithReasoning = await prisma.message.findMany({
      where: {
        metadata: {
          path: ['reasoning'],
          not: null
        }
      },
      select: {
        id: true,
        role: true,
        content: true,
        metadata: true,
        createdAt: true,
        conversation: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    })

    if (messagesWithReasoning.length === 0) {
      console.log('❌ 没有找到包含reasoning的消息')
      console.log('💡 可能的原因：')
      console.log('   1. 还没有使用推理模型发送过消息')
      console.log('   2. 数据没有正确保存')
      console.log('\n建议：')
      console.log('   - 使用Claude推理模型发送一条测试消息')
      console.log('   - 在设置中启用推理模式（reasoning_effort: low/medium/high）')
      return
    }

    console.log(`✅ 找到 ${messagesWithReasoning.length} 条包含推理过程的消息\n`)

    messagesWithReasoning.forEach((msg, index) => {
      console.log(`--- 消息 ${index + 1} ---`)
      console.log(`ID: ${msg.id}`)
      console.log(`对话: ${msg.conversation.title}`)
      console.log(`角色: ${msg.role}`)
      console.log(`时间: ${msg.createdAt.toLocaleString('zh-CN')}`)
      console.log(`内容预览: ${msg.content.substring(0, 100)}...`)

      const metadata = msg.metadata as any
      if (metadata?.reasoning) {
        console.log(`推理过程长度: ${metadata.reasoning.length} 字符`)
        console.log(`推理预览: ${metadata.reasoning.substring(0, 100)}...`)
      }
      if (metadata?.reasoningEffort) {
        console.log(`推理强度: ${metadata.reasoningEffort}`)
      }
      console.log()
    })

    // 统计信息
    const totalMessages = await prisma.message.count()
    const percentage = ((messagesWithReasoning.length / totalMessages) * 100).toFixed(2)

    console.log(`📊 统计信息:`)
    console.log(`   总消息数: ${totalMessages}`)
    console.log(`   包含推理: ${messagesWithReasoning.length} (${percentage}%)`)
    console.log()

    // 检查最近的助手消息
    const recentAssistantMessages = await prisma.message.findMany({
      where: {
        role: 'ASSISTANT'
      },
      select: {
        id: true,
        metadata: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    })

    const withReasoning = recentAssistantMessages.filter(m => {
      const metadata = m.metadata as any
      return metadata?.reasoning
    })

    console.log(`📈 最近10条助手消息分析:`)
    console.log(`   包含推理: ${withReasoning.length}/10`)
    console.log()

  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkReasoningPersistence()
