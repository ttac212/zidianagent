#!/usr/bin/env node

/**
 * 数据库调试脚本
 * 检查SQLite配置和事务处理问题
 */

const { PrismaClient } = require('@prisma/client')

async function debugDatabase() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error']
  })

  try {
    console.log('🔍 数据库连接调试开始...')
    
    // 1. 检查基本连接
    console.log('\n1. 检查数据库连接状态:')
    await prisma.$connect()
    console.log('✅ 数据库连接成功')

    // 2. 检查SQLite配置
    console.log('\n2. 检查SQLite配置:')
    const pragmas = [
      'PRAGMA journal_mode',
      'PRAGMA synchronous', 
      'PRAGMA cache_size',
      'PRAGMA temp_store',
      'PRAGMA mmap_size',
      'PRAGMA busy_timeout',
      'PRAGMA wal_autocheckpoint'
    ]

    for (const pragma of pragmas) {
      try {
        const result = await prisma.$queryRaw`${pragma}`
        console.log(`${pragma}: ${JSON.stringify(result)}`)
      } catch (error) {
        console.log(`${pragma}: ERROR - ${error.message}`)
      }
    }

    // 3. 检查表状态
    console.log('\n3. 检查表结构:')
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `
    console.log('数据库表:', tables.map(t => t.name).join(', '))

    // 4. 模拟事务并发测试
    console.log('\n4. 测试事务并发:')
    const startTime = Date.now()
    
    // 创建多个并发事务
    const promises = []
    for (let i = 0; i < 5; i++) {
      promises.push(testTransaction(prisma, i))
    }

    const results = await Promise.allSettled(promises)
    const successCount = results.filter(r => r.status === 'fulfilled').length
    const failureCount = results.filter(r => r.status === 'rejected').length
    
    console.log(`并发测试结果: ${successCount} 成功, ${failureCount} 失败`)
    console.log(`总耗时: ${Date.now() - startTime}ms`)

    // 5. 检查usage_stats表的唯一约束
    console.log('\n5. 检查usage_stats表约束:')
    const indexInfo = await prisma.$queryRaw`
      SELECT * FROM sqlite_master WHERE type='index' AND tbl_name='usage_stats'
    `
    console.log('usage_stats索引:', indexInfo)

  } catch (error) {
    console.error('❌ 数据库调试失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

async function testTransaction(prisma, id) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 模拟usage_stats upsert操作
      const userId = `test-user-${id}`
      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)
      
      await tx.usageStats.upsert({
        where: {
          userId_date_modelId: {
            userId: userId,
            date: today,
            modelId: "_total"
          }
        },
        update: {
          apiCalls: { increment: 1 }
        },
        create: {
          userId: userId,
          date: today,
          modelId: "_total",
          apiCalls: 1,
          successfulCalls: 1,
          failedCalls: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          messagesCreated: 0,
        }
      })
      
      return `Transaction ${id} completed`
    }, {
      maxWait: 5000,
      timeout: 10000
    })
    
    console.log(`✅ ${result}`)
    return result
  } catch (error) {
    console.log(`❌ Transaction ${id} failed:`, error.message)
    throw error
  }
}

// 运行调试
debugDatabase().catch(console.error)