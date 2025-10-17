import { PrismaClient } from '@prisma/client'
import path from 'path'

process.env.DATABASE_URL = `file:${path.join(process.cwd(), 'prisma', 'dev.db')}`

const prisma = new PrismaClient()

async function checkMessagesTable() {
  try {
    console.log('🔍 检查messages表schema...\n')

    // 检查messages表结构
    const tableInfo = await prisma.$queryRawUnsafe<Array<{
      cid: number
      name: string
      type: string
      notnull: number
      dflt_value: string | null
      pk: number
    }>>(`PRAGMA table_info(messages)`)

    console.log('📋 messages表当前字段:')
    tableInfo.forEach(col => {
      console.log(`  - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}`)
    })

    // 检查是否有userId字段
    const hasUserId = tableInfo.some(col => col.name === 'userId')
    console.log(`\n✅ userId字段存在: ${hasUserId}`)

    if (!hasUserId) {
      console.log('\n⚠️  需要添加userId字段!')
    }

  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkMessagesTable()
