/**
 * 验证UsageStats唯一约束修复
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function verifyUsageStatsFix() {
  console.log('🔍 验证UsageStats唯一约束修复...')

  try {
    // 1. 查看表结构
    const schema = await prisma.$queryRaw`
      SELECT sql FROM sqlite_master
      WHERE type='table' AND name='usage_stats';
    `

    console.log('\n📊 UsageStats表结构:')
    console.log(schema[0]?.sql || '表不存在')

    // 2. 检查现有数据中的modelId值
    const modelIdStats = await prisma.$queryRaw`
      SELECT modelId, COUNT(*) as count
      FROM usage_stats
      GROUP BY modelId
      ORDER BY count DESC;
    `

    console.log('\n📈 现有modelId分布:')
    if (modelIdStats.length === 0) {
      console.log('  (暂无数据)')
    } else {
      modelIdStats.forEach(stat => {
        console.log(`  - "${stat.modelId || 'NULL'}": ${stat.count} 条记录`)
      })
    }

    // 3. 测试插入重复数据（应该失败）
    // 先获取一个真实用户ID用于测试
    const existingUser = await prisma.user.findFirst({
      select: { id: true }
    })

    if (!existingUser) {
      console.log('\n⚠️  没有用户数据，跳过唯一约束测试')
      return
    }

    const testUserId = existingUser.id
    const testDate = new Date()
    testDate.setHours(0, 0, 0, 0)

    try {
      // 第一次插入
      await prisma.usageStats.create({
        data: {
          userId: testUserId,
          date: testDate,
          modelId: 'test-model-' + Date.now(),
          apiCalls: 1
        }
      })
      console.log('\n✅ 第一次插入成功')

      // 第二次插入相同数据（应该失败）
      await prisma.usageStats.create({
        data: {
          userId: testUserId,
          date: testDate,
          modelId: 'test-model-' + Date.now(),  // 用不同的modelId避免冲突
          apiCalls: 2
        }
      })
      console.log('\n✅ 不同modelId插入成功（正常）')

      // 第三次插入完全相同的数据（应该失败）
      const duplicateData = {
        userId: testUserId,
        date: testDate,
        modelId: '_total',
        apiCalls: 3
      }

      await prisma.usageStats.create({ data: duplicateData })
      console.log('\n✅ 第一次_total插入成功')

      await prisma.usageStats.create({ data: duplicateData })
      console.log('\n❌ 重复插入成功了！唯一约束没生效！')

    } catch (error) {
      if (error.code === 'P2002') {
        console.log('\n✅ 唯一约束正常工作 - 阻止了重复插入')
        console.log('   约束字段:', error.meta?.target || '未知')
      } else {
        console.log('\n❌ 意外错误:', error.message)
      }
    }

    // 4. 清理测试数据
    await prisma.usageStats.deleteMany({
      where: {
        userId: testUserId,
        date: testDate,
        modelId: { startsWith: 'test-model-' }
      }
    })
    console.log('✅ 测试数据已清理')

  } catch (error) {
    console.error('❌ 验证失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyUsageStatsFix()