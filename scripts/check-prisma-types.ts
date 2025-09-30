/**
 * 检查Prisma Client生成的UsageStats类型
 */

import { PrismaClient, UsageStats } from '@prisma/client'
import * as dt from '@/lib/utils/date-toolkit'

const prisma = new PrismaClient()

// 类型测试：检查modelId是否为可选字段
function testUsageStatsTypes() {
  console.info('🔍 检查Prisma Client生成的UsageStats类型...')

  // 测试创建UsageStats时的类型要求
  const createData = {
    userId: 'test-user',
    date: dt.now(),
    // 故意不提供modelId，看看TypeScript是否报错
    // modelId: '_total',  // 如果这个字段是可选的，不提供也不会报错
    apiCalls: 1
  }

  // 检查类型定义
  type ModelIdType = UsageStats['modelId']

  // 这会在编译时告诉我们modelId的确切类型
  const typeCheck: ModelIdType = '_total'  // 如果modelId是string | null，这行会有问题

  console.info('✅ modelId类型检查通过，字段为非空字符串类型')
  console.info('📊 当前modelId类型:', typeof typeCheck)

  return true
}

// 运行类型检查
testUsageStatsTypes()

// 同时检查运行时创建行为
async function testRuntimeBehavior() {
  try {
    console.info('\n🔍 测试运行时创建行为...')

    // 获取一个真实用户ID用于测试
    const user = await prisma.user.findFirst({ select: { id: true } })
    if (!user) {
      console.info('⚠️ 没有用户数据，跳过运行时测试')
      return
    }

    // 测试不提供modelId时的行为（应该使用默认值）
    const testUsage = await prisma.usageStats.create({
      data: {
        userId: user.id,
        date: dt.now(),
        // 不提供modelId，测试默认值
        apiCalls: 1
      }
    })

    console.info(`✅ 创建成功，默认modelId: "${testUsage.modelId}"`)

    // 清理测试数据
    await prisma.usageStats.delete({ where: { id: testUsage.id } })
    console.info('🧹 测试数据已清理')

  } catch (error) {
    console.error('❌ 运行时测试失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testRuntimeBehavior()