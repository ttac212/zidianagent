#!/usr/bin/env node

/**
 * 测试数据库优化效果
 * 使用真实用户数据进行测试，避免外键约束问题
 */

const { PrismaClient } = require('@prisma/client')

async function testOptimizations() {
  const prisma = new PrismaClient({
    log: ['warn', 'error']
  })

  try {
    console.log('🧪 开始测试数据库优化效果...\n')
    
    await prisma.$connect()
    console.log('✅ 数据库连接成功')

    // 1. 获取一个真实用户ID用于测试
    const realUser = await prisma.user.findFirst({
      select: { id: true, email: true }
    })

    if (!realUser) {
      console.log('⚠️  没有找到用户记录，无法进行测试')
      return
    }

    console.log(`📋 使用用户进行测试: ${realUser.email} (${realUser.id})`)

    // 2. 测试单个事务性能
    console.log('\n⏱️  测试单个事务性能:')
    const singleStart = Date.now()
    
    await testSingleTransaction(prisma, realUser.id)
    
    const singleTime = Date.now() - singleStart
    console.log(`   单次事务耗时: ${singleTime}ms`)

    // 3. 测试并发事务性能
    console.log('\n⚡ 测试并发事务性能:')
    const concurrentStart = Date.now()
    
    const concurrentPromises = []
    for (let i = 0; i < 5; i++) {
      concurrentPromises.push(testSingleTransaction(prisma, realUser.id))
    }

    const results = await Promise.allSettled(concurrentPromises)
    const concurrentTime = Date.now() - concurrentStart
    
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    
    console.log(`   并发测试结果: ${successful} 成功, ${failed} 失败`)
    console.log(`   并发总耗时: ${concurrentTime}ms`)
    console.log(`   平均单次耗时: ${Math.round(concurrentTime / 5)}ms`)

    // 4. 检查SQLite配置状态
    console.log('\n🔧 当前SQLite配置:')
    await checkSqliteConfig(prisma)

    // 5. 性能基准测试
    console.log('\n📊 性能基准测试:')
    await performanceBenchmark(prisma, realUser.id)

    console.log('\n🎉 数据库优化测试完成!')

  } catch (error) {
    console.error('❌ 测试失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

async function testSingleTransaction(prisma, userId) {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  
  const modelId = `test-model-${Date.now()}`
  
  return await prisma.$transaction([
    prisma.usageStats.upsert({
      where: {
        userId_date_modelId: {
          userId: userId,
          date: today,
          modelId: "_total"
        }
      },
      update: {
        apiCalls: { increment: 1 },
        successfulCalls: { increment: 1 },
        updatedAt: new Date(),
      },
      create: {
        userId: userId,
        date: today,
        modelId: "_total",
        apiCalls: 1,
        successfulCalls: 1,
        failedCalls: 0,
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
        messagesCreated: 1,
      }
    }),
    
    prisma.usageStats.upsert({
      where: {
        userId_date_modelId: {
          userId: userId,
          date: today,
          modelId: modelId
        }
      },
      update: {
        apiCalls: { increment: 1 },
        successfulCalls: { increment: 1 },
        updatedAt: new Date(),
      },
      create: {
        userId: userId,
        date: today,
        modelId: modelId,
        modelProvider: "claude",
        apiCalls: 1,
        successfulCalls: 1,
        failedCalls: 0,
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
        messagesCreated: 1,
      }
    })
  ], {
    maxWait: 15000,
    timeout: 45000,
    isolationLevel: 'Serializable'
  })
}

async function checkSqliteConfig(prisma) {
  const configs = [
    { name: 'journal_mode', sql: 'PRAGMA journal_mode' },
    { name: 'cache_size', sql: 'PRAGMA cache_size' },
    { name: 'synchronous', sql: 'PRAGMA synchronous' },
    { name: 'busy_timeout', sql: 'PRAGMA busy_timeout' },
    { name: 'temp_store', sql: 'PRAGMA temp_store' },
    { name: 'foreign_keys', sql: 'PRAGMA foreign_keys' }
  ]

  for (const config of configs) {
    try {
      const result = await prisma.$queryRawUnsafe(config.sql)
      const value = result[0] ? result[0][config.name] : 'undefined'
      console.log(`   ${config.name}: ${value}`)
    } catch (error) {
      console.log(`   ${config.name}: ERROR - ${error.message}`)
    }
  }
}

async function performanceBenchmark(prisma, userId) {
  const iterations = 10
  const times = []

  for (let i = 0; i < iterations; i++) {
    const start = Date.now()
    try {
      await testSingleTransaction(prisma, userId)
      times.push(Date.now() - start)
    } catch (error) {
      console.warn(`   迭代 ${i + 1} 失败:`, error.message)
    }
  }

  if (times.length > 0) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    const min = Math.min(...times)
    const max = Math.max(...times)
    
    console.log(`   ${iterations} 次测试统计:`)
    console.log(`   平均耗时: ${avg.toFixed(2)}ms`)
    console.log(`   最快: ${min}ms, 最慢: ${max}ms`)
    console.log(`   成功率: ${(times.length / iterations * 100).toFixed(1)}%`)
  } else {
    console.log('   ⚠️  所有测试都失败了')
  }
}

// 运行测试
if (require.main === module) {
  testOptimizations().catch(console.error)
}