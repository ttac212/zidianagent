/**
 * 检查评论数据状态
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n📊 数据库状态检查\n')
  console.log('=' . repeat(50))

  // 1. 商家统计
  const merchantCount = await prisma.merchant.count()
  console.log(`\n✅ 商家总数: ${merchantCount}`)

  // 2. 内容统计
  const contentCount = await prisma.merchantContent.count()
  const contentWithoutPlay = await prisma.merchantContent.count({
    where: { playCount: 0 }
  })
  console.log(`✅ 内容总数: ${contentCount}`)
  console.log(`   - 未采集播放量: ${contentWithoutPlay}`)

  // 3. 评论统计
  const commentCount = await prisma.merchantContentComment.count()
  console.log(`✅ 评论总数: ${commentCount}`)

  if (commentCount === 0) {
    console.log('\n⚠️  数据库中暂无评论数据，需要运行采集脚本！')
  }

  // 4. 列出前5个商家
  console.log('\n📋 商家列表:')
  const merchants = await prisma.merchant.findMany({
    take: 5,
    select: {
      id: true,
      name: true,
      _count: {
        select: { contents: true }
      }
    },
    orderBy: {
      totalContentCount: 'desc'
    }
  })

  merchants.forEach((m, i) => {
    console.log(`   ${i + 1}. ${m.name} (ID: ${m.id}, ${m._count.contents} 个内容)`)
  })

  console.log('\n' + '='.repeat(50) + '\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
