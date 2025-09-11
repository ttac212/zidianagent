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
      return
    }

    `)
    // 2. 测试标签解析
    const tagMap = new Map<string, { count: number; engagementSum: number }>()
    let totalTags = 0

    testMerchant.contents.forEach((content, index) => {
      }...`)
      
      const tags = parseAndCleanTags(content.tags)
      const engagement = content.diggCount + content.commentCount + content.collectCount + content.shareCount
      
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

    topTags.forEach((tag, index) => {
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
        } catch (error) {
        }
    }
    // 5. 生成测试建议
    } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

// 运行测试
if (require.main === module) {
  testMerchantFeatures()
}

export { testMerchantFeatures }