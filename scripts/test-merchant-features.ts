/**
 * 测试商家功能脚本
 * 用于验证标签分析、导出功能、数据分析功能
 */

import { PrismaClient } from '@prisma/client'
import { parseAndCleanTags } from '../lib/utils/tag-parser'

const prisma = new PrismaClient()

async function testMerchantFeatures() {
  try {
    // 1. 获取一个商家用于测试
    const testMerchant = await prisma.merchant.findFirst({
      include: {
        contents: {
          take: 5 // 只取前5条内容进行测试
        }
      }
    })

    if (!testMerchant) {
      console.log('没有找到测试商家')
      return
    }

    console.log(`正在测试商家: ${testMerchant.name} (ID: ${testMerchant.id})`)
    // 2. 测试标签解析
    const tagMap = new Map<string, { count: number; engagementSum: number }>()
    let totalTags = 0

    testMerchant.contents.forEach((content, index) => {
      console.log(`  处理内容 ${index + 1}: ${content.title.substring(0, 30)}...`)
      
      const tags = parseAndCleanTags(content.tags)
      const engagement = content.diggCount + content.commentCount + content.collectCount + content.shareCount
      
      console.log(`  提取到 ${tags.length} 个标签`)
      tags.forEach(tag => {
        totalTags++
        const cleanTag = tag.toLowerCase()
        const existing = tagMap.get(cleanTag) || { count: 0, engagementSum: 0 }
        tagMap.set(cleanTag, {
          count: existing.count + 1,
          engagementSum: existing.engagementSum + engagement
        })
    })
      })

    // 3. 显示标签统计
    const topTags = Array.from(tagMap.entries())
      .map(([tag, stats]) => ({
        tag,
        count: stats.count,
        avgEngagement: Math.round(stats.engagementSum / stats.count)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    console.log(`\n热门标签 TOP 5:`)
    topTags.forEach((tag, index) => {
      console.log(`  ${index + 1}. ${tag.tag} - 出现 ${tag.count} 次，平均互动量 ${tag.avgEngagement}`)
    })
    // 4. 测试API端点可访问性
    const baseUrl = 'http://localhost:3007'
    const merchantId = testMerchant.id
    
    const endpoints = [
      { name: '商家详情', url: `/api/merchants/${merchantId}` },
      { name: '数据分析', url: `/api/merchants/${merchantId}/analytics` },
      { name: '标签分析', url: `/api/merchants/${merchantId}/tags` },
      { name: '导出内容', url: `/api/merchants/${merchantId}/export?type=content` },
      { name: '导出分析', url: `/api/merchants/${merchantId}/export?type=analytics` },
      { name: '导出标签', url: `/api/merchants/${merchantId}/export?type=tags` }
    ]

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint.url}`)
        const status = response.ok ? '成功' : '失败'
        console.log(`  ${status} ${endpoint.name}: HTTP ${response.status}`)
      } catch (error) {
        console.log(`  ${endpoint.name}: 连接失败 - ${error}`)
      }
    }
    // 5. 生成测试建议
    console.log(`\n商家功能测试完成`)
    console.log(`总计分析了 ${totalTags} 个标签，${topTags.length} 个热门标签`)
    
  } catch (error) {
    console.error('测试商家功能时出错:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行测试
if (require.main === module) {
  testMerchantFeatures()
}

export { testMerchantFeatures }