/**
 * 验证TOP5 API是否返回评论数据
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n🔍 验证TOP5 API数据结构\n')
  console.log('='.repeat(70))

  const merchant = await prisma.merchant.findFirst({
    where: { name: '韶关装修可可' }
  })

  if (!merchant) {
    console.log('未找到商家')
    return
  }

  console.log(`\n商家: ${merchant.name} (ID: ${merchant.id})\n`)

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const baseWhere = {
    merchantId: merchant.id,
    publishedAt: { gte: sixMonthsAgo }
  }

  // 模拟API的查询逻辑
  const [topLikes, topComments, topEngagement] = await Promise.all([
    // 点赞TOP5
    prisma.merchantContent.findMany({
      where: baseWhere,
      orderBy: [{ diggCount: 'desc' }, { publishedAt: 'desc' }],
      take: 5,
      include: {
        comments: {
          orderBy: { diggCount: 'desc' },
          take: 5
        }
      }
    }),

    // 评论TOP5
    prisma.merchantContent.findMany({
      where: baseWhere,
      orderBy: [{ commentCount: 'desc' }, { publishedAt: 'desc' }],
      take: 5,
      include: {
        comments: {
          orderBy: { diggCount: 'desc' },
          take: 5
        }
      }
    }),

    // 互动评分TOP5
    prisma.merchantContent.findMany({
      where: baseWhere,
      orderBy: [{ totalEngagement: 'desc' }, { publishedAt: 'desc' }],
      take: 5,
      include: {
        comments: {
          orderBy: { diggCount: 'desc' },
          take: 5
        }
      }
    })
  ])

  console.log('📊 点赞TOP5:')
  topLikes.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.title.slice(0, 40)}...`)
    console.log(`      评论数: ${c.comments.length} 条`)
    if (c.comments.length > 0) {
      console.log(`      ✅ 有评论数据`)
      c.comments.slice(0, 2).forEach(comment => {
        console.log(`         - ${comment.text.slice(0, 50)}...`)
      })
    } else {
      console.log(`      ❌ 无评论数据`)
    }
  })

  console.log('\n💬 评论TOP5:')
  topComments.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.title.slice(0, 40)}...`)
    console.log(`      评论数: ${c.comments.length} 条`)
    if (c.comments.length > 0) {
      console.log(`      ✅ 有评论数据`)
    } else {
      console.log(`      ❌ 无评论数据`)
    }
  })

  console.log('\n🔥 互动评分TOP5:')
  topEngagement.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.title.slice(0, 40)}...`)
    console.log(`      评论数: ${c.comments.length} 条`)
    if (c.comments.length > 0) {
      console.log(`      ✅ 有评论数据`)
    } else {
      console.log(`      ❌ 无评论数据`)
    }
  })

  // 统计
  const totalVideos = new Set([
    ...topLikes.map(c => c.id),
    ...topComments.map(c => c.id),
    ...topEngagement.map(c => c.id)
  ]).size

  const videosWithComments = new Set([
    ...topLikes.filter(c => c.comments.length > 0).map(c => c.id),
    ...topComments.filter(c => c.comments.length > 0).map(c => c.id),
    ...topEngagement.filter(c => c.comments.length > 0).map(c => c.id)
  ]).size

  console.log('\n📈 总体统计:')
  console.log(`   去重后总视频数: ${totalVideos}`)
  console.log(`   有评论数据: ${videosWithComments}`)
  console.log(`   覆盖率: ${((videosWithComments / totalVideos) * 100).toFixed(1)}%`)

  if (videosWithComments === totalVideos) {
    console.log('\n✅ 完美！所有TOP5视频都有评论数据，商家详情页应该能正常显示评论洞察了！')
  } else {
    console.log(`\n⚠️  还有 ${totalVideos - videosWithComments} 个视频缺少评论数据`)
  }

  console.log('\n' + '='.repeat(70) + '\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
