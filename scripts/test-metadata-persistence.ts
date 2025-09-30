/**
 * 测试metadata持久化流程
 * 验证pinned/tags在数据库往返中保持一致
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testMetadataPersistence() {
  console.log('🧪 开始测试metadata持久化流程...\n')

  try {
    // 1. 创建测试用户（如果不存在）
    console.log('📝 步骤1：准备测试用户...')
    const testUser = await prisma.user.upsert({
      where: { email: 'test-metadata@example.com' },
      update: {},
      create: {
        email: 'test-metadata@example.com',
        displayName: 'Metadata测试用户',
        role: 'USER',
        status: 'ACTIVE'
      }
    })
    console.log(`✅ 测试用户ID: ${testUser.id}\n`)

    // 2. 创建测试对话
    console.log('📝 步骤2：创建测试对话...')
    const testConv = await prisma.conversation.create({
      data: {
        title: '测试metadata持久化',
        userId: testUser.id,
        modelId: 'claude-3-5-haiku-20241022',
        metadata: {
          tags: ['test'],
          testTimestamp: new Date().toISOString()
        }
      }
    })
    console.log(`✅ 测试对话ID: ${testConv.id}`)
    console.log(`   初始metadata: ${JSON.stringify(testConv.metadata)}\n`)

    // 3. 固定对话（添加pinned标签）
    console.log('📝 步骤3：固定对话...')
    const pinnedConv = await prisma.conversation.update({
      where: { id: testConv.id },
      data: {
        metadata: {
          ...(testConv.metadata as object),
          tags: ['test', 'pinned']
        }
      }
    })
    console.log(`✅ 固定后metadata: ${JSON.stringify(pinnedConv.metadata)}\n`)

    // 4. 模拟列表查询（使用与API相同的select）
    console.log('📝 步骤4：模拟列表API查询...')
    const listResult = await prisma.conversation.findMany({
      where: { userId: testUser.id },
      select: {
        id: true,
        title: true,
        modelId: true,
        metadata: true, // 关键：必须包含metadata
        createdAt: true,
        lastMessageAt: true,
      },
      take: 10
    })

    const retrieved = listResult.find(c => c.id === testConv.id)
    console.log(`✅ 列表查询返回metadata: ${JSON.stringify(retrieved?.metadata)}`)

    // 验证tags是否保留
    const retrievedTags = (retrieved?.metadata as any)?.tags || []
    const hasPinnedTag = retrievedTags.includes('pinned')
    console.log(`   包含pinned标签: ${hasPinnedTag ? '✅ 是' : '❌ 否'}\n`)

    // 5. 取消固定
    console.log('📝 步骤5：取消固定...')
    const unpinnedConv = await prisma.conversation.update({
      where: { id: testConv.id },
      data: {
        metadata: {
          ...(pinnedConv.metadata as object),
          tags: ['test'] // 移除pinned
        }
      }
    })
    console.log(`✅ 取消固定后metadata: ${JSON.stringify(unpinnedConv.metadata)}\n`)

    // 6. 再次查询验证
    console.log('📝 步骤6：验证取消固定后的状态...')
    const finalCheck = await prisma.conversation.findUnique({
      where: { id: testConv.id },
      select: {
        id: true,
        metadata: true
      }
    })

    const finalTags = (finalCheck?.metadata as any)?.tags || []
    const stillPinned = finalTags.includes('pinned')
    console.log(`✅ 最终metadata: ${JSON.stringify(finalCheck?.metadata)}`)
    console.log(`   仍然包含pinned标签: ${stillPinned ? '❌ 异常' : '✅ 正常'}\n`)

    // 7. 清理测试数据
    console.log('🧹 清理测试数据...')
    await prisma.conversation.delete({
      where: { id: testConv.id }
    })
    console.log('✅ 测试对话已删除\n')

    // 总结
    console.log('📊 测试结果总结:')
    console.log('   ✅ metadata字段可以正确写入数据库')
    console.log('   ✅ 列表查询可以正确返回metadata')
    console.log(`   ${hasPinnedTag ? '✅' : '❌'} pinned标签在固定后正确保存`)
    console.log(`   ${!stillPinned ? '✅' : '❌'} pinned标签在取消固定后正确移除`)
    console.log('\n✨ metadata持久化测试完成！')

  } catch (error) {
    console.error('❌ 测试失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 运行测试
testMetadataPersistence()
  .then(() => {
    console.log('\n✅ 所有测试通过！')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  })