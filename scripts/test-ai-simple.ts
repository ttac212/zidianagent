/**
 * 测试AI分析功能的简单脚本
 * 使用模拟数据验证分析流程
 */

// 加载环境变量
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import { performAIDeepAnalysis } from './ai-deep-analysis'
import type { AIAnalysisRequest } from '@/types/merchant-analysis'

async function simpleTest() {
  console.log('🧪 开始简单测试...\n')

  // 模拟商家数据
  const testRequest: AIAnalysisRequest = {
    merchantId: 'test-merchant-001',
    merchantName: '广西聚典爱格板工厂',
    transcripts: [
      {
        title: '为什么我们只做爱格和可丽芙？',
        content: `各位全国的经销商朋友们看过来，如果你对家里面的爱格和格利夫的板还是不怎么放心，
生怕商家跟你偷梁换柱，那你就看仔细了。拿出你的手机，微信搜索渠道订单溯源系统，点进去，
点新渠道查询，输入我们给你的授权编码。点下一步，输入你家的手机号，点下一步。
好了，你家爱格和格利夫的板材信息，包括花色，包括订单号，包括数量，包括使用面积，
全部都在这里，保真的。所以说，各位全国的经销商朋友们，有需要爱格和可利夫的，赶紧在评论区留言。`,
        engagement: {
          diggCount: 1250,
          commentCount: 234,
          collectCount: 456,
          shareCount: 89,
        },
      },
      {
        title: '千万级库存，万方车间展示',
        content: `大家好，今天带大家看一下我们的仓库。你看这就是我们的千万级库存，
这边是爱格板，那边是可丽芙板。我们拥有70-100种爱格与可丽芙的流行及经典花色。
作为源头代工厂，我们为客户提供一手货源。而且我们是一件起发，全国配送。
不管你是独立设计师还是小型工作室，都可以跟我们合作。我们还有特价花色活动，
价格非常有竞争力。有需要的朋友欢迎咨询。`,
        engagement: {
          diggCount: 2340,
          commentCount: 445,
          collectCount: 678,
          shareCount: 123,
        },
      },
      {
        title: '德国豪迈设备激光封边展示',
        content: `今天给大家展示一下我们的设备。这是德国豪迈的激光封边机，
封边效果非常好，看这个边缘，完全看不出接缝。我们全面采用德国豪迈设备，
包括开料机、封边机、数控加工中心等。可以实现异形、圆弧、不同厚度拼接等高端工艺。
而且我们能在一家工厂内完成从板材选定到激光封边、异形加工等所有高端工艺，简化了供应链。
凭借先进设备和技术积累，能满足高定市场对特殊工艺的需求。`,
        engagement: {
          diggCount: 3450,
          commentCount: 567,
          collectCount: 890,
          shareCount: 234,
        },
      },
    ],
    basicStats: {
      category: '全屋定制工厂',
      location: '广西',
      businessType: 'B2B',
      totalContentCount: 462,
      totalEngagement: 93656,
    },
    analysisDepth: 'comprehensive',
  }

  console.log(`📊 测试数据:`)
  console.log(`   - 商家: ${testRequest.merchantName}`)
  console.log(`   - 转录文本数: ${testRequest.transcripts.length}`)
  console.log(`   - 分析深度: ${testRequest.analysisDepth}\n`)

  try {
    const response = await performAIDeepAnalysis(testRequest)

    if (response.success && response.report) {
      console.log('\n✅ 测试成功!\n')
      console.log('📋 分析结果预览:')
      console.log('─'.repeat(50))
      console.log(`主营业务: ${response.report.basicInfo.mainBusiness}`)
      console.log(`核心产品: ${response.report.basicInfo.coreProducts.join(', ')}`)
      console.log(`\n内容策略:`)
      console.log(`  - 视频类型: ${response.report.contentStrategy.videoContentTypes.join(', ')}`)
      console.log(`  - 发布频率: ${response.report.contentStrategy.publishFrequency}`)
      console.log(`\n营销策略:`)
      console.log(`  - 信任建立: ${response.report.marketingStrategy.trustBuilding.slice(0, 2).join('; ')}`)
      console.log(`  - 差异化: ${response.report.marketingStrategy.differentiation.slice(0, 2).join('; ')}`)
      console.log(`\n爆款文案模式数: ${response.report.viralContentPatterns.length}`)
      console.log(`\nAI元数据:`)
      console.log(`  - 模型: ${response.report.aiMetadata.model}`)
      console.log(`  - Tokens: ${response.report.aiMetadata.analysisTokens}`)
      console.log(`  - 置信度: ${response.report.aiMetadata.confidence}`)
      console.log(`  - 耗时: ${response.report.aiMetadata.processingTime.toFixed(2)}秒`)
      console.log('─'.repeat(50))

      // 保存完整报告
      const fs = require('fs/promises')
      await fs.mkdir('data', { recursive: true })
      await fs.writeFile(
        'data/simple-test-ai-analysis.json',
        JSON.stringify(response.report, null, 2),
        'utf-8'
      )
      console.log('\n📄 完整报告已保存: data/simple-test-ai-analysis.json')
    } else {
      console.error('\n❌ 测试失败:', response.error)
      if (response.warnings) {
        console.warn('⚠️  警告:', response.warnings)
      }
    }
  } catch (error) {
    console.error('\n❌ 测试出错:', error)
    throw error
  }
}

simpleTest()
  .then(() => {
    console.log('\n✅ 所有测试完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  })