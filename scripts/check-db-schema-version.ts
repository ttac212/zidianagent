import { PrismaClient } from '@prisma/client'
import path from 'path'

// 使用绝对路径
process.env.DATABASE_URL = `file:${path.join(process.cwd(), 'prisma', 'dev.db')}`

const prisma = new PrismaClient()

async function checkSchema() {
  try {
    console.log('🔍 检查数据库schema...\n')

    // 检查conversations表结构
    const tableInfo = await prisma.$queryRawUnsafe<Array<{
      cid: number
      name: string
      type: string
      notnull: number
      dflt_value: string | null
      pk: number
    }>>(`PRAGMA table_info(conversations)`)

    console.log('📋 conversations表当前字段:')
    tableInfo.forEach(col => {
      console.log(`  - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}`)
    })

    // 检查是否有metadata字段
    const hasMetadata = tableInfo.some(col => col.name === 'metadata')
    console.log(`\n✅ metadata字段存在: ${hasMetadata}`)

    if (!hasMetadata) {
      console.log('\n⚠️  需要添加metadata字段!')
      console.log('建议运行: pnpm db:push 来同步schema')
    }

  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSchema()
