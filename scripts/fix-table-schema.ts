#!/usr/bin/env tsx
/**
 * 修复数据库表结构问题
 */

import { prisma } from '@/lib/prisma'

async function main() {
  console.log('检查数据库表结构...\n')

  try {
    // 检查是否有 _old 表残留
    const tables = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_old'
    `

    if (tables.length > 0) {
      console.log('发现遗留的 _old 表:')
      tables.forEach(t => console.log(`  - ${t.name}`))
      
      console.log('\n清理遗留表...')
      for (const table of tables) {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table.name}"`)
        console.log(`✓ 删除 ${table.name}`)
      }
    } else {
      console.log('✓ 无遗留表')
    }

    // 检查 creative_copies 表结构
    console.log('\n检查 creative_copies 表结构...')
    const schema = await prisma.$queryRaw<Array<{ sql: string }>>`
      SELECT sql FROM sqlite_master WHERE type='table' AND name='creative_copies'
    `

    if (schema.length > 0) {
      console.log('当前表定义:')
      console.log(schema[0].sql)
    }

  } catch (error: any) {
    console.error('错误:', error.message)
    process.exit(1)
  }

  console.log('\n完成')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
