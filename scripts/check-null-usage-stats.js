/**
 * 检查UsageStats表中是否还有NULL的modelId值
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkNullUsageStats() {
  console.log('🔍 检查UsageStats表中的NULL值...')

  try {
    // 检查是否有NULL的modelId
    const nullModelIds = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM usage_stats
      WHERE modelId IS NULL;
    `

    console.log(`📊 modelId为NULL的记录数: ${nullModelIds[0]?.count || 0}`)

    if (nullModelIds[0]?.count > 0) {
      console.log('\n🚨 发现NULL值！需要清理')

      // 显示样本数据
      const samples = await prisma.$queryRaw`
        SELECT id, userId, date, modelId, modelProvider
        FROM usage_stats
        WHERE modelId IS NULL
        LIMIT 5;
      `

      console.log('📋 样本数据:')
      samples.forEach((row, i) => {
        console.log(`  ${i + 1}. ID: ${row.id}, 用户: ${row.userId}, 日期: ${row.date}`)
      })

      return false
    } else {
      console.log('✅ 没有发现NULL值')
      return true
    }

  } catch (error) {
    console.error('❌ 检查失败:', error)
    return false
  } finally {
    await prisma.$disconnect()
  }
}

checkNullUsageStats()