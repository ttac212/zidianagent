/**
 * SQLite → Neon PostgreSQL 数据迁移脚本
 *
 * 使用方法：
 * 1. 确保 .env 中 DATABASE_URL 指向 Neon PostgreSQL
 * 2. 运行: npx tsx scripts/migrate-data-to-neon.ts
 */

import { PrismaClient as PostgresClient } from '@prisma/client'
import Database from 'better-sqlite3'
import path from 'path'

// SQLite 数据库路径
const SQLITE_PATH = path.join(process.cwd(), 'prisma', 'dev.db')

// Neon PostgreSQL 连接
const NEON_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_TbEjJ08aiPrv@ep-tiny-salad-a176fmm0.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'

console.log('📦 SQLite → Neon PostgreSQL 数据迁移')
console.log('=' .repeat(50))

// 初始化数据库连接
const sqlite = new Database(SQLITE_PATH, { readonly: true })
const postgres = new PostgresClient({
  datasources: { db: { url: NEON_URL } }
})

// 辅助函数：安全解析JSON
function safeParseJson(value: string | null): any {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

// 辅助函数：转换日期
function toDate(value: string | number | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return isNaN(date.getTime()) ? null : date
}

// 辅助函数：转换BigInt（处理小数）
function toBigInt(value: number | string | null): bigint {
  if (value === null || value === undefined) return BigInt(0)
  // 转换为整数（向下取整）
  const num = typeof value === 'string' ? parseFloat(value) : value
  return BigInt(Math.floor(num))
}

async function migrateUsers() {
  console.log('\n👤 迁移用户数据...')
  const users = sqlite.prepare('SELECT * FROM users').all() as any[]
  console.log(`   找到 ${users.length} 个用户`)

  let success = 0, skipped = 0
  for (const user of users) {
    try {
      // 处理username：如果为空或重复，使用null
      const username = user.username && user.username.trim() ? user.username : null

      await postgres.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email: user.email,
          emailVerified: toDate(user.emailVerified),
          username: username,
          displayName: user.displayName,
          avatar: user.avatar,
          role: user.role || 'USER',
          status: user.status || 'ACTIVE',
          monthlyTokenLimit: toBigInt(user.monthlyTokenLimit),
          currentMonthUsage: toBigInt(user.currentMonthUsage),
          totalTokenUsed: toBigInt(user.totalTokenUsed),
          lastResetAt: toDate(user.lastResetAt),
          createdAt: toDate(user.createdAt) || new Date(),
          updatedAt: toDate(user.updatedAt) || new Date(),
          lastActiveAt: toDate(user.lastActiveAt),
        },
        update: {
          // 如果已存在，更新这些字段
          displayName: user.displayName,
          role: user.role || 'USER',
          status: user.status || 'ACTIVE',
          monthlyTokenLimit: toBigInt(user.monthlyTokenLimit),
          currentMonthUsage: toBigInt(user.currentMonthUsage),
          totalTokenUsed: toBigInt(user.totalTokenUsed),
        }
      })
      success++
    } catch (e: any) {
      console.log(`   ⚠️ 跳过用户 ${user.email}: ${e.message?.slice(0, 80)}`)
      skipped++
    }
  }
  console.log(`   ✅ 成功: ${success}, 跳过: ${skipped}`)
}

async function migrateConversations() {
  console.log('\n💬 迁移对话数据...')
  const conversations = sqlite.prepare('SELECT * FROM conversations').all() as any[]
  console.log(`   找到 ${conversations.length} 个对话`)

  let success = 0, skipped = 0
  for (const conv of conversations) {
    try {
      await postgres.conversation.upsert({
        where: { id: conv.id },
        create: {
          id: conv.id,
          title: conv.title || '新对话',
          userId: conv.userId,
          modelId: conv.modelId || 'gpt-3.5-turbo',
          temperature: conv.temperature || 0.7,
          maxTokens: conv.maxTokens || 2000,
          contextAware: conv.contextAware === 1 || conv.contextAware === true,
          messageCount: conv.messageCount || 0,
          totalTokens: conv.totalTokens || 0,
          metadata: safeParseJson(conv.metadata),
          createdAt: toDate(conv.createdAt) || new Date(),
          updatedAt: toDate(conv.updatedAt) || new Date(),
          lastMessageAt: toDate(conv.lastMessageAt),
        },
        update: {}
      })
      success++
    } catch (e: any) {
      console.log(`   ⚠️ 跳过对话 ${conv.id}: ${e.message}`)
      skipped++
    }
  }
  console.log(`   ✅ 成功: ${success}, 跳过: ${skipped}`)
}

async function migrateMessages() {
  console.log('\n📝 迁移消息数据...')
  const messages = sqlite.prepare('SELECT * FROM messages').all() as any[]
  console.log(`   找到 ${messages.length} 条消息`)

  let success = 0, skipped = 0
  // 分批处理，每批100条
  const batchSize = 100
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize)
    for (const msg of batch) {
      try {
        await postgres.message.upsert({
          where: { id: msg.id },
          create: {
            id: msg.id,
            conversationId: msg.conversationId,
            userId: msg.userId,
            role: msg.role,
            content: msg.content || '',
            originalContent: msg.originalContent,
            promptTokens: msg.promptTokens || 0,
            completionTokens: msg.completionTokens || 0,
            modelId: msg.modelId || 'unknown',
            temperature: msg.temperature,
            finishReason: msg.finishReason,
            metadata: safeParseJson(msg.metadata),
            createdAt: toDate(msg.createdAt) || new Date(),
          },
          update: {}
        })
        success++
      } catch (e: any) {
        skipped++
      }
    }
    process.stdout.write(`\r   处理中: ${Math.min(i + batchSize, messages.length)}/${messages.length}`)
  }
  console.log(`\n   ✅ 成功: ${success}, 跳过: ${skipped}`)
}

async function migrateMerchants() {
  console.log('\n🏪 迁移商家数据...')
  const merchants = sqlite.prepare('SELECT * FROM merchants').all() as any[]
  console.log(`   找到 ${merchants.length} 个商家`)

  let success = 0, skipped = 0
  for (const m of merchants) {
    try {
      await postgres.merchant.upsert({
        where: { id: m.id },
        create: {
          id: m.id,
          uid: m.uid,
          name: m.name,
          description: m.description,
          categoryId: m.categoryId,
          location: m.location,
          address: m.address,
          contactInfo: safeParseJson(m.contactInfo),
          businessType: m.businessType || 'B2C',
          totalDiggCount: m.totalDiggCount || 0,
          totalCommentCount: m.totalCommentCount || 0,
          totalCollectCount: m.totalCollectCount || 0,
          totalShareCount: m.totalShareCount || 0,
          totalEngagement: m.totalEngagement || 0,
          totalContentCount: m.totalContentCount || 0,
          followerCount: m.followerCount || 0,
          totalPlayCount: toBigInt(m.totalPlayCount),
          avgEngagementRate: m.avgEngagementRate,
          dataSource: m.dataSource || 'douyin',
          lastCollectedAt: toDate(m.lastCollectedAt),
          monitoringEnabled: m.monitoringEnabled === 1 || m.monitoringEnabled === true,
          syncIntervalSeconds: m.syncIntervalSeconds || 21600,
          nextSyncAt: toDate(m.nextSyncAt),
          status: m.status || 'ACTIVE',
          isVerified: m.isVerified === 1 || m.isVerified === true,
          createdAt: toDate(m.createdAt) || new Date(),
          updatedAt: toDate(m.updatedAt) || new Date(),
        },
        update: {}
      })
      success++
    } catch (e: any) {
      console.log(`   ⚠️ 跳过商家 ${m.name}: ${e.message}`)
      skipped++
    }
  }
  console.log(`   ✅ 成功: ${success}, 跳过: ${skipped}`)
}

async function migrateMerchantContents() {
  console.log('\n📹 迁移商家内容...')
  const contents = sqlite.prepare('SELECT * FROM merchant_contents').all() as any[]
  console.log(`   找到 ${contents.length} 条内容`)

  let success = 0, skipped = 0
  const batchSize = 50
  for (let i = 0; i < contents.length; i += batchSize) {
    const batch = contents.slice(i, i + batchSize)
    for (const c of batch) {
      try {
        await postgres.merchantContent.upsert({
          where: { id: c.id },
          create: {
            id: c.id,
            merchantId: c.merchantId,
            externalId: c.externalId,
            title: c.title || '',
            content: c.content,
            transcript: c.transcript,
            contentType: c.contentType || 'VIDEO',
            duration: c.duration,
            shareUrl: c.shareUrl,
            hasTranscript: c.hasTranscript === 1 || c.hasTranscript === true,
            diggCount: c.diggCount || 0,
            commentCount: c.commentCount || 0,
            collectCount: c.collectCount || 0,
            shareCount: c.shareCount || 0,
            totalEngagement: c.totalEngagement || 0,
            playCount: c.playCount || 0,
            forwardCount: c.forwardCount || 0,
            likeRate: c.likeRate,
            commentRate: c.commentRate,
            completionRate: c.completionRate,
            avgWatchDuration: c.avgWatchDuration,
            isSuspicious: c.isSuspicious === 1 || c.isSuspicious === true,
            suspiciousReason: c.suspiciousReason,
            tags: c.tags || '[]',
            textExtra: c.textExtra || '[]',
            publishedAt: toDate(c.publishedAt),
            collectedAt: toDate(c.collectedAt) || new Date(),
            externalCreatedAt: toDate(c.externalCreatedAt),
            createdAt: toDate(c.createdAt) || new Date(),
            updatedAt: toDate(c.updatedAt) || new Date(),
          },
          update: {}
        })
        success++
      } catch (e: any) {
        skipped++
      }
    }
    process.stdout.write(`\r   处理中: ${Math.min(i + batchSize, contents.length)}/${contents.length}`)
  }
  console.log(`\n   ✅ 成功: ${success}, 跳过: ${skipped}`)
}

async function migrateMerchantContentComments() {
  console.log('\n💭 迁移评论数据...')
  const comments = sqlite.prepare('SELECT * FROM merchant_content_comments').all() as any[]
  console.log(`   找到 ${comments.length} 条评论`)

  let success = 0, skipped = 0
  const batchSize = 100
  for (let i = 0; i < comments.length; i += batchSize) {
    const batch = comments.slice(i, i + batchSize)
    for (const c of batch) {
      try {
        await postgres.merchantContentComment.upsert({
          where: { externalId: c.externalId },
          create: {
            id: c.id,
            contentId: c.contentId,
            externalId: c.externalId,
            text: c.text || '',
            authorName: c.authorName,
            authorUid: c.authorUid,
            diggCount: c.diggCount || 0,
            replyCount: c.replyCount || 0,
            isTop: c.isTop === 1 || c.isTop === true,
            keywords: c.keywords || '[]',
            createdAt: toDate(c.createdAt) || new Date(),
            collectedAt: toDate(c.collectedAt) || new Date(),
          },
          update: {}
        })
        success++
      } catch (e: any) {
        skipped++
      }
    }
    process.stdout.write(`\r   处理中: ${Math.min(i + batchSize, comments.length)}/${comments.length}`)
  }
  console.log(`\n   ✅ 成功: ${success}, 跳过: ${skipped}`)
}

async function migrateMerchantProfiles() {
  console.log('\n📋 迁移商家档案...')
  const profiles = sqlite.prepare('SELECT * FROM merchant_profiles').all() as any[]
  console.log(`   找到 ${profiles.length} 个档案`)

  let success = 0, skipped = 0
  for (const p of profiles) {
    try {
      await postgres.merchantProfile.upsert({
        where: { merchantId: p.merchantId },
        create: {
          id: p.id,
          merchantId: p.merchantId,
          briefIntro: p.briefIntro,
          briefSellingPoints: p.briefSellingPoints,
          briefUsageScenarios: p.briefUsageScenarios,
          briefAudienceProfile: p.briefAudienceProfile,
          briefBrandTone: p.briefBrandTone,
          manualBrief: safeParseJson(p.manualBrief),
          aiGeneratedAt: toDate(p.aiGeneratedAt),
          aiModelUsed: p.aiModelUsed,
          aiTokenUsed: p.aiTokenUsed || 0,
          customBackground: p.customBackground,
          customOfflineInfo: p.customOfflineInfo,
          customProductDetails: p.customProductDetails,
          customDosAndDonts: p.customDosAndDonts,
          manualNotes: p.manualNotes,
          createdAt: toDate(p.createdAt) || new Date(),
          updatedAt: toDate(p.updatedAt) || new Date(),
        },
        update: {}
      })
      success++
    } catch (e: any) {
      console.log(`   ⚠️ 跳过档案: ${e.message}`)
      skipped++
    }
  }
  console.log(`   ✅ 成功: ${success}, 跳过: ${skipped}`)
}

async function migrateMerchantAudienceAnalyses() {
  console.log('\n📊 迁移客群分析...')
  const analyses = sqlite.prepare('SELECT * FROM merchant_audience_analyses').all() as any[]
  console.log(`   找到 ${analyses.length} 条分析`)

  let success = 0, skipped = 0
  for (const a of analyses) {
    try {
      await postgres.merchantAudienceAnalysis.upsert({
        where: { merchantId: a.merchantId },
        create: {
          id: a.id,
          merchantId: a.merchantId,
          videosAnalyzed: a.videosAnalyzed || 0,
          commentsAnalyzed: a.commentsAnalyzed || 0,
          videoIds: a.videoIds || '[]',
          locationStats: a.locationStats,
          audienceProfile: a.audienceProfile,
          demographics: a.demographics,
          behaviors: a.behaviors,
          interests: a.interests,
          painPoints: a.painPoints,
          suggestions: a.suggestions,
          rawMarkdown: a.rawMarkdown,
          manualMarkdown: a.manualMarkdown,
          manualInsights: safeParseJson(a.manualInsights),
          analyzedAt: toDate(a.analyzedAt) || new Date(),
          modelUsed: a.modelUsed || 'unknown',
          tokenUsed: a.tokenUsed || 0,
        },
        update: {}
      })
      success++
    } catch (e: any) {
      console.log(`   ⚠️ 跳过分析: ${e.message}`)
      skipped++
    }
  }
  console.log(`   ✅ 成功: ${success}, 跳过: ${skipped}`)
}

async function migrateUsageStats() {
  console.log('\n📈 迁移使用统计...')
  const stats = sqlite.prepare('SELECT * FROM usage_stats').all() as any[]
  console.log(`   找到 ${stats.length} 条统计`)

  let success = 0, skipped = 0
  for (const s of stats) {
    try {
      await postgres.usageStats.upsert({
        where: {
          userId_date_modelId: {
            userId: s.userId,
            date: toDate(s.date) || new Date(),
            modelId: s.modelId || '_total'
          }
        },
        create: {
          id: s.id,
          userId: s.userId,
          date: toDate(s.date) || new Date(),
          modelId: s.modelId || '_total',
          modelProvider: s.modelProvider,
          apiCalls: s.apiCalls || 0,
          successfulCalls: s.successfulCalls || 0,
          failedCalls: s.failedCalls || 0,
          promptTokens: s.promptTokens || 0,
          completionTokens: s.completionTokens || 0,
          conversationsCreated: s.conversationsCreated || 0,
          messagesCreated: s.messagesCreated || 0,
          totalActiveTime: s.totalActiveTime || 0,
          createdAt: toDate(s.createdAt) || new Date(),
          updatedAt: toDate(s.updatedAt) || new Date(),
        },
        update: {}
      })
      success++
    } catch (e: any) {
      skipped++
    }
  }
  console.log(`   ✅ 成功: ${success}, 跳过: ${skipped}`)
}

async function main() {
  try {
    console.log(`\n🔗 SQLite: ${SQLITE_PATH}`)
    console.log(`🔗 Neon: ${NEON_URL.replace(/:[^:@]+@/, ':****@')}`)

    // 按依赖顺序迁移
    await migrateUsers()
    await migrateConversations()
    await migrateMessages()
    await migrateMerchants()
    await migrateMerchantContents()
    await migrateMerchantContentComments()
    await migrateMerchantProfiles()
    await migrateMerchantAudienceAnalyses()
    await migrateUsageStats()

    console.log('\n' + '=' .repeat(50))
    console.log('✅ 数据迁移完成！')

  } catch (error) {
    console.error('\n❌ 迁移失败:', error)
    process.exit(1)
  } finally {
    sqlite.close()
    await postgres.$disconnect()
  }
}

main()
