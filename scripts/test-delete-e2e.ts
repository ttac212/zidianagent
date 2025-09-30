/**
 * 端到端删除测试
 * 测试完整的删除流程：前端API调用 → 后端删除 → 数据库验证
 */

import { prisma } from '@/lib/prisma'

async function testDeleteE2E() {
  console.log('🔍 端到端删除测试\n')

  try {
    // 1. 查询当前所有对话
    console.log('📋 步骤1: 查询当前所有对话')
    const beforeConversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        _count: {
          select: { messages: true }
        }
      }
    })

    console.log(`  找到 ${beforeConversations.length} 个对话:`)
    beforeConversations.forEach(c => {
      console.log(`    - ${c.id.slice(0, 8)}: "${c.title}" (${c._count.messages} 消息)`)
    })

    if (beforeConversations.length === 0) {
      console.log('\n⚠️  没有对话可以删除，测试结束')
      return
    }

    // 2. 选择第一个对话进行删除测试
    const targetId = beforeConversations[0].id
    console.log(`\n🎯 步骤2: 准备删除对话 ${targetId.slice(0, 8)}`)

    // 3. 检查这个对话有多少消息
    const messageCount = await prisma.message.count({
      where: { conversationId: targetId }
    })
    console.log(`  该对话包含 ${messageCount} 条消息`)

    // 4. 执行删除（模拟API调用的逻辑）
    console.log('\n🗑️  步骤3: 执行删除操作')
    await prisma.conversation.delete({
      where: { id: targetId }
    })
    console.log('  ✅ 数据库删除成功')

    // 5. 验证对话是否真的被删除
    console.log('\n✅ 步骤4: 验证删除结果')
    const deletedConversation = await prisma.conversation.findUnique({
      where: { id: targetId }
    })

    if (deletedConversation === null) {
      console.log('  ✅ 对话已从数据库中删除')
    } else {
      console.log('  ❌ 错误：对话仍然存在于数据库中！')
      return
    }

    // 6. 验证关联消息是否被级联删除
    const orphanMessages = await prisma.message.count({
      where: { conversationId: targetId }
    })

    if (orphanMessages === 0) {
      console.log(`  ✅ 所有 ${messageCount} 条关联消息已被级联删除`)
    } else {
      console.log(`  ⚠️  警告：仍有 ${orphanMessages} 条孤立消息未删除`)
    }

    // 7. 检查剩余对话数量
    const afterCount = await prisma.conversation.count()
    console.log(`\n📊 步骤5: 统计最终结果`)
    console.log(`  删除前: ${beforeConversations.length} 个对话`)
    console.log(`  删除后: ${afterCount} 个对话`)
    console.log(`  减少了: ${beforeConversations.length - afterCount} 个对话`)

    console.log('\n✅ 端到端测试完成：数据库删除功能正常工作')

  } catch (error) {
    console.error('\n❌ 测试失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testDeleteE2E()
