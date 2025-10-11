#!/usr/bin/env tsx
/**
 * 应用 creative_copies.sequence 约束迁移
 */

import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

async function main() {
  const migrationSQL = fs.readFileSync(
    path.join(process.cwd(), 'prisma/migrations/20250115_add_sequence_constraint/migration.sql'),
    'utf-8'
  )

  console.log('Applying sequence constraint migration...\n')

  try {
    // SQLite 需要分别执行每个语句
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('PRAGMA') && s !== 'BEGIN TRANSACTION' && s !== 'COMMIT')

    console.log(`Executing ${statements.length} SQL statements...\n`)

    // 使用 executeRaw 执行整个迁移
    await prisma.$executeRawUnsafe(migrationSQL)

    console.log('✅ Migration applied successfully')
    
    // 验证约束
    console.log('\nVerifying constraint...')
    
    try {
      await prisma.creativeCopy.create({
        data: {
          batchId: 'test_batch_id',
          sequence: 10, // 应该失败
          markdownContent: 'Test',
          contentVersion: 1
        }
      })
      console.log('❌ Constraint not working - invalid sequence was accepted')
    } catch (error: any) {
      if (error.message.includes('CHECK') || error.message.includes('constraint')) {
        console.log('✅ Constraint is working - invalid sequence rejected')
      } else {
        console.log('⚠️  Got error but not sure if constraint-related:', error.message)
      }
    }

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  }
}

main()
  .catch(e => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
