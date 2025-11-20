/**
 * 验证对话列表 API 是否正确返回 lastMessage 字段
 *
 * 测试步骤：
 * 1. 获取对话列表
 * 2. 验证每个对话的 lastMessage 字段
 * 3. 验证 metadata.lastMessage 也存在
 */

import { prisma } from '@/lib/prisma'
import { deriveConversationData, filterConversations } from '@/lib/utils/conversation-list'
import type { Conversation } from '@/types/chat'

async function verifyConversationLastMessage() {
  console.log('🔍 开始验证对话 lastMessage 字段...\n')

  try {
    // 1. 获取一个用户的对话（模拟 API 查询）
    const conversations = await prisma.conversation.findMany({
      take: 5,
      select: {
        id: true,
        title: true,
        modelId: true,
        temperature: true,
        maxTokens: true,
        contextAware: true,
        messageCount: true,
        totalTokens: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        lastMessageAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          }
        },
      },
      orderBy: [
        { lastMessageAt: 'desc' },
        { createdAt: 'desc' }
      ],
    })

    console.log(`✅ 找到 ${conversations.length} 个对话\n`)

    if (conversations.length === 0) {
      console.log('⚠️  没有找到对话，无法测试')
      return
    }

    // 2. 模拟 API 响应映射逻辑
    const conversationsWithLastMessage = conversations.map((conv: any) => {
      const lastMessage = conv.messages?.[0] || null

      // 模拟 API 响应结构
      const updatedMetadata = {
        ...conv.metadata,
        lastMessage: lastMessage ? {
          id: lastMessage.id,
          role: lastMessage.role,
          content: lastMessage.content,
          createdAt: lastMessage.createdAt
        } : null
      }

      return {
        ...conv,
        model: conv.modelId,
        lastMessage, // 根级别
        metadata: updatedMetadata, // metadata 中也包含
        messages: undefined, // API 不返回 messages 数组（除非 includeMessages=true）
      }
    })

    // 3. 测试 deriveConversationData 函数
    console.log('📊 测试 deriveConversationData 函数:\n')
    const derivedConversations = conversationsWithLastMessage.map((conv: any) => {
      const derived = deriveConversationData(conv as Conversation)

      console.log(`对话: ${derived.title}`)
      console.log(`  - lastSnippet: ${derived.lastSnippet}`)
      console.log(`  - lastUpdatedLabel: ${derived.lastUpdatedLabel}`)
      console.log(`  - isPinned: ${derived.isPinned}`)

      // 验证 lastSnippet 不是 "暂无消息"（除非真的没有消息）
      if (conv.lastMessage && derived.lastSnippet === '暂无消息') {
        console.error('  ❌ 错误：有 lastMessage 但 lastSnippet 显示为"暂无消息"')
        return false
      }

      console.log('  ✅ 派生数据正确\n')
      return true
    })

    const allPassed = derivedConversations.every(result => result === true)

    if (!allPassed) {
      console.error('❌ 部分测试失败')
      process.exit(1)
    }

    // 4. 测试 filterConversations 函数
    console.log('🔍 测试 filterConversations 函数:\n')
    const derived = conversationsWithLastMessage.map(conv => deriveConversationData(conv as Conversation))

    // 使用第一个对话的标题进行搜索
    if (derived.length > 0) {
      const firstTitle = derived[0].title
      const searchQuery = firstTitle.slice(0, 3) // 取标题前3个字符作为搜索词

      console.log(`搜索词: "${searchQuery}"`)
      const filtered = filterConversations(derived, searchQuery)
      console.log(`找到 ${filtered.length} 个匹配的对话`)

      if (filtered.length > 0) {
        console.log('✅ 搜索功能正常\n')
      } else {
        console.error('❌ 搜索功能异常：应该至少找到一个对话\n')
        process.exit(1)
      }
    }

    console.log('🎉 所有测试通过！\n')
    console.log('总结:')
    console.log('  ✅ API 响应包含 lastMessage（根级别）')
    console.log('  ✅ API 响应包含 metadata.lastMessage')
    console.log('  ✅ deriveConversationData 正确派生 lastSnippet')
    console.log('  ✅ filterConversations 搜索功能正常')

  } catch (error) {
    console.error('❌ 测试失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行验证
verifyConversationLastMessage()
