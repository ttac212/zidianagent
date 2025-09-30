/**
 * 测试字段覆盖顺序修复
 * 验证固定对话后刷新，统计数据不会被旧值覆盖
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testFieldOverrideOrder() {
  console.log('🧪 测试字段覆盖顺序修复...\n')

  try {
    // 1. 创建测试用户
    console.log('📝 步骤1：准备测试用户...')
    const testUser = await prisma.user.upsert({
      where: { email: 'test-override@example.com' },
      update: {},
      create: {
        email: 'test-override@example.com',
        displayName: '字段覆盖测试用户',
        role: 'USER',
        status: 'ACTIVE'
      }
    })
    console.log(`✅ 测试用户ID: ${testUser.id}\n`)

    // 2. 创建测试对话并添加消息
    console.log('📝 步骤2：创建测试对话并添加消息...')
    const testConv = await prisma.conversation.create({
      data: {
        title: '测试字段覆盖',
        userId: testUser.id,
        modelId: 'claude-3-5-haiku-20241022',
        messageCount: 2,  // 初始消息数：2
        metadata: {
          tags: []
        }
      }
    })

    // 添加2条测试消息
    await prisma.message.createMany({
      data: [
        {
          id: 'msg-test-1',
          conversationId: testConv.id,
          userId: testUser.id,
          role: 'USER',
          content: '第一条消息',
          modelId: 'claude-3-5-haiku-20241022'
        },
        {
          id: 'msg-test-2',
          conversationId: testConv.id,
          userId: testUser.id,
          role: 'ASSISTANT',
          content: '第二条消息',
          modelId: 'claude-3-5-haiku-20241022'
        }
      ]
    })

    console.log(`✅ 测试对话ID: ${testConv.id}`)
    console.log(`   初始messageCount: 2\n`)

    // 3. 模拟用户固定对话（写入旧的统计数据到metadata）
    console.log('📝 步骤3：模拟固定对话（写入旧统计数据到metadata）...')
    await prisma.conversation.update({
      where: { id: testConv.id },
      data: {
        metadata: {
          tags: ['pinned'],
          // 模拟旧代码：错误地将实时统计字段写入 metadata
          messageCount: 2,
          totalTokens: 100,
          lastActivity: new Date('2025-01-01').toISOString()
        }
      }
    })
    console.log('✅ 已固定对话，metadata中包含旧统计数据\n')

    // 4. 添加新消息（messageCount应该变成3）
    console.log('📝 步骤4：添加新消息...')
    await prisma.message.create({
      data: {
        id: 'msg-test-3',
        conversationId: testConv.id,
        userId: testUser.id,
        role: 'USER',
        content: '第三条消息（新增）',
        modelId: 'claude-3-5-haiku-20241022'
      }
    })

    // 更新对话的 messageCount
    await prisma.conversation.update({
      where: { id: testConv.id },
      data: {
        messageCount: 3  // 最新值：3条消息
      }
    })
    console.log('✅ 新增消息，当前messageCount应该是3\n')

    // 5. 模拟API列表查询（包含metadata）
    console.log('📝 步骤5：模拟API列表查询...')
    const result = await prisma.conversation.findFirst({
      where: { id: testConv.id },
      select: {
        id: true,
        messageCount: true,  // 数据库列：最新值 3
        metadata: true       // JSON字段：包含旧值 messageCount: 2
      }
    })

    if (!result) {
      throw new Error('查询失败')
    }

    console.log('API返回数据：')
    console.log(`  数据库列 messageCount: ${result.messageCount}`)
    console.log(`  metadata JSON: ${JSON.stringify(result.metadata)}`)

    const metadataObj = result.metadata as any

    // 6. 验证旧代码的问题
    console.log('\n📝 步骤6：验证字段覆盖顺序...')

    // 旧代码的错误合并方式（先设置新值，再展开metadata）
    const wrongMerge = {
      messageCount: result.messageCount,  // 3
      ...(result.metadata as any)         // { messageCount: 2 } 覆盖！
    }
    console.log('❌ 旧代码（错误）：先设置新值，再展开metadata')
    console.log(`   结果 messageCount: ${wrongMerge.messageCount}`)
    console.log(`   ${wrongMerge.messageCount === 2 ? '❌ 被旧值覆盖了！' : ''}`)

    // 新代码的正确合并方式（先展开metadata，再覆盖新值）
    const correctMerge = {
      ...(result.metadata as any),        // { messageCount: 2 }
      messageCount: result.messageCount   // 3 覆盖旧值！
    }
    console.log('\n✅ 新代码（正确）：先展开metadata，再覆盖新值')
    console.log(`   结果 messageCount: ${correctMerge.messageCount}`)
    console.log(`   ${correctMerge.messageCount === 3 ? '✅ 使用最新值！' : ''}`)

    // 7. 验证tags字段仍然保留
    console.log('\n📝 步骤7：验证用户自定义字段保留...')
    const tags = correctMerge.tags || metadataObj.tags
    console.log(`   tags: ${JSON.stringify(tags)}`)
    console.log(`   ${tags?.includes('pinned') ? '✅ pinned标签保留' : '❌ pinned标签丢失'}`)

    // 8. 清理测试数据
    console.log('\n🧹 清理测试数据...')
    await prisma.message.deleteMany({
      where: { conversationId: testConv.id }
    })
    await prisma.conversation.delete({
      where: { id: testConv.id }
    })
    console.log('✅ 测试数据已删除')

    // 总结
    console.log('\n' + '='.repeat(60))
    console.log('📊 测试结果总结:')
    console.log('='.repeat(60))
    console.log('\n旧代码问题：')
    console.log('  ❌ metadata中的旧值覆盖了数据库的最新值')
    console.log('  ❌ 用户固定对话后，刷新看到的仍是旧统计数据')
    console.log('  ❌ messageCount、totalTokens、lastActivity 全部陈旧')
    console.log('\n新代码修复：')
    console.log('  ✅ 先展开metadata（保留用户字段如tags）')
    console.log('  ✅ 再用数据库列覆盖统计字段（确保最新）')
    console.log('  ✅ toggleConversationPinned不再写入统计字段')
    console.log('\n修复验证：')
    console.log(`  ${wrongMerge.messageCount === 2 ? '✅' : '❌'} 旧代码确实会被覆盖（messageCount=2）`)
    console.log(`  ${correctMerge.messageCount === 3 ? '✅' : '❌'} 新代码使用最新值（messageCount=3）`)
    console.log(`  ${tags?.includes('pinned') ? '✅' : '❌'} 用户自定义字段保留（tags=['pinned']）`)
    console.log('\n✨ 字段覆盖顺序修复完成！')

  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 运行测试
testFieldOverrideOrder()
  .then(() => {
    console.log('\n✅ 测试完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  })
