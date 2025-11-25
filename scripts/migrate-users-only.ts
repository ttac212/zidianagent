#!/usr/bin/env tsx
/**
 * 只迁移用户数据
 */

const sqlite3 = require('better-sqlite3')
const { Client } = require('pg')

async function migrateUsers() {
  console.log('🔄 开始迁移用户数据...\n')

  const sqliteDb = sqlite3('./prisma/dev.db', { readonly: true })
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL })

  await pgClient.connect()

  try {
    const users = sqliteDb.prepare('SELECT * FROM users').all()
    console.log(`📊 找到 ${users.length} 个用户\n`)

    let inserted = 0
    for (const user of users) {
      try {
        await pgClient.query(
          `INSERT INTO "users" (id, email, "emailVerified", username, "displayName", avatar, role, status, "monthlyTokenLimit", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING`,
          [
            user.id,
            user.email,
            user.emailVerified ? new Date(user.emailVerified) : null,
            user.username,
            user.displayName,
            user.image,  // SQLite中是image字段,映射到PostgreSQL的avatar
            user.role,
            user.status,
            user.monthlyTokenLimit,
            new Date(user.createdAt),
            new Date(user.updatedAt)
          ]
        )
        inserted++
        console.log(`✅ ${user.email}`)
      } catch (err) {
        console.log(`❌ ${user.email}: ${err.message}`)
      }
    }

    console.log(`\n🎉 成功导入 ${inserted}/${users.length} 个用户！`)
  } finally {
    sqliteDb.close()
    await pgClient.end()
  }
}

migrateUsers()
