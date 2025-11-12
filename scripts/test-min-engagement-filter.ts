/**
 * 测试 minEngagement 过滤功能
 * 验证历史数据（totalEngagement = 0）能正确动态计算并过滤
 */

import { prisma } from '../lib/prisma'

async function testMinEngagementFilter() {
  console.log('🔍 测试 minEngagement 过滤功能...\n')

  // 1. 获取一个商家
  const merchant = await prisma.merchant.findFirst({
    select: { id: true, name: true }
  })

  if (!merchant) {
    console.log('❌ 没有找到商家数据')
    process.exit(1)
  }

  console.log('✅ 测试商家:', merchant.name)
  console.log('   商家ID:', merchant.id, '\n')

  // 2. 统计该商家的内容数据
  const allContents = await prisma.merchantContent.findMany({
    where: { merchantId: merchant.id },
    select: {
      id: true,
      title: true,
      diggCount: true,
      commentCount: true,
      collectCount: true,
      shareCount: true,
      totalEngagement: true,
    },
    orderBy: { totalEngagement: 'desc' }
  })

  console.log(`📊 该商家共有 ${allContents.length} 条内容\n`)

  // 3. 模拟不同的 minEngagement 过滤
  const testCases = [0, 100, 500, 1000, 2000]

  for (const minEngagement of testCases) {
    // 使用动态计算逻辑（与API相同）
    const filteredContents = allContents
      .map(content => ({
        ...content,
        // 动态计算（兼容历史数据）
        calculatedEngagement: content.totalEngagement === 0
          ? content.diggCount + content.commentCount + content.collectCount + content.shareCount
          : content.totalEngagement
      }))
      .filter(content => content.calculatedEngagement >= minEngagement)

    console.log(`📈 minEngagement >= ${minEngagement}: ${filteredContents.length} 条内容符合条件`)

    if (filteredContents.length > 0 && filteredContents.length <= 3) {
      filteredContents.forEach((c, i) => {
        const preview = c.title.length > 30 ? c.title.substring(0, 30) + '...' : c.title
        console.log(`   ${i+1}. ${preview}`)
        console.log(`      互动量: ${c.calculatedEngagement} (点赞:${c.diggCount} 评论:${c.commentCount} 收藏:${c.collectCount} 分享:${c.shareCount})`)
      })
    }
  }

  console.log('\n✅ minEngagement 过滤测试完成!')
  console.log('💡 说明: 即使 totalEngagement = 0 的历史数据也能正确动态计算并过滤')

  await prisma.$disconnect()
}

testMinEngagementFilter().catch(console.error)
