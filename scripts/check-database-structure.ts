/**
 * 检查数据库表结构
 * 验证 totalEngagement 字段是否已存在
 */

import { prisma } from '../lib/prisma'

async function checkTableStructure() {
  console.log('🔍 检查 merchant_contents 表结构...\n')

  try {
    // 方法1: 尝试查询 totalEngagement 字段
    const sample = await prisma.merchantContent.findFirst({
      select: {
        id: true,
        diggCount: true,
        commentCount: true,
        collectCount: true,
        shareCount: true,
        totalEngagement: true, // 如果字段不存在会报错
      },
    })

    if (sample) {
      console.log('✅ totalEngagement 字段已存在')
      console.log('\n示例数据:')
      console.log(`  点赞: ${sample.diggCount}`)
      console.log(`  评论: ${sample.commentCount}`)
      console.log(`  收藏: ${sample.collectCount}`)
      console.log(`  分享: ${sample.shareCount}`)
      console.log(`  总互动: ${sample.totalEngagement}`)

      const calculated =
        sample.diggCount +
        sample.commentCount +
        sample.collectCount +
        sample.shareCount

      if (sample.totalEngagement === calculated) {
        console.log('\n✅ totalEngagement 值正确')
      } else {
        console.log('\n⚠️  totalEngagement 值不匹配')
        console.log(`  计算值: ${calculated}`)
        console.log(`  数据库值: ${sample.totalEngagement}`)
      }
    } else {
      console.log('⚠️  表中暂无数据')
    }

    // 检查数据总量
    const totalCount = await prisma.merchantContent.count()
    console.log(`\n📊 总内容数: ${totalCount}`)

    // 检查有多少内容的 totalEngagement 为 0
    const zeroEngagementCount = await prisma.merchantContent.count({
      where: { totalEngagement: 0 },
    })

    if (zeroEngagementCount === totalCount && totalCount > 0) {
      console.log('\n⚠️  警告: 所有记录的 totalEngagement 都为 0')
      console.log('   需要运行回填脚本: npx tsx scripts/backfill-total-engagement.ts')
    } else if (zeroEngagementCount > 0) {
      console.log(`\n⚠️  有 ${zeroEngagementCount} 条记录的 totalEngagement 为 0`)
      console.log('   建议运行回填脚本')
    } else {
      console.log('\n✅ 所有记录的 totalEngagement 都已回填')
    }
  } catch (error: any) {
    if (error.message?.includes('Unknown field')) {
      console.log('❌ totalEngagement 字段不存在')
      console.log('\n需要执行以下步骤:')
      console.log('1. pnpm db:generate')
      console.log('2. pnpm db:push')
      console.log('3. npx tsx scripts/backfill-total-engagement.ts')
    } else {
      console.error('❌ 检查失败:', error)
    }
  } finally {
    await prisma.$disconnect()
  }
}

checkTableStructure()
