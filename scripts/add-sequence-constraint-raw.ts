#!/usr/bin/env tsx
/**
 * 直接用 raw SQL 添加 sequence 约束
 * 需要重建表因为 SQLite 不支持 ALTER TABLE ADD CONSTRAINT
 */

import { prisma } from '@/lib/prisma'

async function main() {
  console.log('Adding sequence constraint via raw SQL...\n')

  try {
    // 1. 禁用外键检查
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys=OFF')

    // 2. 开始事务
    await prisma.$executeRawUnsafe('BEGIN TRANSACTION')

    // 3. 重命名旧表
    await prisma.$executeRawUnsafe('ALTER TABLE "creative_copies" RENAME TO "creative_copies_old"')

    // 4. 创建带约束的新表
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "creative_copies" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "batchId" TEXT NOT NULL,
        "sequence" INTEGER NOT NULL,
        "markdownContent" TEXT NOT NULL,
        "rawModelOutput" JSONB,
        "userOverride" TEXT,
        "state" TEXT NOT NULL DEFAULT 'DRAFT',
        "regeneratedFromId" TEXT,
        "editedBy" TEXT,
        "editedAt" DATETIME,
        "contentVersion" INTEGER NOT NULL DEFAULT 1,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "creative_copies_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "creative_batches" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "creative_copies_regeneratedFromId_fkey" FOREIGN KEY ("regeneratedFromId") REFERENCES "creative_copies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "creative_copies_sequence_chk" CHECK ("sequence" >= 1 AND "sequence" <= 5)
      )
    `)

    // 5. 复制数据（过滤越界值）
    await prisma.$executeRawUnsafe(`
      INSERT INTO "creative_copies"
      SELECT * FROM "creative_copies_old"
      WHERE "sequence" >= 1 AND "sequence" <= 5
    `)

    // 6. 删除旧表
    await prisma.$executeRawUnsafe('DROP TABLE "creative_copies_old"')

    // 7. 重建索引
    await prisma.$executeRawUnsafe(`
      CREATE INDEX "creative_copies_batch_sequence_idx"
      ON "creative_copies"("batchId", "sequence")
    `)

    await prisma.$executeRawUnsafe(`
      CREATE INDEX "creative_copies_regenerated_idx"
      ON "creative_copies"("regeneratedFromId")
    `)

    // 8. 提交事务
    await prisma.$executeRawUnsafe('COMMIT')

    // 9. 启用外键检查
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys=ON')

    console.log('✅ Constraint added successfully\n')

    // 10. 验证
    console.log('Verifying constraint...')
    
    const tableSchema = await prisma.$queryRaw<Array<{ sql: string }>>`
      SELECT sql FROM sqlite_master WHERE type='table' AND name='creative_copies'
    `
    
    if (tableSchema[0].sql.includes('creative_copies_sequence_chk')) {
      console.log('✅ Constraint found in table definition')
    } else {
      console.log('❌ Constraint NOT found in table definition')
    }

    // 测试约束
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "creative_copies" 
        (id, batchId, sequence, markdownContent, contentVersion, updatedAt)
        VALUES ('test_id', 'test_batch', 10, 'test', 1, datetime('now'))
      `)
      console.log('❌ Constraint NOT working - invalid value accepted')
      // 清理
      await prisma.$executeRawUnsafe(`DELETE FROM "creative_copies" WHERE id = 'test_id'`)
    } catch (error: any) {
      if (error.message.includes('CHECK') || error.message.includes('constraint')) {
        console.log('✅ Constraint IS working - invalid value rejected')
      } else {
        console.log(`⚠️  Got error: ${error.message}`)
      }
    }

  } catch (error: any) {
    console.error('❌ Failed:', error.message)
    try {
      await prisma.$executeRawUnsafe('ROLLBACK')
    } catch {}
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
