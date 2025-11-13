/**
 * 检查评论数据关联情况
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n🔍 检查评论数据关联情况\n')
  console.log('='.repeat(60))

  // 检查前10个内容的评论数量
  const contents = await prisma.merchantContent.findMany({
    take: 10,
    include: {
      _count: { select: { comments: true } },
      merchant: { select: { name: true } }
    },
    orderBy: { publishedAt: 'desc' }
  })

  console.log('\n📄 最近10个内容的评论数量:')
  contents.forEach((c, i) => {
    console.log(`   ${i+1}. [${c.merchant.name}] ${c.title.slice(0, 30)}...`)
    console.log(`      评论数: ${c._count.comments} 条`)
  })

  // 统计有评论的内容数量
  const withComments = await prisma.merchantContent.count({
    where: {
      comments: { some: {} }
    }
  })

  const total = await prisma.merchantContent.count()

  console.log(`\n📊 统计:`)
  console.log(`   有评论的内容: ${withComments} / ${total} (${(withComments/total*100).toFixed(1)}%)`)
  console.log(`   无评论的内容: ${total - withComments}`)

  // 检查特定商家的TOP5内容的评论情况
  console.log('\n\n🎯 检查TOP5内容的评论情况:\n')

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const merchant = await prisma.merchant.findFirst({
    where: { totalContentCount: { gt: 50 } }
  })

  if (merchant) {
    console.log(`商家: ${merchant.name}`)

    const topLikes = await prisma.merchantContent.findMany({
      where: {
        merchantId: merchant.id,
        publishedAt: { gte: sixMonthsAgo }
      },
      orderBy: { diggCount: 'desc' },
      take: 5,
      include: {
        _count: { select: { comments: true } },
        comments: { take: 3, orderBy: { diggCount: 'desc' } }
      }
    })

    console.log('\n点赞TOP5:')
    topLikes.forEach((c, i) => {
      console.log(`   ${i+1}. ${c.title.slice(0, 40)}...`)
      console.log(`      点赞: ${c.diggCount}, 评论数: ${c.commentCount}, 数据库评论: ${c._count.comments}`)
      if (c.comments.length > 0) {
        console.log(`      ✅ 有评论数据:`)
        c.comments.forEach(comment => {
          console.log(`         - ${comment.text.slice(0, 50)}...`)
        })
      } else {
        console.log(`      ❌ 无评论数据`)
      }
    })
  }

  console.log('\n' + '='.repeat(60) + '\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
