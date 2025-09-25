/**
 * 验证数据库索引是否正确应用
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function verifyIndexes() {
  console.log('🔍 验证数据库索引...')

  try {
    // 查看conversations表的索引
    const indexes = await prisma.$queryRaw`
      SELECT name, sql FROM sqlite_master
      WHERE type='index' AND tbl_name='conversations'
      ORDER BY name;
    `

    console.log('\n📊 Conversations表的索引:')
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${index.sql || 'PRIMARY KEY'}`)
    })

    // 测试查询计划
    console.log('\n🔍 查询执行计划测试:')

    // 测试1: 按userId和lastMessageAt排序的查询
    const plan1 = await prisma.$queryRaw`
      EXPLAIN QUERY PLAN
      SELECT * FROM conversations
      WHERE userId = 'test-user'
      ORDER BY lastMessageAt DESC
      LIMIT 20;
    `

    console.log('\n📈 查询1 (userId + lastMessageAt排序):')
    plan1.forEach(step => {
      console.log(`  ${step.detail}`)
    })

    // 测试2: 只按userId查询
    const plan2 = await prisma.$queryRaw`
      EXPLAIN QUERY PLAN
      SELECT * FROM conversations
      WHERE userId = 'test-user';
    `

    console.log('\n📈 查询2 (仅userId):')
    plan2.forEach(step => {
      console.log(`  ${step.detail}`)
    })

    // 检查是否使用了正确的索引
    const hasCorrectIndex = indexes.some(idx =>
      idx.sql && idx.sql.includes('userId') && idx.sql.includes('lastMessageAt')
    )

    if (hasCorrectIndex) {
      console.log('\n✅ 复合索引 [userId, lastMessageAt] 已正确创建')
    } else {
      console.log('\n❌ 复合索引 [userId, lastMessageAt] 缺失！')
    }

  } catch (error) {
    console.error('❌ 验证索引失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyIndexes()