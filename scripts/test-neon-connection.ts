#!/usr/bin/env tsx
/**
 * 测试和唤醒 Neon 数据库连接
 */

const { Client } = require('pg')

async function testConnection() {
  console.log('🔍 测试 Neon 数据库连接...\n')

  const DATABASE_URL = process.env.DATABASE_URL

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL 环境变量未设置')
    process.exit(1)
  }

  console.log('📋 连接信息:')
  // 隐藏密码显示
  const safeUrl = DATABASE_URL.replace(/:([^:@]+)@/, ':****@')
  console.log(`   ${safeUrl}\n`)

  const client = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 10000, // 10秒超时
  })

  try {
    console.log('⏳ 正在连接...')
    await client.connect()
    console.log('✅ 连接成功！\n')

    // 测试查询
    console.log('📊 测试查询...')
    const result = await client.query('SELECT COUNT(*) as count FROM users')
    console.log(`✅ 用户数量: ${result.rows[0].count}\n`)

    // 显示数据库版本
    const versionResult = await client.query('SELECT version()')
    console.log('📌 PostgreSQL 版本:')
    console.log(`   ${versionResult.rows[0].version}\n`)

    console.log('🎉 数据库连接正常！')

  } catch (error: any) {
    console.error('\n❌ 连接失败:\n')
    console.error(`错误类型: ${error.name}`)
    console.error(`错误信息: ${error.message}`)

    if (error.code) {
      console.error(`错误代码: ${error.code}`)
    }

    console.error('\n💡 可能的解决方案:')
    console.error('1. 检查 DATABASE_URL 是否包含 ?sslmode=require 参数')
    console.error('2. 确认 Neon 数据库未被暂停（访问 Neon 控制台唤醒）')
    console.error('3. 检查网络连接是否正常')
    console.error('4. 确认 DATABASE_URL 格式正确')

    process.exit(1)
  } finally {
    await client.end()
  }
}

testConnection()
