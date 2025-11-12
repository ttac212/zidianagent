/**
 * 测试 totalEngagement 字段
 */

import { prisma } from '../lib/prisma'

async function testTotalEngagement() {
  console.log('📊 检查商家和内容数据...\n')

  // 获取第一个商家
  const merchant = await prisma.merchant.findFirst({
    select: { id: true, name: true, uid: true }
  })

  if (!merchant) {
    console.log('❌ 没有找到商家数据')
    process.exit(1)
  }

  console.log('✅ 找到商家:', merchant.name)
  console.log('   商家ID:', merchant.id)
  console.log('   抖音UID:', merchant.uid, '\n')

  // 检查该商家的内容数据
  const contents = await prisma.merchantContent.findMany({
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
    take: 5,
    orderBy: { totalEngagement: 'desc' }
  })

  console.log('📝 该商家的内容样例（按互动量排序，前5条）:\n')
  let allMatch = true

  contents.forEach((c, i) => {
    const calculated = c.diggCount + c.commentCount + c.collectCount + c.shareCount
    const match = c.totalEngagement === calculated
    if (!match) allMatch = false

    const status = match ? '✅' : '❌'
    const titlePreview = c.title.length > 30 ? c.title.substring(0, 30) + '...' : c.title

    console.log(`${status} ${i+1}. ${titlePreview}`)
    console.log(`   点赞:${c.diggCount} 评论:${c.commentCount} 收藏:${c.collectCount} 分享:${c.shareCount}`)
    console.log(`   计算值: ${calculated}, 数据库值: ${c.totalEngagement}\n`)
  })

  if (allMatch) {
    console.log('✅ 所有 totalEngagement 值都正确!')
  } else {
    console.log('❌ 发现不匹配的数据')
  }

  await prisma.$disconnect()
}

testTotalEngagement().catch(console.error)
