/**
 * 临时脚本：检查商家档案字段迁移状态
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkProfiles() {
  try {
    console.log('检查商家档案数据...\n')

    const profiles = await prisma.merchantProfile.findMany({
      select: {
        id: true,
        merchantId: true,
        briefIntro: true,
        briefSellingPoints: true,
        briefUsageScenarios: true,
        briefAudienceProfile: true,
        briefBrandTone: true,
        aiGeneratedAt: true
      }
    })

    console.log(`总档案数: ${profiles.length}\n`)

    if (profiles.length > 0) {
      console.log('样本数据（第一个档案）:')
      const sample = profiles[0]
      console.log('  ID:', sample.id)
      console.log('  MerchantID:', sample.merchantId)
      console.log('  Brief Intro:', sample.briefIntro ? '存在' : '空')
      console.log('  Selling Points:', sample.briefSellingPoints ? 'JSON存在' : '空')
      console.log('  Generated At:', sample.aiGeneratedAt)

      console.log('\n档案状态统计:')
      const withBrief = profiles.filter(p => p.briefIntro).length
      console.log(`  有Brief的档案: ${withBrief}/${profiles.length}`)
    } else {
      console.log('暂无档案数据')
    }

  } catch (error) {
    if (error.message.includes('topContentAnalysis')) {
      console.error('❌ 错误: 数据库Schema与Prisma Client不同步')
      console.error('   请运行: pnpm db:push 以同步Schema删除')
    } else {
      console.error('检查失败:', error)
    }
  } finally {
    await prisma.$disconnect()
  }
}

checkProfiles()
