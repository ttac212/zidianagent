/**
 * 检查TOP5视频的评论数据情况
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n🔍 检查TOP5视频的评论数据情况\n')
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

  // 获取点赞TOP5
  const topLikes = await prisma.merchantContent.findMany({
    where: {
      merchantId: merchant.id,
      publishedAt: { gte: sixMonthsAgo }
    },
    orderBy: [
      { diggCount: 'desc' },
      { publishedAt: 'desc' }
    ],
    take: 5,
    include: {
      _count: { select: { comments: true } }
    }
  })

  console.log('📊 点赞TOP5视频的评论情况:\n')
  topLikes.forEach((c, i) => {
    console.log(`${i + 1}. ${c.title.slice(0, 50)}...`)
    console.log(`   外部ID: ${c.externalId}`)
    console.log(`   shareUrl: ${c.shareUrl || '无'}`)
    console.log(`   点赞: ${c.diggCount}, 评论数字段: ${c.commentCount}`)
    console.log(`   数据库评论数: ${c._count.comments}`)
    console.log(`   状态: ${c._count.comments > 0 ? '✅ 有评论数据' : '❌ 无评论数据'}\n`)
  })

  // 统计
  const withComments = topLikes.filter(c => c._count.comments > 0).length
  const withoutComments = topLikes.filter(c => c._count.comments === 0).length

  console.log('\n📈 统计:')
  console.log(`   有评论: ${withComments}/5`)
  console.log(`   无评论: ${withoutComments}/5`)

  if (withoutComments > 0) {
    console.log('\n💡 建议: 需要为这些TOP5视频采集评论数据')
    console.log('\n可以使用以下命令采集:')
    console.log(`   npx tsx scripts/enhance-merchant-videos.ts ${merchant.id}`)
  }

  console.log('\n' + '='.repeat(70) + '\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
