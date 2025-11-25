#!/usr/bin/env tsx
/**
 * 完整数据迁移脚本 - SQLite到PostgreSQL
 * 处理所有表的数据迁移,包括字段映射
 */

const sqlite3 = require('better-sqlite3')
const { Client } = require('pg')

const FIELD_MAPPING: Record<string, Record<string, string>> = {
  users: {
    image: 'avatar',  // SQLite的image字段映射到PostgreSQL的avatar
  }
}

async function migrateTable(
  sqliteDb: any,
  pgClient: any,
  tableName: string
): Promise<{ total: number; inserted: number }> {
  const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all()

  if (rows.length === 0) {
    return { total: 0, inserted: 0 }
  }

  let inserted = 0
  for (const row of rows) {
    try {
      let columns = Object.keys(row)

      // 应用字段映射
      const mapping = FIELD_MAPPING[tableName]
      if (mapping) {
        columns = columns.map(col => mapping[col] || col)
      }

      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
      const values = Object.keys(row).map(col => row[col])

      const sql = `
        INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')})
        VALUES (${placeholders})
        ON CONFLICT DO NOTHING
      `

      await pgClient.query(sql, values)
      inserted++
    } catch (err: any) {
      if (err.code !== '23505') {
        console.error(`     ⚠️  ${err.message}`)
      }
    }
  }

  return { total: rows.length, inserted }
}

async function migrate() {
  console.log('🚀 开始完整数据迁移...\n')

  const sqliteDb = sqlite3('./prisma/dev.db', { readonly: true })
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL })

  await pgClient.connect()

  try {
    // 按依赖顺序迁移表
    const tables = [
      'users',
      'accounts',
      'sessions',
      'verification_tokens',
      'conversations',
      'messages',
      'usage_stats',
      'merchant_categories',
      'merchants',
      'merchant_contents',
      'merchant_content_comments',
      'merchant_content_analyses',
      'merchant_audience_analyses',
      'merchant_audience_analysis_versions',
      'merchant_profiles',
      'merchant_profile_versions',
      'merchant_members',
      'merchant_benchmarks'
    ]

    const results: Record<string, { total: number; inserted: number }> = {}

    for (const tableName of tables) {
      try {
        // 检查表是否存在
        const exists = sqliteDb
          .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
          .get(tableName)

        if (!exists) {
          console.log(`⏭️  跳过不存在的表: ${tableName}\n`)
          continue
        }

        console.log(`🔄 迁移表: ${tableName}`)
        const result = await migrateTable(sqliteDb, pgClient, tableName)
        results[tableName] = result

        if (result.total === 0) {
          console.log(`   ⏭️  空表，跳过\n`)
        } else {
          console.log(`   ✅ 成功插入 ${result.inserted}/${result.total} 条记录\n`)
        }
      } catch (err: any) {
        console.error(`   ❌ 迁移失败: ${err.message}\n`)
      }
    }

    console.log('🎉 迁移完成！\n')
    console.log('📊 迁移统计:')

    // 查询PostgreSQL中的实际数据
    const counts = await Promise.all([
      pgClient.query('SELECT COUNT(*) FROM users'),
      pgClient.query('SELECT COUNT(*) FROM conversations'),
      pgClient.query('SELECT COUNT(*) FROM messages'),
      pgClient.query('SELECT COUNT(*) FROM merchants'),
      pgClient.query('SELECT COUNT(*) FROM merchant_contents')
    ])

    console.log(`   用户: ${counts[0].rows[0].count}`)
    console.log(`   对话: ${counts[1].rows[0].count}`)
    console.log(`   消息: ${counts[2].rows[0].count}`)
    console.log(`   商家: ${counts[3].rows[0].count}`)
    console.log(`   商家内容: ${counts[4].rows[0].count}`)
  } finally {
    sqliteDb.close()
    await pgClient.end()
  }
}

migrate().catch(console.error)
