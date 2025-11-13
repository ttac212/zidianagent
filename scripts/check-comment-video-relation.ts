/**
 * 检查评论与视频的关联情况
 */

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') })

import { prisma } from '@/lib/prisma'

async function main() {
  console.log('========================================')
  console.log('检查评论与视频的关联情况')
  console.log('========================================\n')

  // 1. 统计评论总数
  const totalComments = await prisma.merchantContentComment.count()
  console.log(`[1] 评论总数: ${totalComments}`)

  // 2. 按 contentId 分组统计
  const commentsByContent = await prisma.merchantContentComment.groupBy({
    by: ['contentId'],
    _count: true,
    orderBy: {
      _count: {
        contentId: 'desc'
      }
    }
  })

  console.log(`\n[2] 有评论的视频数量: ${commentsByContent.length}`)
  console.log(`    平均每个视频评论数: ${(totalComments / commentsByContent.length).toFixed(2)}`)

  // 3. 查看评论最多的前5个视频
  console.log(`\n[3] 评论数最多的前5个视频:`)
  for (let i = 0; i < Math.min(5, commentsByContent.length); i++) {
    const item = commentsByContent[i]
    const content = await prisma.merchantContent.findUnique({
      where: { id: item.contentId },
      select: {
        id: true,
        externalId: true,
        title: true,
        commentCount: true,
        merchant: {
          select: { name: true }
        }
      }
    })

    if (content) {
      console.log(`\n   ${i + 1}. ${content.title.slice(0, 40)}...`)
      console.log(`      商家: ${content.merchant.name}`)
      console.log(`      内部ID: ${content.id}`)
      console.log(`      外部ID: ${content.externalId}`)
      console.log(`      实际评论数: ${item._count}`)
      console.log(`      字段记录数: ${content.commentCount}`)
    } else {
      console.log(`\n   ${i + 1}. [找不到视频] contentId=${item.contentId}`)
    }
  }

  // 4. 检查 MerchantContent 表中 commentCount > 0 的视频
  console.log(`\n[4] 检查 MerchantContent 中标记有评论的视频:`)
  const contentsWithCommentCount = await prisma.merchantContent.count({
    where: {
      commentCount: { gt: 0 }
    }
  })
  console.log(`    commentCount > 0 的视频数: ${contentsWithCommentCount}`)

  // 5. 检查不一致的情况
  console.log(`\n[5] 检查数据不一致情况:`)

  // 找一个 commentCount > 0 但没有实际评论的视频
  const contentWithNoComments = await prisma.merchantContent.findFirst({
    where: {
      commentCount: { gt: 0 }
    },
    include: {
      comments: true,
      merchant: {
        select: { name: true }
      }
    }
  })

  if (contentWithNoComments) {
    console.log(`    示例视频:`)
    console.log(`      标题: ${contentWithNoComments.title.slice(0, 40)}...`)
    console.log(`      商家: ${contentWithNoComments.merchant.name}`)
    console.log(`      ID: ${contentWithNoComments.id}`)
    console.log(`      字段记录数: ${contentWithNoComments.commentCount}`)
    console.log(`      实际评论数: ${contentWithNoComments.comments.length}`)

    if (contentWithNoComments.comments.length === 0) {
      console.log(`      ⚠️ 不一致！字段显示有 ${contentWithNoComments.commentCount} 条评论，但实际为 0`)
    } else {
      console.log(`      ✅ 一致`)
    }
  }

  console.log('\n========================================')
  console.log('检查完成')
  console.log('========================================')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
