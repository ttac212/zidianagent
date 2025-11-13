/**
 * 测试数据库查询和API数据格式转换
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { prisma } from '@/lib/prisma'

const merchantId = 'cmhx9w1mp0008wtqsfj71nzn1' // 聚力整装官方号

async function main() {
  console.log('🔍 测试数据库查询和数据转换...\n')
  console.log(`商家ID: ${merchantId}\n`)

  // 1. 模拟API路由的查询逻辑
  const analysis = await prisma.merchantAudienceAnalysis.findUnique({
    where: { merchantId }
  })

  if (!analysis) {
    console.error('❌ 未找到分析记录')
    return
  }

  console.log('📋 数据库原始字段:')
  console.log(`- id: ${analysis.id}`)
  console.log(`- merchantId: ${analysis.merchantId}`)
  console.log(`- videosAnalyzed: ${analysis.videosAnalyzed}`)
  console.log(`- commentsAnalyzed: ${analysis.commentsAnalyzed}`)
  console.log(`- tokenUsed: ${analysis.tokenUsed}`)
  console.log(`- modelUsed: ${analysis.modelUsed}`)
  console.log(`- analyzedAt: ${analysis.analyzedAt} (类型: ${typeof analysis.analyzedAt})`)
  console.log(`- videoIds: ${analysis.videoIds}`)
  console.log(`- locationStats: ${analysis.locationStats}`)
  console.log(`- rawMarkdown存在: ${Boolean(analysis.rawMarkdown)} (长度: ${analysis.rawMarkdown?.length || 0})`)

  console.log('\n📊 模拟API返回的数据转换:')

  // 2. 模拟API路由的数据转换逻辑 (app/api/merchants/[id]/analyze-audience/route.ts:57-74)
  const apiResponse = {
    id: analysis.id,
    merchantId: analysis.merchantId,
    videosAnalyzed: analysis.videosAnalyzed,
    commentsAnalyzed: analysis.commentsAnalyzed,
    videoIds: JSON.parse(analysis.videoIds),
    locationStats: analysis.locationStats ? JSON.parse(analysis.locationStats) : null,
    audienceProfile: analysis.audienceProfile ? JSON.parse(analysis.audienceProfile) : null,
    demographics: analysis.demographics ? JSON.parse(analysis.demographics) : null,
    behaviors: analysis.behaviors ? JSON.parse(analysis.behaviors) : null,
    interests: analysis.interests ? JSON.parse(analysis.interests) : null,
    painPoints: analysis.painPoints ? JSON.parse(analysis.painPoints) : null,
    suggestions: analysis.suggestions ? JSON.parse(analysis.suggestions) : null,
    rawMarkdown: analysis.rawMarkdown,
    analyzedAt: analysis.analyzedAt.toISOString(),
    modelUsed: analysis.modelUsed,
    tokenUsed: analysis.tokenUsed
  }

  console.log('\nAPI响应字段:')
  console.log(`- id: ${apiResponse.id}`)
  console.log(`- videosAnalyzed: ${apiResponse.videosAnalyzed} (类型: ${typeof apiResponse.videosAnalyzed})`)
  console.log(`- commentsAnalyzed: ${apiResponse.commentsAnalyzed} (类型: ${typeof apiResponse.commentsAnalyzed})`)
  console.log(`- tokenUsed: ${apiResponse.tokenUsed} (类型: ${typeof apiResponse.tokenUsed})`)
  console.log(`- modelUsed: ${apiResponse.modelUsed} (类型: ${typeof apiResponse.modelUsed})`)
  console.log(`- analyzedAt: ${apiResponse.analyzedAt} (类型: ${typeof apiResponse.analyzedAt})`)
  console.log(`- locationStats数组长度: ${apiResponse.locationStats?.length || 0}`)
  console.log(`- rawMarkdown存在: ${Boolean(apiResponse.rawMarkdown)} (长度: ${apiResponse.rawMarkdown?.length || 0})`)

  if (apiResponse.locationStats && apiResponse.locationStats.length > 0) {
    console.log('\n📍 地域分布 TOP3:')
    apiResponse.locationStats.slice(0, 3).forEach((stat: any, i: number) => {
      console.log(`  ${i + 1}. ${stat.location}: ${stat.count}条 (${stat.percentage.toFixed(1)}%)`)
    })
  }

  if (apiResponse.rawMarkdown) {
    console.log('\n📝 Markdown报告预览（前500字符）:')
    console.log(apiResponse.rawMarkdown.substring(0, 500))
    console.log('...\n')
  }

  console.log('\n✅ 完整API响应（JSON格式）:')
  console.log(JSON.stringify(apiResponse, null, 2))

  await prisma.$disconnect()
}

main()
  .then(() => {
    console.log('\n✅ 测试完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 测试失败:', error)
    process.exit(1)
  })
