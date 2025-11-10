/**
 * 测试视频标题更新机制
 *
 * 用于验证已存在视频是否能被更新
 */

import { prisma } from '@/lib/prisma'
import { updateMerchantVideos } from '@/lib/tikhub/sync-service'

async function testVideoUpdate() {
  console.log('🔍 开始测试视频更新机制...\n')

  try {
    // 1. 查找一个有内容的商家
    const merchant = await prisma.merchant.findFirst({
      where: {
        totalContentCount: { gt: 0 },
      },
      include: {
        contents: {
          orderBy: { publishedAt: 'desc' },
          take: 5,
        },
      },
    })

    if (!merchant) {
      console.log('❌ 没有找到包含内容的商家')
      return
    }

    console.log(`✅ 找到商家: ${merchant.name} (ID: ${merchant.id})`)
    console.log(`   总内容数: ${merchant.totalContentCount}`)
    console.log(`   UID: ${merchant.uid}`)

    // 2. 显示更新前的视频数据
    console.log('\n📊 更新前的视频数据（前5条）:')
    merchant.contents.forEach((content, index) => {
      console.log(`\n${index + 1}. externalId: ${content.externalId}`)
      console.log(`   标题: ${content.title}`)
      console.log(`   点赞数: ${content.diggCount}`)
      console.log(`   评论数: ${content.commentCount}`)
      console.log(`   更新时间: ${content.updatedAt.toISOString()}`)
    })

    // 3. 执行同步（limit=50，确保包含已存在的视频）
    console.log('\n🔄 执行同步更新（获取最新50个视频）...')
    const result = await updateMerchantVideos(merchant.id, { limit: 50 })

    console.log('\n📈 同步结果:')
    console.log(`   成功: ${result.success}`)
    console.log(`   新视频: ${result.newVideos}`)
    console.log(`   更新视频: ${result.updatedVideos}`)
    console.log(`   错误: ${result.errors.join(', ') || '无'}`)

    // 4. 查询更新后的数据
    const updatedMerchant = await prisma.merchant.findUnique({
      where: { id: merchant.id },
      include: {
        contents: {
          where: {
            externalId: { in: merchant.contents.map((c) => c.externalId) },
          },
        },
      },
    })

    console.log('\n📊 更新后的视频数据:')
    updatedMerchant?.contents.forEach((content, index) => {
      const oldContent = merchant.contents.find((c) => c.externalId === content.externalId)

      console.log(`\n${index + 1}. externalId: ${content.externalId}`)
      console.log(`   标题: ${content.title}`)

      if (oldContent) {
        const titleChanged = oldContent.title !== content.title
        const diggChanged = oldContent.diggCount !== content.diggCount
        const updatedAtChanged = oldContent.updatedAt.getTime() !== content.updatedAt.getTime()

        if (titleChanged) {
          console.log(`   ✅ 标题已更新: "${oldContent.title}" → "${content.title}"`)
        } else {
          console.log(`   ⚠️ 标题未变化`)
        }

        if (diggChanged) {
          console.log(`   ✅ 点赞数已更新: ${oldContent.diggCount} → ${content.diggCount}`)
        } else {
          console.log(`   ⚠️ 点赞数未变化: ${content.diggCount}`)
        }

        if (updatedAtChanged) {
          console.log(`   ✅ updatedAt已更新: ${oldContent.updatedAt.toISOString()} → ${content.updatedAt.toISOString()}`)
        } else {
          console.log(`   ❌ updatedAt未更新！这表明记录未被触碰`)
        }
      }
    })

    // 5. 检查时间过滤逻辑
    console.log('\n🔍 检查时间过滤逻辑:')
    const latestPublishedAt = merchant.contents[0]?.publishedAt
    console.log(`   数据库中最新视频发布时间: ${latestPublishedAt?.toISOString() || '无'}`)
    console.log(`   ⚠️ 注意: updateMerchantVideos() 使用时间过滤，只同步比这个时间更新的视频！`)
    console.log(`   这就是为什么已存在视频不会被更新的原因！`)

  } catch (error: any) {
    console.error('❌ 测试失败:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行测试
testVideoUpdate()
