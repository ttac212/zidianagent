import { PrismaClient } from '@prisma/client'
import path from 'path'

process.env.DATABASE_URL = `file:${path.join(process.cwd(), 'prisma', 'dev.db')}`

const prisma = new PrismaClient()

async function migrateMessagesTable() {
  try {
    console.log('🔄 开始messages表迁移...\n')

    // 添加userId字段到messages表
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE messages ADD COLUMN userId TEXT NOT NULL DEFAULT ''
      `)
      console.log('✅ 成功添加 messages.userId 字段')
    } catch (error: any) {
      if (error.message?.includes('duplicate column name')) {
        console.log('ℹ️  messages.userId 字段已存在')
      } else {
        throw error
      }
    }

    // 从conversations表回填userId字段
    console.log('\n🔄 回填userId字段...')
    const result = await prisma.$executeRawUnsafe(`
      UPDATE messages
      SET userId = (
        SELECT userId FROM conversations WHERE conversations.id = messages.conversationId
      )
      WHERE userId = '' OR userId IS NULL
    `)
    console.log(`✅ 回填完成,更新了 ${result} 条记录`)

    // 验证字段已添加
    const tableInfo = await prisma.$queryRawUnsafe<Array<{
      name: string
      type: string
    }>>(`PRAGMA table_info(messages)`)

    const hasUserId = tableInfo.some(col => col.name === 'userId')
    console.log(`\n✅ userId字段验证: ${hasUserId ? '存在' : '不存在'}`)

    if (hasUserId) {
      console.log('\n🎉 messages表迁移完成!')
    }

  } catch (error) {
    console.error('❌ 迁移失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

migrateMessagesTable()
