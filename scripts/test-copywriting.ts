/**
 * 测试文案生成功能
 * 使用方法：npx tsx scripts/test-copywriting.ts
 */

import { prisma } from '@/lib/prisma'
import {
  isCopywritingRequest,
  extractMerchantInfo,
  buildCopywritingSystemPrompt,
  buildCopywritingUserPrompt,
  isCopywritingEditRequest
} from '@/lib/ai/copywriting-prompts'

async function test() {
  console.log('=== 测试文案生成功能 ===\n')

  // 1. 测试意图识别
  console.log('1. 测试意图识别：')
  const testMessages = [
    '帮我生成短视频文案',
    '为【XX全屋定制】写文案',
    '/文案',
    '这是普通聊天',
    '改第二个版本，标题改得活泼点'
  ]

  testMessages.forEach(msg => {
    const isCopywriting = isCopywritingRequest(msg)
    const editCheck = isCopywritingEditRequest(msg)
    console.log(`  "${msg}"`)
    console.log(`    文案生成: ${isCopywriting}`)
    console.log(`    修改请求: ${editCheck.isEdit}, 版本: ${editCheck.versionIndex}`)
  })

  // 2. 测试商家信息提取
  console.log('\n2. 测试商家信息提取：')
  const testExtract = [
    '为【南宁XX全屋定制】生成文案',
    '给商家clxxx123生成文案',
    '帮我写XX工厂的营销文案'
  ]

  testExtract.forEach(msg => {
    const info = extractMerchantInfo(msg)
    console.log(`  "${msg}"`)
    console.log(`    提取结果:`, info)
  })

  // 3. 测试实际数据库查询和Prompt构建
  console.log('\n3. 测试Prompt构建（使用真实商家数据）：')

  const merchant = await prisma.merchant.findFirst({
    include: {
      contents: {
        take: 10,
        orderBy: { diggCount: 'desc' }
      }
    }
  })

  if (!merchant) {
    console.log('  数据库中没有商家数据，跳过此测试')
    return
  }

  console.log(`  商家: ${merchant.name}`)

  const systemPrompt = buildCopywritingSystemPrompt()
  const userPrompt = buildCopywritingUserPrompt({
    merchant,
    userRequest: '生成专业型和活泼型两种风格的文案'
  })

  console.log(`\n  === System Prompt (前200字) ===`)
  console.log(`  ${systemPrompt.substring(0, 200)}...\n`)

  console.log(`  === User Prompt (前300字) ===`)
  console.log(`  ${userPrompt.substring(0, 300)}...\n`)

  // 4. 测试修改请求的Prompt构建
  console.log('4. 测试修改请求的Prompt构建：')

  const previousVersions = [
    {
      style: 'professional',
      title: '南宁全屋定制领军品牌',
      body: '...',
      cta: '立即咨询'
    },
    {
      style: 'casual',
      title: '让家更有温度的定制专家',
      body: '...',
      cta: '点击了解'
    }
  ]

  const editPrompt = buildCopywritingUserPrompt({
    merchant,
    userRequest: '改第二个版本，标题改得更活泼',
    previousVersions
  })

  console.log(`  === Edit Prompt (前300字) ===`)
  console.log(`  ${editPrompt.substring(0, 300)}...\n`)

  console.log('✅ 测试完成')
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
