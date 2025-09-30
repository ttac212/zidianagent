/**
 * 检查现有conversations表中的metadata数据
 */

import { prisma } from '../lib/prisma'

async function checkMetadata() {
  console.log('🔍 检查现有metadata数据\n')

  try {
    const conversations = await prisma.conversation.findMany({
      select: {
        id: true,
        title: true,
        metadata: true
      },
      take: 10,
      orderBy: { updatedAt: 'desc' }
    })

    console.log(`📊 找到 ${conversations.length} 条对话记录\n`)

    for (const conv of conversations) {
      console.log(`对话: ${conv.title}`)
      console.log(`  metadata类型: ${typeof conv.metadata}`)
      console.log(`  metadata值:`, JSON.stringify(conv.metadata, null, 2))

      if (conv.metadata) {
        if (typeof conv.metadata === 'object') {
          console.log(`  ✅ 已经是JSON对象`)
        } else if (typeof conv.metadata === 'string') {
          try {
            const parsed = JSON.parse(conv.metadata)
            console.log(`  ✅ 可解析为JSON:`, parsed)
          } catch (e) {
            console.log(`  ❌ 不是有效的JSON`)
          }
        }
      }
      console.log('')
    }

  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkMetadata()
