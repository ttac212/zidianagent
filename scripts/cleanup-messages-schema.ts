import { PrismaClient } from '@prisma/client'
import path from 'path'

process.env.DATABASE_URL = `file:${path.join(process.cwd(), 'prisma', 'dev.db')}`

const prisma = new PrismaClient()

async function cleanupMessagesTable() {
  try {
    console.log('🔄 清理messages表冗余字段...\n')

    // 检查是否有totalTokens字段
    const tableInfo = await prisma.$queryRawUnsafe<Array<{
      name: string
    }>>(`PRAGMA table_info(messages)`)

    const hasTotalTokens = tableInfo.some(col => col.name === 'totalTokens')

    if (hasTotalTokens) {
      console.log('⚠️  发现冗余字段totalTokens,SQLite不支持直接删除列')
      console.log('ℹ️  此字段已被promptTokens和completionTokens替代,可以忽略')
    } else {
      console.log('✅ 无需清理,表结构已经是最新的')
    }

    console.log('\n✅ 检查完成!')

  } catch (error) {
    console.error('❌ 清理失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanupMessagesTable()
