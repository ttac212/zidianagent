/**
 * 检查数据库表结构
 */

require('dotenv').config({ path: '.env.local' })

import { prisma } from '@/lib/prisma'

async function checkDatabaseTables() {
  console.log('\n=== 数据库表结构检查 ===\n')

  try {
    // 检查所有表
    const tables = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `

    console.log('数据库中的所有表:')
    tables.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.name}`)
    })

    // 检查 verification_tokens 表
    const hasVerificationTokens = tables.some(t =>
      t.name.toLowerCase().includes('verification')
    )

    console.log(`\n是否存在 verification 相关表: ${hasVerificationTokens ? '✓ 是' : '✗ 否'}`)

    if (!hasVerificationTokens) {
      console.log('\n⚠️  问题诊断:')
      console.log('  - VerificationToken 表在 schema 中定义，但数据库中不存在')
      console.log('  - 这可能导致 NextAuth PrismaAdapter 初始化失败')
      console.log('  - 建议运行: pnpm db:push --force-reset 重建数据库')
    }

  } catch (error: any) {
    console.error('查询失败:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabaseTables().catch(console.error)
