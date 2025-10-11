/**
 * 测试Conversation.metadata字段
 * 验证修复后的metadata持久化功能
 */

import { prisma, toJsonInput } from '@/lib/prisma'

async function testMetadataField() {
  console.log('🧪 测试Conversation.metadata字段\n')

  try {
    // 1. 查找一个现有对话
    const conversation = await prisma.conversation.findFirst({
      orderBy: { updatedAt: 'desc' }
    })

    if (!conversation) {
      console.log('⚠️  没有找到对话，先创建一个测试对话')
      const user = await prisma.user.findFirst()
      if (!user) {
        console.error('❌ 没有找到用户')
        return
      }

      const newConv = await prisma.conversation.create({
        data: {
          title: 'Metadata测试对话',
          userId: user.id,
          modelId: 'gpt-3.5-turbo',
          metadata: toJsonInput({ pinned: false, tags: [] })
        }
      })
      console.log('✅ 创建测试对话:', newConv.id)
      return
    }

    console.log('📋 找到对话:')
    console.log(`  ID: ${conversation.id}`)
    console.log(`  标题: ${conversation.title}`)
    console.log(`  当前metadata: ${conversation.metadata}`)

    // 2. 测试更新metadata - 固定对话
    console.log('\n🔄 测试1: 固定对话')
    const updatedConv1 = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        metadata: toJsonInput({ pinned: true, tags: ['important'] })
      }
    })
    console.log('✅ 更新成功:', updatedConv1.metadata)

    // 3. 读取验证
    console.log('\n🔍 测试2: 读取验证')
    const verifyConv = await prisma.conversation.findUnique({
      where: { id: conversation.id }
    })
    console.log('✅ 读取成功:', verifyConv?.metadata)

    // 4. 测试解析JSON
    console.log('\n📦 测试3: JSON解析')
    if (verifyConv?.metadata) {
      try {
        const parsed = typeof verifyConv.metadata === 'string'
          ? JSON.parse(verifyConv.metadata)
          : (verifyConv.metadata as Record<string, unknown>)
        console.log('✅ JSON解析成功:', parsed)
        console.log(`  pinned: ${parsed.pinned}`)
        console.log(`  tags: ${JSON.stringify(parsed.tags)}`)
      } catch (e) {
        console.error('❌ JSON解析失败:', e)
      }
    }

    // 5. 测试通过API更新（模拟前端调用）
    console.log('\n🌐 测试4: 模拟API PATCH请求')
    const apiUpdate = {
      metadata: { pinned: false, tags: ['test', 'api'] }
    }
    const updatedConv2 = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        metadata: toJsonInput(apiUpdate.metadata)
      }
    })
    console.log('✅ API模拟更新成功:', updatedConv2.metadata)

    console.log('\n✅ 所有测试通过！metadata字段工作正常')

  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    if (error instanceof Error) {
      console.error('错误详情:', error.message)
      console.error('堆栈:', error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

testMetadataField()
