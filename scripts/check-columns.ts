/**
 * 检查数据库列名
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function checkColumns() {
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    ` as any[]

    console.log('📋 users 表的列名:')
    result.forEach((row: any) => {
      console.log(`   - ${row.column_name}`)
    })
  } catch (error) {
    console.error('❌ 查询失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkColumns()
