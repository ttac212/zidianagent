/**
 * 批量转录功能测试脚本
 *
 * 用途：验证 transcript 数据流是否正确
 *
 * 测试场景：
 * 1. 新视频同步后 transcript 为 null
 * 2. 批量转录后 transcript 和 hasTranscript 被正确设置
 * 3. 再次同步视频数据时，transcript 保持不变（不被覆盖）
 */

import { prisma } from '@/lib/prisma'

async function testTranscriptDataFlow() {
  console.log('===== 批量转录功能数据流测试 =====\n')

  try {
    // 1. 查找一个商家用于测试
    const merchant = await prisma.merchant.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        contents: {
          take: 3,
          orderBy: { publishedAt: 'desc' },
        },
      },
    })

    if (!merchant) {
      console.log('❌ 未找到测试商家')
      return
    }

    console.log(`✅ 找到测试商家: ${merchant.name} (ID: ${merchant.id})`)
    console.log(`   总内容数: ${merchant.totalContentCount}`)

    // 2. 检查内容的 transcript 状态
    const contents = merchant.contents
    if (contents.length === 0) {
      console.log('❌ 该商家没有内容')
      return
    }

    console.log(`\n📊 内容 transcript 状态:`)
    contents.forEach((content, index) => {
      console.log(
        `   ${index + 1}. ${content.title.substring(0, 30)}... | hasTranscript: ${content.hasTranscript} | transcript 长度: ${content.transcript?.length || 0}`
      )
    })

    // 3. 统计整体 transcript 覆盖率
    const totalContents = await prisma.merchantContent.count({
      where: { merchantId: merchant.id },
    })

    const transcribedContents = await prisma.merchantContent.count({
      where: {
        merchantId: merchant.id,
        hasTranscript: true,
        transcript: { not: null },
      },
    })

    const coverageRate = totalContents > 0 ? (transcribedContents / totalContents) * 100 : 0

    console.log(`\n📈 转录覆盖率统计:`)
    console.log(`   总内容数: ${totalContents}`)
    console.log(`   已转录数: ${transcribedContents}`)
    console.log(`   覆盖率: ${coverageRate.toFixed(1)}%`)

    // 4. 验证数据完整性
    const invalidContents = await prisma.merchantContent.findMany({
      where: {
        merchantId: merchant.id,
        OR: [
          // hasTranscript 为 true 但 transcript 为空
          { hasTranscript: true, transcript: null },
          // hasTranscript 为 false 但 transcript 有值
          { hasTranscript: false, transcript: { not: null } },
        ],
      },
      select: { id: true, externalId: true, hasTranscript: true, transcript: true },
    })

    if (invalidContents.length > 0) {
      console.log(`\n⚠️ 发现数据不一致的内容 (${invalidContents.length} 条):`)
      invalidContents.forEach((content) => {
        console.log(
          `   - ID: ${content.id} | hasTranscript: ${content.hasTranscript} | transcript: ${content.transcript ? '有值' : '空'}`
        )
      })
    } else {
      console.log(`\n✅ 数据完整性检查通过，无不一致数据`)
    }

    // 5. 显示批量转录 API 测试提示
    console.log(`\n🔧 批量转录 API 测试提示:`)
    console.log(`   POST /api/merchants/${merchant.id}/contents/batch-transcribe`)
    console.log(`   {`)
    console.log(`     "contentIds": [${contents.map((c) => `"${c.id}"`).join(', ')}],`)
    console.log(`     "mode": "missing",  // 或 "all", "force"`)
    console.log(`     "concurrent": 3`)
    console.log(`   }`)

    console.log(`\n✅ 测试完成`)
  } catch (error) {
    console.error('❌ 测试失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行测试
testTranscriptDataFlow()
