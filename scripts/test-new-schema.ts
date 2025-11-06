/**
 * 测试新的Schema字段
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n🔍 测试新Schema字段...\n')

  try {
    // 测试1: 检查评论表是否存在
    console.log('1️⃣  检查评论表...')
    const commentCount = await prisma.merchantContentComment.count()
    console.log(`   ✅ 评论表存在，当前评论数: ${commentCount}`)
  } catch (error: any) {
    console.log(`   ❌ 评论表不存在或有错误: ${error.message}`)
  }

  try {
    // 测试2: 检查内容表的新字段
    console.log('\n2️⃣  检查内容表新字段...')
    const content = await prisma.merchantContent.findFirst({
      select: {
        id: true,
        title: true,
        playCount: true,
        likeRate: true,
        isSuspicious: true,
      },
    })

    if (content) {
      console.log('   ✅ 新字段可用:')
      console.log(`      - playCount: ${content.playCount}`)
      console.log(`      - likeRate: ${content.likeRate}`)
      console.log(`      - isSuspicious: ${content.isSuspicious}`)
    }
  } catch (error: any) {
    console.log(`   ❌ 新字段不可用: ${error.message}`)
  }

  try {
    // 测试3: 检查商家表的新字段
    console.log('\n3️⃣  检查商家表新字段...')
    const merchant = await prisma.merchant.findFirst({
      select: {
        id: true,
        name: true,
        followerCount: true,
        totalPlayCount: true,
        avgEngagementRate: true,
      },
    })

    if (merchant) {
      console.log('   ✅ 商家新字段可用:')
      console.log(`      - followerCount: ${merchant.followerCount}`)
      console.log(`      - totalPlayCount: ${merchant.totalPlayCount}`)
      console.log(`      - avgEngagementRate: ${merchant.avgEngagementRate}`)
    }
  } catch (error: any) {
    console.log(`   ❌ 商家新字段不可用: ${error.message}`)
  }

  console.log('\n✅ Schema测试完成！\n')
}

main()
  .catch((error) => {
    console.error('测试失败:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
