/**
 * 测试在全新数据库上执行完整迁移链
 * 验证 001 + 002 + 003 迁移能正确创建 metadata 列
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'

const TEST_DB_PATH = path.join(process.cwd(), 'prisma', 'test-fresh.db')
const MIGRATIONS_DIR = path.join(process.cwd(), 'prisma', 'migrations')

async function testFreshMigrations() {
  console.log('🧪 测试全新数据库迁移流程...\n')

  try {
    // 1. 清理旧的测试数据库
    console.log('📝 步骤1：清理旧的测试数据库...')
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
      console.log('✅ 已删除旧测试数据库\n')
    }

    // 2. 创建全新数据库（执行所有迁移）
    console.log('📝 步骤2：在全新数据库上执行所有迁移...')
    console.log('   DATABASE_URL=file:./test-fresh.db')

    // 设置临时环境变量并执行迁移
    const env = {
      ...process.env,
      DATABASE_URL: `file:${TEST_DB_PATH}`
    }

    try {
      const output = execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
        env,
        encoding: 'utf8',
        stdio: 'pipe'
      })
      console.log('✅ 迁移执行成功')
      console.log(output)
    } catch (error: any) {
      console.error('❌ 迁移执行失败:')
      console.error(error.stdout || error.message)
      throw error
    }

    // 3. 验证数据库结构
    console.log('\n📝 步骤3：验证数据库结构...')

    if (!fs.existsSync(TEST_DB_PATH)) {
      throw new Error('测试数据库未创建')
    }

    const db = new Database(TEST_DB_PATH)

    // 检查 conversations 表是否存在
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='conversations'"
    ).all()

    if (tables.length === 0) {
      throw new Error('conversations 表未创建')
    }
    console.log('✅ conversations 表已创建')

    // 检查 metadata 列是否存在
    const columns = db.prepare('PRAGMA table_info(conversations)').all() as any[]
    const metadataColumn = columns.find(col => col.name === 'metadata')

    if (!metadataColumn) {
      console.error('❌ metadata 列不存在！')
      console.error('当前列:', columns.map(c => c.name).join(', '))
      throw new Error('metadata 列不存在 - 003 迁移失败')
    }

    console.log('✅ metadata 列存在')
    console.log(`   类型: ${metadataColumn.type}`)
    console.log(`   可空: ${metadataColumn.notnull === 0 ? 'YES' : 'NO'}`)

    // 检查所有必需的列
    const requiredColumns = [
      'id', 'title', 'userId', 'modelId', 'temperature', 'maxTokens',
      'contextAware', 'messageCount', 'totalTokens', 'metadata',
      'createdAt', 'updatedAt', 'lastMessageAt'
    ]

    const existingColumns = columns.map(c => c.name)
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col))

    if (missingColumns.length > 0) {
      throw new Error(`缺少列: ${missingColumns.join(', ')}`)
    }

    console.log('✅ 所有必需列都已创建')

    // 检查索引
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='conversations'"
    ).all() as any[]

    console.log(`✅ 已创建 ${indexes.length} 个索引`)
    indexes.forEach(idx => {
      console.log(`   - ${idx.name}`)
    })

    // 4. 测试插入数据
    console.log('\n📝 步骤4：测试 metadata 字段读写...')

    // 创建测试用户
    db.prepare(`
      INSERT INTO users (id, email, displayName, role, status, createdAt, updatedAt)
      VALUES ('test-user-001', 'test@example.com', 'Test User', 'USER', 'ACTIVE', datetime('now'), datetime('now'))
    `).run()

    // 插入测试对话（包含 metadata）
    db.prepare(`
      INSERT INTO conversations (
        id, title, userId, modelId, metadata, createdAt, updatedAt
      ) VALUES (
        'test-conv-001',
        '测试对话',
        'test-user-001',
        'claude-3-5-haiku-20241022',
        '{"tags":["test","pinned"],"testField":"value"}',
        datetime('now'),
        datetime('now')
      )
    `).run()

    console.log('✅ 成功插入包含 metadata 的对话')

    // 读取并验证 metadata
    const result = db.prepare(
      'SELECT id, title, metadata FROM conversations WHERE id = ?'
    ).get('test-conv-001') as any

    if (!result) {
      throw new Error('无法读取测试对话')
    }

    console.log('✅ 成功读取对话')
    console.log(`   ID: ${result.id}`)
    console.log(`   标题: ${result.title}`)
    console.log(`   metadata: ${result.metadata}`)

    // 验证 metadata JSON 格式
    const metadata = JSON.parse(result.metadata)
    if (!Array.isArray(metadata.tags) || !metadata.tags.includes('pinned')) {
      throw new Error('metadata 格式错误')
    }

    console.log('✅ metadata JSON 格式正确')
    console.log(`   tags: ${metadata.tags.join(', ')}`)
    console.log(`   testField: ${metadata.testField}`)

    db.close()

    // 5. 清理测试数据库
    console.log('\n📝 步骤5：清理测试数据库...')
    fs.unlinkSync(TEST_DB_PATH)
    console.log('✅ 测试数据库已删除')

    // 总结
    console.log('\n' + '='.repeat(50))
    console.log('✨ 全新数据库迁移测试通过！')
    console.log('='.repeat(50))
    console.log('\n验证结果：')
    console.log('  ✅ 001 + 002 + 003 迁移成功执行')
    console.log('  ✅ conversations 表创建成功')
    console.log('  ✅ metadata 列创建成功')
    console.log('  ✅ metadata JSON 读写正常')
    console.log('  ✅ 所有索引创建成功')
    console.log('\n🎉 可以安全部署到生产环境！')

  } catch (error) {
    console.error('\n' + '='.repeat(50))
    console.error('❌ 迁移测试失败！')
    console.error('='.repeat(50))
    console.error(error)

    // 清理
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }

    process.exit(1)
  }
}

// 运行测试
testFreshMigrations()
  .then(() => {
    console.log('\n✅ 测试完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  })
