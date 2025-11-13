// 加载环境变量
import dotenv from 'dotenv'
import path from 'path'

// 显式加载 .env.local 文件
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { prisma } from '@/lib/prisma'

async function main() {
  const merchants = await prisma.merchant.findMany({
    select: {
      id: true,
      name: true,
      uid: true,
      totalCommentCount: true,
      _count: {
        select: {
          contents: true
        }
      }
    },
    take: 10,
    orderBy: {
      totalCommentCount: 'desc'
    }
  })

  console.log('📊 商家列表（按评论数排序）:\n')
  merchants.forEach((m, i) => {
    console.log(`${i + 1}. ID: ${m.id}`)
    console.log(`   名称: ${m.name}`)
    console.log(`   UID: ${m.uid}`)
    console.log(`   总评论数: ${m.totalCommentCount}`)
    console.log(`   内容数: ${m._count.contents}`)
    console.log('')
  })

  // 检查第一个商家的评论数据
  if (merchants.length > 0) {
    const firstMerchant = merchants[0]
    const contentsWithComments = await prisma.merchantContent.findMany({
      where: {
        merchantId: firstMerchant.id,
        commentCount: { gt: 0 }
      },
      select: {
        id: true,
        title: true,
        commentCount: true
      },
      orderBy: {
        commentCount: 'desc'
      },
      take: 5
    })

    console.log(`\n✅ 推荐使用商家: ${firstMerchant.name}`)
    console.log(`   商家ID: ${firstMerchant.id}`)
    console.log(`\n   TOP5视频:`)
    contentsWithComments.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.title} - ${c.commentCount}条评论`)
    })
    console.log(`\n运行测试: npx tsx scripts/test-audience-analysis.ts ${firstMerchant.id}`)
  }

  await prisma.$disconnect()
}

main().catch(console.error)
