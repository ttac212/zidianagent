/**
 * 检查商家视频的 shareUrl 覆盖率
 * 确保视频可以通过分享链接进行转录
 */

import { prisma } from '@/lib/prisma'

async function checkShareUrlCoverage() {
  console.log('===== 商家视频 shareUrl 覆盖率检查 =====\n')

  try {
    // 1. 统计总体情况
    const total = await prisma.merchantContent.count()
    const withShareUrl = await prisma.merchantContent.count({
      where: {
        shareUrl: {
          not: null,
          not: ''
        }
      },
    })
    const withoutShareUrl = total - withShareUrl

    console.log('📊 总体统计:')
    console.log(`   总视频数: ${total}`)
    console.log(`   有 shareUrl: ${withShareUrl} (${total > 0 ? ((withShareUrl / total) * 100).toFixed(2) : 0}%)`)
    console.log(`   无 shareUrl: ${withoutShareUrl} (${total > 0 ? ((withoutShareUrl / total) * 100).toFixed(2) : 0}%)`)
    console.log()

    // 2. 按商家统计
    const merchants = await prisma.merchant.findMany({
      select: {
        id: true,
        name: true,
        totalContentCount: true,
      },
      where: {
        totalContentCount: { gt: 0 }
      },
      take: 5,
      orderBy: {
        totalContentCount: 'desc'
      }
    })

    console.log('📋 前5个商家详情:\n')
    for (const merchant of merchants) {
      const merchantTotal = await prisma.merchantContent.count({
        where: { merchantId: merchant.id },
      })

      const withUrl = await prisma.merchantContent.count({
        where: {
          merchantId: merchant.id,
          shareUrl: { not: null, not: '' },
        },
      })

      console.log(`商家: ${merchant.name}`)
      console.log(`  总视频: ${merchantTotal}`)
      console.log(`  有 shareUrl: ${withUrl} (${merchantTotal > 0 ? ((withUrl / merchantTotal) * 100).toFixed(2) : 0}%)`)
      console.log()
    }

    // 3. 查看具体样本
    const samples = await prisma.merchantContent.findMany({
      select: {
        id: true,
        title: true,
        shareUrl: true,
        externalId: true,
        merchant: {
          select: {
            name: true
          }
        }
      },
      take: 10,
      orderBy: {
        collectedAt: 'desc'
      }
    })

    console.log('🔍 最近10个视频样本:\n')
    samples.forEach((s, i) => {
      const hasShareUrl = s.shareUrl && s.shareUrl.trim() !== ''
      console.log(`${i + 1}. ${s.title.substring(0, 50)}...`)
      console.log(`   商家: ${s.merchant.name}`)
      console.log(`   ID: ${s.id}`)
      console.log(`   externalId: ${s.externalId}`)
      console.log(`   shareUrl: ${hasShareUrl ? '✅ 有' : '❌ 无'}`)
      if (hasShareUrl) {
        console.log(`   URL长度: ${s.shareUrl!.length} 字符`)
        console.log(`   URL前缀: ${s.shareUrl!.substring(0, 50)}...`)
      }
      console.log()
    })

    // 4. 检查是否有缺失shareUrl的视频
    const missingShareUrl = await prisma.merchantContent.findMany({
      where: {
        OR: [
          { shareUrl: null },
          { shareUrl: '' }
        ]
      },
      select: {
        id: true,
        title: true,
        externalId: true,
        merchant: {
          select: {
            name: true
          }
        }
      },
      take: 5
    })

    if (missingShareUrl.length > 0) {
      console.log('⚠️  发现缺失 shareUrl 的视频:\n')
      missingShareUrl.forEach((content, i) => {
        console.log(`${i + 1}. ${content.title.substring(0, 50)}...`)
        console.log(`   商家: ${content.merchant.name}`)
        console.log(`   ID: ${content.id}`)
        console.log(`   externalId: ${content.externalId}`)
        console.log()
      })
    } else {
      console.log('✅ 所有视频都有 shareUrl!')
    }

    // 5. 推荐测试视频
    const recommendedForTest = await prisma.merchantContent.findFirst({
      where: {
        shareUrl: { not: null, not: '' },
        hasTranscript: false
      },
      select: {
        id: true,
        title: true,
        shareUrl: true,
        merchant: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (recommendedForTest) {
      console.log('🎯 推荐用于测试转录的视频:\n')
      console.log(`商家: ${recommendedForTest.merchant.name}`)
      console.log(`商家ID: ${recommendedForTest.merchant.id}`)
      console.log(`视频: ${recommendedForTest.title.substring(0, 60)}...`)
      console.log(`视频ID: ${recommendedForTest.id}`)
      console.log(`分享链接: ${recommendedForTest.shareUrl}`)
      console.log()
      console.log('💡 测试命令:')
      console.log(`curl -X POST http://localhost:3007/api/douyin/extract-text \\`)
      console.log(`  -H "Content-Type: application/json" \\`)
      console.log(`  -d '{"shareLink": "${recommendedForTest.shareUrl}"}'`)
    }

    console.log('\n✅ 检查完成')
  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行检查
checkShareUrlCoverage()
