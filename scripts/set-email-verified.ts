#!/usr/bin/env tsx
const { Client } = require('pg')

async function setEmailVerified() {
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL })
  await pgClient.connect()

  try {
    // 为所有emailVerified为null的用户设置当前时间
    const result = await pgClient.query(`
      UPDATE users
      SET "emailVerified" = NOW()
      WHERE "emailVerified" IS NULL
      RETURNING email, "displayName"
    `)

    console.log(`✅ 成功设置 ${result.rows.length} 个用户的邮箱验证状态\n`)

    if (result.rows.length > 0) {
      console.log('已更新的用户:')
      result.rows.forEach((u: any, i: number) => {
        console.log(`${i + 1}. ${u.email} - ${u.displayName || '未设置'}`)
      })
    }

    // 验证结果
    const checkResult = await pgClient.query(`
      SELECT COUNT(*) as total,
             COUNT("emailVerified") as verified
      FROM users
    `)

    console.log('\n📊 验证结果:')
    console.log(`总用户数: ${checkResult.rows[0].total}`)
    console.log(`已验证: ${checkResult.rows[0].verified}`)

  } finally {
    await pgClient.end()
  }
}

setEmailVerified()
