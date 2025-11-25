#!/usr/bin/env tsx
/**
 * SQLite 到 PostgreSQL 简易迁移工具
 * 直接读取SQLite，写入PostgreSQL
 */

import * as fs from 'fs'
import * as path from 'path'

const sqlite3 = require('better-sqlite3')
const { Client } = require('pg')

const NEON_URL = process.env.DATABASE_URL

if (!NEON_URL) {
  console.error('❌ 请设置 DATABASE_URL 环境变量')
  process.exit(1)
}

async function migrate() {
  console.log('🚀 开始数据迁移...\n')

  // 打开SQLite数据库
  const sqliteDb = sqlite3('./prisma/dev.db', { readonly: true })

  // 连接PostgreSQL
  const pgClient = new Client({ connectionString: NEON_URL })
  await pgClient.connect()

  try {
    // 获取所有表
    const tables = sqliteDb.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      AND name NOT LIKE '_prisma%'
      ORDER BY name
    `).all()

    console.log(`📊 找到 ${tables.length} 个表\n`)

    for (const { name: tableName } of tables) {
      console.log(`🔄 迁移表: ${tableName}`)

      // 获取数据
      const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all()

      if (rows.length === 0) {
        console.log(`   ⏭️  空表，跳过\n`)
        continue
      }

      console.log(`   📝 找到 ${rows.length} 条记录`)

      // 批量插入
      let inserted = 0
      for (const row of rows) {
        const columns = Object.keys(row)
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
        const values = columns.map(col => row[col])

        const sql = `
          INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')})
          VALUES (${placeholders})
          ON CONFLICT DO NOTHING
        `

        try {
          await pgClient.query(sql, values)
          inserted++
        } catch (err: any) {
          if (err.code !== '23505') { // 忽略重复键错误
            console.error(`     ⚠️  插入失败:`, err.message)
          }
        }
      }

      console.log(`   ✅ 成功插入 ${inserted}/${rows.length} 条记录\n`)
    }

    console.log('🎉 迁移完成！\n')

    // 显示统计
    console.log('📊 数据统计:')
    const userCount = await pgClient.query('SELECT COUNT(*) FROM "User"')
    const convCount = await pgClient.query('SELECT COUNT(*) FROM "Conversation"')
    const msgCount = await pgClient.query('SELECT COUNT(*) FROM "Message"')

    console.log(`   用户: ${userCount.rows[0].count}`)
    console.log(`   对话: ${convCount.rows[0].count}`)
    console.log(`   消息: ${msgCount.rows[0].count}`)

  } catch (error) {
    console.error('\n❌ 迁移失败:', error)
    throw error
  } finally {
    sqliteDb.close()
    await pgClient.end()
  }
}

migrate()
