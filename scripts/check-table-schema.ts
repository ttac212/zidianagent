#!/usr/bin/env tsx
/**
 * 检查 creative_copies 表结构
 */

import { prisma } from '@/lib/prisma'

async function main() {
  console.log('Checking creative_copies table schema...\n')

  // 获取表结构
  const result = await prisma.$queryRaw<Array<{ sql: string }>>`
    SELECT sql FROM sqlite_master WHERE type='table' AND name='creative_copies'
  `

  if (result.length > 0) {
    console.log('Table definition:')
    console.log(result[0].sql)
  } else {
    console.log('Table not found')
  }

  console.log('\n--- Checking PRAGMA ---')
  
  // 检查外键是否启用
  const fkCheck = await prisma.$queryRaw<Array<{ foreign_keys: number }>>`PRAGMA foreign_keys`
  console.log('Foreign keys enabled:', fkCheck[0].foreign_keys === 1)

  // 获取表信息
  const tableInfo = await prisma.$queryRaw<Array<{
    cid: number
    name: string
    type: string
    notnull: number
    dflt_value: any
    pk: number
  }>>`PRAGMA table_info(creative_copies)`
  
  console.log('\nTable columns:')
  tableInfo.forEach(col => {
    console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`)
  })
}

main()
  .catch(e => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
