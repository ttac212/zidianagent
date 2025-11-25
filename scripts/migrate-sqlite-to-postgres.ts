#!/usr/bin/env tsx
/**
 * SQLite到PostgreSQL数据迁移工具
 * 自动处理表结构和数据转换
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const NEON_URL = process.env.DATABASE_URL || ''

if (!NEON_URL) {
  console.error('❌ 错误: 请设置 DATABASE_URL 环境变量')
  process.exit(1)
}

console.log('🚀 开始SQLite到PostgreSQL迁移...\n')

try {
  // 1. 使用prisma db pull从SQLite导出schema
  console.log('📋 步骤1: 导出SQLite数据库结构...')
  execSync('npx prisma db pull', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: 'file:./prisma/dev.db'
    }
  })
  console.log('✅ 数据库结构导出完成\n')

  // 2. 生成SQL转储文件
  console.log('📋 步骤2: 生成SQL转储文件...')

  // 创建临时目录
  const tmpDir = path.join(process.cwd(), 'tmp')
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true })
  }

  const dumpFile = path.join(tmpDir, 'sqlite-dump.sql')

  // 使用better-sqlite3导出数据
  const sqlite3 = require('better-sqlite3')
  const db = sqlite3('./prisma/dev.db', { readonly: true })

  const sqlStatements: string[] = []

  // 获取所有表
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    AND name NOT LIKE '_prisma%'
  `).all()

  console.log(`   找到 ${tables.length} 个表\n`)

  for (const { name: tableName } of tables) {
    console.log(`   导出表: ${tableName}`)

    // 获取表数据
    const rows = db.prepare(`SELECT * FROM ${tableName}`).all()

    if (rows.length === 0) {
      console.log(`     (空表,跳过)`)
      continue
    }

    console.log(`     ${rows.length} 条记录`)

    // 生成INSERT语句
    for (const row of rows) {
      const columns = Object.keys(row)
      const values = Object.values(row).map(v => {
        if (v === null) return 'NULL'
        if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`
        if (typeof v === 'boolean') return v ? 'true' : 'false'
        return v
      })

      sqlStatements.push(
        `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;`
      )
    }
  }

  db.close()

  // 写入SQL文件
  fs.writeFileSync(dumpFile, sqlStatements.join('\n'))
  console.log(`\n✅ SQL转储文件已生成: ${dumpFile}`)
  console.log(`   总计 ${sqlStatements.length} 条INSERT语句\n`)

  // 3. 导入到PostgreSQL
  console.log('📋 步骤3: 导入数据到PostgreSQL...')
  console.log('   这可能需要几分钟，请耐心等待...\n')

  // 解析连接字符串
  const urlMatch = NEON_URL.match(/postgresql:\/\/([^:]+):([^@]+)@([^\/]+)\/([^\?]+)/)
  if (!urlMatch) {
    throw new Error('无效的DATABASE_URL格式')
  }

  const [, username, password, host, database] = urlMatch

  // 使用psql导入
  const psqlCmd = `PGPASSWORD="${password}" psql -h ${host.split(':')[0]} -U ${username} -d ${database} -f "${dumpFile}"`

  execSync(psqlCmd, { stdio: 'inherit' })

  console.log('\n✅ 数据导入完成！\n')

  // 4. 清理临时文件
  console.log('📋 步骤4: 清理临时文件...')
  fs.unlinkSync(dumpFile)
  console.log('✅ 清理完成\n')

  console.log('🎉 迁移成功完成！')

} catch (error) {
  console.error('\n❌ 迁移失败:', error)
  process.exit(1)
}
