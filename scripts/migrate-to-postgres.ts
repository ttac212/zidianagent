#!/usr/bin/env tsx
/**
 * 迁移SQLite数据到PostgreSQL
 * 用法: DATABASE_URL="postgresql://..." npx tsx scripts/migrate-to-postgres.ts
 */

import { PrismaClient as SQLiteClient } from '@prisma/client'
import { PrismaClient as PostgresClient } from '@prisma/client'

const sqliteDb = new SQLiteClient({
  datasources: {
    db: {
      url: 'file:./prisma/dev.db'
    }
  }
})

const postgresDb = new PostgresClient()

async function migrate() {
  console.log('🔄 开始数据迁移...\n')

  try {
    // 1. 迁移用户数据
    console.log('📊 迁移用户数据...')
    const users = await sqliteDb.user.findMany()
    console.log(`   找到 ${users.length} 个用户`)

    for (const user of users) {
      await postgresDb.user.upsert({
        where: { id: user.id },
        update: user,
        create: user
      })
    }
    console.log('   ✅ 用户数据迁移完成\n')

    // 2. 迁移对话数据
    console.log('📊 迁移对话数据...')
    const conversations = await sqliteDb.conversation.findMany()
    console.log(`   找到 ${conversations.length} 个对话`)

    for (const conv of conversations) {
      await postgresDb.conversation.upsert({
        where: { id: conv.id },
        update: conv,
        create: conv
      })
    }
    console.log('   ✅ 对话数据迁移完成\n')

    // 3. 迁移消息数据
    console.log('📊 迁移消息数据...')
    const messages = await sqliteDb.message.findMany()
    console.log(`   找到 ${messages.length} 条消息`)

    let migratedCount = 0
    for (const msg of messages) {
      await postgresDb.message.upsert({
        where: { id: msg.id },
        update: msg,
        create: msg
      })
      migratedCount++
      if (migratedCount % 100 === 0) {
        console.log(`   已迁移 ${migratedCount}/${messages.length} 条消息...`)
      }
    }
    console.log('   ✅ 消息数据迁移完成\n')

    // 4. 迁移商家数据
    console.log('📊 迁移商家数据...')
    const merchants = await sqliteDb.merchant.findMany()
    console.log(`   找到 ${merchants.length} 个商家`)

    for (const merchant of merchants) {
      await postgresDb.merchant.upsert({
        where: { id: merchant.id },
        update: merchant,
        create: merchant
      })
    }
    console.log('   ✅ 商家数据迁移完成\n')

    // 5. 迁移商家内容数据
    console.log('📊 迁移商家内容数据...')
    const contents = await sqliteDb.merchantContent.findMany()
    console.log(`   找到 ${contents.length} 条内容`)

    for (const content of contents) {
      await postgresDb.merchantContent.upsert({
        where: { id: content.id },
        update: content,
        create: content
      })
    }
    console.log('   ✅ 商家内容数据迁移完成\n')

    // 6. 迁移使用量统计
    console.log('📊 迁移使用量统计...')
    const usageStats = await sqliteDb.usageStats.findMany()
    console.log(`   找到 ${usageStats.length} 条统计记录`)

    for (const stat of usageStats) {
      await postgresDb.usageStats.upsert({
        where: {
          userId_date_modelId: {
            userId: stat.userId,
            date: stat.date,
            modelId: stat.modelId
          }
        },
        update: stat,
        create: stat
      })
    }
    console.log('   ✅ 使用量统计迁移完成\n')

    console.log('🎉 数据迁移完成！')
    console.log('\n📊 迁移摘要:')
    console.log(`   用户: ${users.length}`)
    console.log(`   对话: ${conversations.length}`)
    console.log(`   消息: ${messages.length}`)
    console.log(`   商家: ${merchants.length}`)
    console.log(`   内容: ${contents.length}`)
    console.log(`   统计: ${usageStats.length}`)

  } catch (error) {
    console.error('❌ 迁移失败:', error)
    process.exit(1)
  } finally {
    await sqliteDb.$disconnect()
    await postgresDb.$disconnect()
  }
}

migrate()
