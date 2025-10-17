import { PrismaClient } from '@prisma/client'
import path from 'path'

process.env.DATABASE_URL = `file:${path.join(process.cwd(), 'prisma', 'dev.db')}`

const prisma = new PrismaClient()

async function migrateDatabase() {
  try {
    console.log('🔄 开始数据库迁移...\n')

    // 添加metadata字段到conversations表
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE conversations ADD COLUMN metadata TEXT
      `)
      console.log('✅ 成功添加 conversations.metadata 字段')
    } catch (error: any) {
      if (error.message?.includes('duplicate column name')) {
        console.log('ℹ️  conversations.metadata 字段已存在')
      } else {
        throw error
      }
    }

    // 验证字段已添加
    const tableInfo = await prisma.$queryRawUnsafe<Array<{
      name: string
      type: string
    }>>(`PRAGMA table_info(conversations)`)

    const hasMetadata = tableInfo.some(col => col.name === 'metadata')
    console.log(`\n✅ metadata字段验证: ${hasMetadata ? '存在' : '不存在'}`)

    if (hasMetadata) {
      console.log('\n🎉 数据库迁移完成!')
    }

  } catch (error) {
    console.error('❌ 迁移失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

migrateDatabase()
