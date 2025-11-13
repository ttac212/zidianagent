/**
 * 预览所有商家的TOP5评论数据采集状态
 * 不执行采集，仅显示统计信息
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n🔍 预览所有商家TOP5评论数据状态\n')
  console.log('='.repeat(70))

  try {
    // 获取所有商家
    const merchants = await prisma.merchant.findMany({
      where: {
        totalContentCount: { gt: 0 }
      },
      select: {
        id: true,
        name: true,
        totalContentCount: true
      },
      orderBy: {
        totalContentCount: 'desc'
      }
    })

    console.log(`\n找到 ${merchants.length} 个商家\n`)

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    let needProcessCount = 0
    let hasDataCount = 0

    for (let i = 0; i < merchants.length; i++) {
      const merchant = merchants[i]
      const baseWhere = {
        merchantId: merchant.id,
        publishedAt: { gte: sixMonthsAgo }
      }

      // 获取TOP5（三个维度）
      const [topLikes, topComments, topEngagement] = await Promise.all([
        prisma.merchantContent.findMany({
          where: baseWhere,
          orderBy: [{ diggCount: 'desc' }, { publishedAt: 'desc' }],
          take: 5,
          select: {
            id: true,
            _count: { select: { comments: true } }
          }
        }),

        prisma.merchantContent.findMany({
          where: baseWhere,
          orderBy: [{ commentCount: 'desc' }, { publishedAt: 'desc' }],
          take: 5,
          select: {
            id: true,
            _count: { select: { comments: true } }
          }
        }),

        prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM "merchant_contents"
          WHERE "merchantId" = ${merchant.id}
            AND "publishedAt" >= ${sixMonthsAgo}
          ORDER BY ("diggCount" + "commentCount" * 2 + "collectCount" * 3 + "shareCount" * 4) DESC,
                   "publishedAt" DESC
          LIMIT 5
        `
      ])

      // 合并去重
      const allTop5Ids = new Set([
        ...topLikes.map(c => c.id),
        ...topComments.map(c => c.id),
        ...topEngagement.map(c => c.id)
      ])

      // 检查哪些没有评论
      const videosNeedComments = [
        ...topLikes.filter(c => c._count.comments === 0),
        ...topComments.filter(c => c._count.comments === 0)
      ]

      // 去重
      const uniqueNeedIds = new Set(videosNeedComments.map(v => v.id))

      const needsProcessing = uniqueNeedIds.size > 0

      const status = needsProcessing ? '❌ 需要采集' : '✅ 已有数据'
      const icon = needsProcessing ? '📦' : '✓'

      console.log(
        `${icon} ${i + 1}. ${merchant.name.padEnd(20)} | ` +
        `内容:${merchant.totalContentCount.toString().padStart(4)} | ` +
        `TOP5:${allTop5Ids.size} | ` +
        `缺评论:${uniqueNeedIds.size} | ` +
        `${status}`
      )

      if (needsProcessing) {
        needProcessCount++
      } else {
        hasDataCount++
      }
    }

    console.log('\n' + '='.repeat(70))
    console.log('\n📊 统计:')
    console.log(`   总商家数: ${merchants.length}`)
    console.log(`   需要采集: ${needProcessCount} 个商家`)
    console.log(`   已有数据: ${hasDataCount} 个商家`)

    if (needProcessCount > 0) {
      console.log('\n💡 下一步:')
      console.log('   运行批量采集脚本:')
      console.log('   npx tsx scripts/batch-enhance-all-merchants.ts')
    } else {
      console.log('\n✅ 所有商家的TOP5视频都已有评论数据！')
    }

    console.log('\n' + '='.repeat(70) + '\n')
  } catch (error) {
    console.error('❌ 错误:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
