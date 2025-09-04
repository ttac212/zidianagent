// 测试按模型统计的upsert操作
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testModelUpsert() {
  try {
    // 获取一个测试用户
    const testUser = await prisma.user.findFirst({
      where: {
        email: {
          contains: 'hi@2308.com'
        }
      }
    })

    if (!testUser) {
      return
    }

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const testModel = 'claude-opus-4-1-20250805'
    const testProvider = 'Claude'

    .split('T')[0]}`)
    // 1. 尝试创建按模型的统计记录
    try {
      const modelStat = await prisma.usageStats.upsert({
        where: {
          userId_date_modelId: {
            userId: testUser.id,
            date: today,
            modelId: testModel
          }
        },
        update: {
          totalTokens: { increment: 100 },
          apiCalls: { increment: 1 },
          updatedAt: new Date()
        },
        create: {
          userId: testUser.id,
          date: today,
          modelId: testModel,
          modelProvider: testProvider,
          totalTokens: 100,
          apiCalls: 1,
        }
      })
      } catch (error) {
      // 尝试其他可能的约束名称
      try {
        const directCreate = await prisma.usageStats.create({
          data: {
            userId: testUser.id,
            date: today,
            modelId: testModel,
            modelProvider: testProvider,
            totalTokens: 50,
            apiCalls: 1,
          }
        })
        } catch (createError) {
        }
    }

    // 2. 检查现有的统计记录
    const existingStats = await prisma.usageStats.findMany({
      where: {
        userId: testUser.id,
        date: today
      }
    })
    
    existingStats.forEach((stat, index) => {
      '} - ${stat.totalTokens}tokens`)
    })

    // 3. 测试查询约束信息
    const conflictCheck = await prisma.usageStats.findUnique({
      where: {
        userId_date_modelId: {
          userId: testUser.id,
          date: today,
          modelId: testModel
        }
      }
    })
    
    if (conflictCheck) {
      } else {
      }

  } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

testModelUpsert().catch(console.error)