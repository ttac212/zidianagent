/**
 * 调研脚本：查看 MerchantContentComment 表的现有数据
 */

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') })

import { prisma } from '@/lib/prisma'

async function main() {
  console.log('========================================')
  console.log('MerchantContentComment 表数据调研')
  console.log('========================================\n')

  // 1. 总数统计
  const totalComments = await prisma.merchantContentComment.count()
  console.log(`[1] 评论总数: ${totalComments}`)

  if (totalComments === 0) {
    console.log('\n❌ 表中没有数据，无法继续调研')
    return
  }

  // 2. 按 content 分组统计
  const commentsByContent = await prisma.merchantContentComment.groupBy({
    by: ['contentId'],
    _count: true,
    orderBy: {
      _count: {
        contentId: 'desc'
      }
    },
    take: 10
  })

  console.log(`\n[2] 评论数最多的前10个视频：`)
  for (let i = 0; i < commentsByContent.length; i++) {
    const item = commentsByContent[i]
    const content = await prisma.merchantContent.findUnique({
      where: { id: item.contentId },
      select: { title: true, merchant: { select: { name: true } } }
    })
    console.log(`   ${i + 1}. ${content?.title.slice(0, 30)}... (${content?.merchant.name})`)
    console.log(`      评论数: ${item._count}`)
  }

  // 3. 查看第一个视频的评论详情
  const firstContent = commentsByContent[0]
  const sampleComments = await prisma.merchantContentComment.findMany({
    where: { contentId: firstContent.contentId },
    orderBy: { diggCount: 'desc' },
    take: 5,
    select: {
      text: true,
      authorName: true,
      diggCount: true,
      replyCount: true,
      createdAt: true,
      collectedAt: true
    }
  })

  console.log(`\n[3] 示例视频的TOP5评论（按点赞数排序）：`)
  sampleComments.forEach((c, i) => {
    console.log(`\n   ${i + 1}. 作者: ${c.authorName || '匿名'}`)
    console.log(`      点赞: ${c.diggCount} | 回复: ${c.replyCount}`)
    console.log(`      内容: ${c.text.slice(0, 100)}${c.text.length > 100 ? '...' : ''}`)
    console.log(`      创建时间: ${c.createdAt.toLocaleString('zh-CN')}`)
    console.log(`      采集时间: ${c.collectedAt.toLocaleString('zh-CN')}`)
  })

  // 4. 统计信息
  const stats = await prisma.merchantContentComment.aggregate({
    _avg: {
      diggCount: true,
      replyCount: true
    },
    _max: {
      diggCount: true,
      replyCount: true
    }
  })

  console.log(`\n[4] 统计信息：`)
  console.log(`   平均点赞数: ${stats._avg.diggCount?.toFixed(2) || 0}`)
  console.log(`   平均回复数: ${stats._avg.replyCount?.toFixed(2) || 0}`)
  console.log(`   最高点赞数: ${stats._max.diggCount || 0}`)
  console.log(`   最高回复数: ${stats._max.replyCount || 0}`)

  console.log('\n========================================')
  console.log('调研完成')
  console.log('========================================')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
