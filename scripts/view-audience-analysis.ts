/**
 * 查看商家客群分析结果
 *
 * 用途：查看已保存的客群分析数据
 * 运行：npx tsx scripts/view-audience-analysis.ts <merchantId>
 */

// 加载环境变量
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { prisma } from '@/lib/prisma'

const merchantId = process.argv[2]

if (!merchantId) {
  console.error('❌ 请提供商家ID')
  console.log('用法: npx tsx scripts/view-audience-analysis.ts <merchantId>')
  process.exit(1)
}

async function main() {
  console.log('🔍 查询商家客群分析结果...')
  console.log(`商家ID: ${merchantId}\n`)

  // 查询商家信息
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      name: true,
      uid: true
    }
  })

  if (!merchant) {
    console.error('❌ 商家不存在')
    process.exit(1)
  }

  console.log(`商家名称: ${merchant.name}`)
  console.log(`商家UID: ${merchant.uid}\n`)

  // 查询分析结果
  const analysis = await prisma.merchantAudienceAnalysis.findUnique({
    where: { merchantId }
  })

  if (!analysis) {
    console.error('❌ 该商家暂无客群分析数据')
    console.log('提示：运行 npx tsx scripts/test-audience-analysis.ts <merchantId> 生成分析')
    process.exit(1)
  }

  console.log('=' .repeat(80))
  console.log('📊 客群分析数据')
  console.log('='.repeat(80))
  console.log('')

  // 基础信息
  console.log('📋 基础信息:')
  console.log(`  - 分析ID: ${analysis.id}`)
  console.log(`  - 分析时间: ${analysis.analyzedAt.toLocaleString('zh-CN')}`)
  console.log(`  - 使用模型: ${analysis.modelUsed}`)
  console.log(`  - Token消耗: ${analysis.tokenUsed.toLocaleString()}`)
  console.log('')

  // 统计数据
  console.log('📈 统计数据:')
  console.log(`  - 分析视频数: ${analysis.videosAnalyzed}`)
  console.log(`  - 评论样本数: ${analysis.commentsAnalyzed}`)

  // 视频ID列表
  try {
    const videoIds = JSON.parse(analysis.videoIds)
    console.log(`  - 视频ID列表: [${videoIds.slice(0, 3).join(', ')}${videoIds.length > 3 ? '...' : ''}]`)
  } catch (e) {
    console.log(`  - 视频ID: ${analysis.videoIds}`)
  }
  console.log('')

  // 地域分布
  if (analysis.locationStats) {
    try {
      const locationStats = JSON.parse(analysis.locationStats)
      console.log('📍 地域分布 TOP10:')
      locationStats.slice(0, 10).forEach((stat: any, i: number) => {
        const bar = '█'.repeat(Math.floor(stat.percentage / 2))
        console.log(`  ${(i + 1).toString().padStart(2)}. ${stat.location.padEnd(12)} ${stat.count.toString().padStart(6)}条  ${stat.percentage.toFixed(1).padStart(5)}%  ${bar}`)
      })
      console.log('')
    } catch (e) {
      console.log('  地域数据解析失败')
    }
  }

  // 完整分析报告
  if (analysis.rawMarkdown) {
    console.log('='.repeat(80))
    console.log('📝 完整客群分析报告')
    console.log('='.repeat(80))
    console.log('')
    console.log(analysis.rawMarkdown)
    console.log('')
    console.log('='.repeat(80))
  }

  // 数据库文件位置
  console.log('')
  console.log('💾 数据存储位置:')
  console.log(`  - 数据库文件: ${path.resolve(process.cwd(), 'prisma/dev.db')}`)
  console.log(`  - 表名: merchant_audience_analyses`)
  console.log(`  - 记录ID: ${analysis.id}`)
  console.log('')
  console.log('💡 提示:')
  console.log('  - 使用 Prisma Studio 可视化查看: pnpm db:studio')
  console.log('  - API 查询: GET /api/merchants/${merchantId}/analyze-audience')
  console.log('  - 前端Hook: useMerchantAudienceData(merchantId)')

  await prisma.$disconnect()
}

main()
  .then(() => {
    console.log('')
    console.log('✅ 查询完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 查询失败:', error)
    process.exit(1)
  })
