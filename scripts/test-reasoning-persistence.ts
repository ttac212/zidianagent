/**
 * 测试推理模式持久化功能
 *
 * 使用方法:
 * npx tsx scripts/test-reasoning-persistence.ts
 */

import { prisma } from '../lib/prisma'

async function testReasoningPersistence() {
  console.log('🔍 开始测试推理模式持久化功能...\n')

  // 1. 检查最近的助手消息
  console.log('📊 检查数据库中最近的助手消息...')
  const recentMessages = await prisma.message.findMany({
    where: {
      role: 'ASSISTANT'
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 5,
    select: {
      id: true,
      content: true,
      metadata: true,
      createdAt: true,
      conversationId: true
    }
  })

  console.log(`\n找到 ${recentMessages.length} 条最近的助手消息:\n`)

  recentMessages.forEach((msg, index) => {
    const metadata = msg.metadata as any
    const hasReasoning = metadata && typeof metadata === 'object' && 'reasoning' in metadata
    const reasoningLength = hasReasoning ? (metadata.reasoning as string).length : 0
    const reasoningEffort = metadata?.reasoningEffort

    console.log(`${index + 1}. 消息ID: ${msg.id}`)
    console.log(`   创建时间: ${msg.createdAt.toLocaleString('zh-CN')}`)
    console.log(`   对话ID: ${msg.conversationId}`)
    console.log(`   内容长度: ${msg.content.length} 字符`)
    console.log(`   是否有推理内容: ${hasReasoning ? '✅ 是' : '❌ 否'}`)
    if (hasReasoning) {
      console.log(`   推理内容长度: ${reasoningLength} 字符`)
      console.log(`   推理强度: ${reasoningEffort || '未设置'}`)
      console.log(`   推理内容预览: ${(metadata.reasoning as string).substring(0, 100)}...`)
    }
    console.log(`   完整metadata:`, JSON.stringify(metadata, null, 2))
    console.log()
  })

  // 2. 统计有推理内容的消息
  const totalMessagesWithReasoning = await prisma.message.count({
    where: {
      role: 'ASSISTANT',
      metadata: {
        path: ['reasoning'],
        not: null
      }
    }
  })

  console.log(`\n📈 统计信息:`)
  console.log(`   总共有 ${totalMessagesWithReasoning} 条助手消息包含推理内容`)

  // 3. 检查是否有推理强度设置
  const messagesWithEffort = await prisma.message.count({
    where: {
      role: 'ASSISTANT',
      metadata: {
        path: ['reasoningEffort'],
        not: null
      }
    }
  })

  console.log(`   总共有 ${messagesWithEffort} 条助手消息包含推理强度设置`)

  console.log('\n✅ 测试完成!')
  console.log('\n💡 提示:')
  console.log('   1. 如果没有找到包含推理内容的消息，请确保:')
  console.log('      - 已启用推理模式发送消息')
  console.log('      - 使用的是支持推理的模型（如claude-opus-4）')
  console.log('   2. 可以使用 `npx prisma studio` 查看数据库中的完整数据')
}

// 运行测试
testReasoningPersistence()
  .catch(console.error)
  .finally(() => {
    prisma.$disconnect()
    process.exit(0)
  })
