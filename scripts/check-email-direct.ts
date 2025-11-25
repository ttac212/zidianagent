#!/usr/bin/env tsx
const { Client } = require('pg')

async function checkEmailVerified() {
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL })
  await pgClient.connect()

  try {
    const result = await pgClient.query(`
      SELECT email, "emailVerified", "displayName", role
      FROM users
      ORDER BY "createdAt" DESC
    `)

    console.log(`📊 找到 ${result.rows.length} 个用户\n`)

    const verified = result.rows.filter((u: any) => u.emailVerified !== null)
    const unverified = result.rows.filter((u: any) => u.emailVerified === null)

    console.log(`✅ 已验证邮箱: ${verified.length}`)
    console.log(`❌ 未验证邮箱: ${unverified.length}\n`)

    if (unverified.length > 0) {
      console.log('❌ 未验证的用户（无法登录）:')
      unverified.forEach((u: any, i: number) => {
        console.log(`${i + 1}. ${u.email} - ${u.displayName || '未设置'} (${u.role})`)
      })
      console.log('\n需要为这些用户设置emailVerified字段才能登录！')
    }
  } finally {
    await pgClient.end()
  }
}

checkEmailVerified()
