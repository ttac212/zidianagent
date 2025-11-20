/**
 * 测试AI内容分析功能
 *
 * 用法：
 * npx tsx scripts/test-content-analyzer.ts
 */

// 加载环境变量
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { prisma } from '@/lib/prisma'
import { analyzeContentQuality } from '@/lib/ai/content-analyzer'

async function main() {
  console.log('===== 测试AI内容分析功能 =====\n')

  // 1. 获取一个有转录文本的内容
  const content = await prisma.merchantContent.findFirst({
    where: {
      transcript: { not: null },
      hasTranscript: true
    },
    include: {
      merchant: {
        select: {
          name: true
        }
      }
    }
  })

  if (!content || !content.transcript) {
    console.error('❌ 未找到有转录文本的内容，请先同步商家数据')
    process.exit(1)
  }

  console.log('✅ 找到测试内容:')
  console.log(`   商家: ${content.merchant.name}`)
  console.log(`   标题: ${content.title}`)
  console.log(`   转录长度: ${content.transcript.length} 字符`)
  console.log(`   播放量: ${content.playCount.toLocaleString()}`)
  console.log(`   点赞: ${content.diggCount} | 评论: ${content.commentCount} | 分享: ${content.shareCount}\n`)

  // 2. 调用AI分析
  console.log('🤖 开始AI分析...\n')

  const startTime = Date.now()

  const analysis = await analyzeContentQuality({
    title: content.title,
    transcript: content.transcript
  })

  const duration = Date.now() - startTime

  if (!analysis) {
    console.error('❌ AI分析失败')
    process.exit(1)
  }

  // 3. 输出分析结果
  console.log('✅ AI分析完成！耗时:', duration, 'ms\n')
  console.log('【分析结果】\n')

  console.log('1️⃣ 开头质量:')
  console.log(`   评分: ${analysis.openingQuality.score}/10`)
  console.log(`   等级: ${analysis.openingQuality.level} (${analysis.openingQuality.level === 'high' ? '高' : analysis.openingQuality.level === 'medium' ? '中' : '低'})`)
  console.log(`   有吸引力: ${analysis.openingQuality.hasHook ? '是' : '否'}`)
  console.log(`   原因: ${analysis.openingQuality.reason}\n`)

  console.log('2️⃣ 情绪点:')
  console.log(`   主要情绪: ${translateEmotion(analysis.emotionalTrigger.primary)}`)
  console.log(`   情绪强度: ${analysis.emotionalTrigger.intensity}/10`)
  console.log(`   描述: ${analysis.emotionalTrigger.description}\n`)

  console.log('3️⃣ 痛点和需求:')
  console.log(`   痛点: ${analysis.painPoints.length > 0 ? analysis.painPoints.join('、') : '无'}`)
  console.log(`   需求: ${analysis.userNeeds.length > 0 ? analysis.userNeeds.join('、') : '无'}\n`)

  console.log('4️⃣ 内容节奏:')
  console.log(`   节奏快慢: ${translatePace(analysis.contentRhythm.pace)}`)
  console.log(`   节奏变化: ${translateVariety(analysis.contentRhythm.variety)}`)
  console.log(`   描述: ${analysis.contentRhythm.description}\n`)

  console.log('5️⃣ 综合评价:')
  console.log(`   综合评分: ${analysis.overallQuality.score}/100`)
  console.log(`   优点:`)
  analysis.overallQuality.strengths.forEach((s, i) => {
    console.log(`     ${i + 1}. ${s}`)
  })
  if (analysis.overallQuality.weaknesses.length > 0) {
    console.log(`   缺点:`)
    analysis.overallQuality.weaknesses.forEach((w, i) => {
      console.log(`     ${i + 1}. ${w}`)
    })
  }

  console.log('\n===== 测试完成 =====')
}

function translateEmotion(type: string): string {
  const map: Record<string, string> = {
    'humor': '幽默搞笑',
    'pain': '痛点共鸣',
    'satisfaction': '爽点满足',
    'knowledge': '知识获得',
    'curiosity': '好奇悬念',
    'other': '其他'
  }
  return map[type] || type
}

function translatePace(pace: string): string {
  const map: Record<string, string> = {
    'fast': '快节奏',
    'medium': '中等节奏',
    'slow': '慢节奏'
  }
  return map[pace] || pace
}

function translateVariety(variety: string): string {
  const map: Record<string, string> = {
    'high': '丰富',
    'medium': '适中',
    'low': '单一'
  }
  return map[variety] || variety
}

main()
  .catch((error) => {
    console.error('测试失败:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
