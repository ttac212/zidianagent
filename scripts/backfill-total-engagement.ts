/**
 * 回填 MerchantContent 的 totalEngagement 字段
 *
 * 功能: 计算并更新所有商家内容的总互动量
 * totalEngagement = diggCount + commentCount + collectCount + shareCount
 *
 * 使用方法:
 * npx tsx scripts/backfill-total-engagement.ts
 */

import { prisma } from '../lib/prisma'

async function backfillTotalEngagement() {
  console.log('🚀 开始回填 totalEngagement 字段...\n')

  try {
    // 1. 统计需要更新的内容数量
    const totalCount = await prisma.merchantContent.count()
    console.log(`📊 找到 ${totalCount} 条商家内容需要更新\n`)

    if (totalCount === 0) {
      console.log('✅ 没有数据需要更新')
      return
    }

    // 2. 分批处理，避免一次性加载所有数据
    const BATCH_SIZE = 500
    let processed = 0
    let updated = 0

    while (processed < totalCount) {
      // 批量获取数据
      const contents = await prisma.merchantContent.findMany({
        select: {
          id: true,
          diggCount: true,
          commentCount: true,
          collectCount: true,
          shareCount: true,
        },
        skip: processed,
        take: BATCH_SIZE,
      })

      // 批量更新
      const updatePromises = contents.map((content) => {
        const totalEngagement =
          content.diggCount +
          content.commentCount +
          content.collectCount +
          content.shareCount

        return prisma.merchantContent.update({
          where: { id: content.id },
          data: { totalEngagement },
        })
      })

      await Promise.all(updatePromises)

      processed += contents.length
      updated += contents.length

      // 显示进度
      const progress = ((processed / totalCount) * 100).toFixed(1)
      console.log(`⏳ 进度: ${processed}/${totalCount} (${progress}%)`)
    }

    console.log(`\n✅ 回填完成! 共更新 ${updated} 条记录`)

    // 3. 验证结果
    console.log('\n🔍 验证回填结果...')
    const sampleContents = await prisma.merchantContent.findMany({
      select: {
        id: true,
        diggCount: true,
        commentCount: true,
        collectCount: true,
        shareCount: true,
        totalEngagement: true,
      },
      take: 5,
    })

    console.log('\n📝 示例数据（前5条）:')
    sampleContents.forEach((content, index) => {
      const calculated =
        content.diggCount +
        content.commentCount +
        content.collectCount +
        content.shareCount

      const isCorrect = content.totalEngagement === calculated
      const status = isCorrect ? '✅' : '❌'

      console.log(`${status} ${index + 1}. ID: ${content.id.substring(0, 8)}...`)
      console.log(`   计算值: ${calculated}, 数据库值: ${content.totalEngagement}`)
    })

  } catch (error) {
    console.error('❌ 回填失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 执行回填
backfillTotalEngagement()
  .then(() => {
    console.log('\n🎉 脚本执行完成!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 脚本执行失败:', error)
    process.exit(1)
  })
