/**
 * 检查数据库中所有客群分析记录
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { prisma } from '@/lib/prisma'

async function main() {
  console.log('🔍 查询数据库中所有客群分析记录...\n')

  const analyses = await prisma.merchantAudienceAnalysis.findMany({
    select: {
      id: true,
      merchantId: true,
      videosAnalyzed: true,
      commentsAnalyzed: true,
      analyzedAt: true
    },
    orderBy: {
      analyzedAt: 'desc'
    }
  })

  console.log(`共找到 ${analyses.length} 条分析记录:\n`)

  for (const analysis of analyses) {
    console.log(`ID: ${analysis.id}`)
    console.log(`商家ID: ${analysis.merchantId}`)
    console.log(`视频数: ${analysis.videosAnalyzed}`)
    console.log(`评论数: ${analysis.commentsAnalyzed}`)
    console.log(`分析时间: ${analysis.analyzedAt.toLocaleString('zh-CN')}`)
    console.log('---')
  }

  await prisma.$disconnect()
}

main()
  .then(() => {
    console.log('\n✅ 查询完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 查询失败:', error)
    process.exit(1)
  })
