/**
 * 商家批量分析脚本
 * 读取导出的商家数据,并为每个商家生成分析报告
 */

import fs from 'fs/promises'
import path from 'path'
import type { MerchantExportData } from './export-merchant-data'

interface AnalysisReport {
  merchantId: string
  merchantName: string
  analysisDate: string

  // 基本信息
  basicInfo: {
    uid: string
    name: string
    category: string | null
    location: string | null
    businessType: string
    status: string
    dataSource: string
  }

  // 内容统计
  contentStats: {
    totalCount: number
    videoCount: number
    articleCount: number
    imageCount: number
    audioCount: number
    otherCount: number
    contentTypeDistribution: string // 如: "视频70%, 文章20%, 其他10%"
  }

  // 互动数据
  engagementMetrics: {
    totalDiggs: number
    totalComments: number
    totalCollects: number
    totalShares: number
    avgDiggsPerContent: number
    avgCommentsPerContent: number
    engagementRate: string // 综合互动率
  }

  // 内容特点
  contentInsights: {
    mostPopularContentType: string
    avgPublishFrequency: string // 根据最近内容推测
    topPerformingContent: Array<{
      title: string
      diggCount: number
      commentCount: number
    }>
  }

  // 商家特征标签
  tags: string[]

  // 短视频文案建议
  videoScriptSuggestions: string[]
}

/**
 * 分析单个商家数据
 */
function analyzeMerchant(merchant: MerchantExportData): AnalysisReport {
  // 基本信息
  const basicInfo = {
    uid: merchant.uid,
    name: merchant.name,
    category: merchant.category,
    location: merchant.location,
    businessType: merchant.businessType,
    status: merchant.status,
    dataSource: merchant.dataSource,
  }

  // 内容统计
  const totalContent = merchant.totalContentCount || 1 // 避免除零
  const contentStats = {
    totalCount: merchant.totalContentCount,
    videoCount: merchant.videoCount,
    articleCount: merchant.articleCount,
    imageCount: merchant.imageCount,
    audioCount: merchant.audioCount,
    otherCount: merchant.otherCount,
    contentTypeDistribution: calculateContentDistribution(merchant),
  }

  // 互动数据
  const engagementMetrics = {
    totalDiggs: merchant.totalDiggCount,
    totalComments: merchant.totalCommentCount,
    totalCollects: merchant.totalCollectCount,
    totalShares: merchant.totalShareCount,
    avgDiggsPerContent: Math.round(merchant.totalDiggCount / totalContent),
    avgCommentsPerContent: Math.round(merchant.totalCommentCount / totalContent),
    engagementRate: calculateEngagementRate(merchant),
  }

  // 内容特点
  const mostPopularType = getMostPopularContentType(merchant)
  const topContents = merchant.recentContents
    .sort((a, b) => b.diggCount - a.diggCount)
    .slice(0, 3)
    .map(c => ({
      title: c.title,
      diggCount: c.diggCount,
      commentCount: c.commentCount,
    }))

  const contentInsights = {
    mostPopularContentType: mostPopularType,
    avgPublishFrequency: estimatePublishFrequency(merchant),
    topPerformingContent: topContents,
  }

  // 生成特征标签
  const tags = generateTags(merchant, engagementMetrics)

  // 生成短视频文案建议
  const videoScriptSuggestions = generateVideoScriptSuggestions(
    merchant,
    engagementMetrics,
    tags
  )

  return {
    merchantId: merchant.id,
    merchantName: merchant.name,
    analysisDate: new Date().toISOString(),
    basicInfo,
    contentStats,
    engagementMetrics,
    contentInsights,
    tags,
    videoScriptSuggestions,
  }
}

/**
 * 计算内容类型分布
 */
function calculateContentDistribution(merchant: MerchantExportData): string {
  const total = merchant.totalContentCount || 1
  const video = Math.round((merchant.videoCount / total) * 100)
  const article = Math.round((merchant.articleCount / total) * 100)
  const image = Math.round((merchant.imageCount / total) * 100)

  const parts: string[] = []
  if (video > 0) parts.push(`视频${video}%`)
  if (article > 0) parts.push(`文章${article}%`)
  if (image > 0) parts.push(`图片${image}%`)

  return parts.join(', ') || '暂无数据'
}

/**
 * 计算综合互动率
 */
function calculateEngagementRate(merchant: MerchantExportData): string {
  const totalContent = merchant.totalContentCount || 1
  const totalEngagement =
    merchant.totalDiggCount +
    merchant.totalCommentCount +
    merchant.totalCollectCount +
    merchant.totalShareCount

  const rate = totalEngagement / totalContent

  if (rate > 10000) return '极高'
  if (rate > 5000) return '高'
  if (rate > 1000) return '中等'
  if (rate > 100) return '一般'
  return '较低'
}

/**
 * 获取最受欢迎的内容类型
 */
function getMostPopularContentType(merchant: MerchantExportData): string {
  const types = [
    { name: '视频', count: merchant.videoCount },
    { name: '文章', count: merchant.articleCount },
    { name: '图片', count: merchant.imageCount },
    { name: '音频', count: merchant.audioCount },
  ]

  const max = types.reduce((prev, curr) =>
    curr.count > prev.count ? curr : prev
  )

  return max.count > 0 ? max.name : '暂无'
}

/**
 * 估算发布频率
 */
function estimatePublishFrequency(merchant: MerchantExportData): string {
  if (merchant.recentContents.length < 2) return '不定期'

  // 简单估算: 基于最近10条内容的时间跨度
  const dates = merchant.recentContents
    .map(c => c.publishedAt)
    .filter((d): d is string => d !== null)
    .map(d => new Date(d).getTime())

  if (dates.length < 2) return '不定期'

  const span = Math.max(...dates) - Math.min(...dates)
  const days = span / (1000 * 60 * 60 * 24)
  const frequency = dates.length / (days || 1)

  if (frequency > 1) return '每天多条'
  if (frequency > 0.5) return '每天1-2条'
  if (frequency > 0.2) return '每周2-3条'
  return '每周1条左右'
}

/**
 * 生成特征标签
 */
function generateTags(
  merchant: MerchantExportData,
  metrics: AnalysisReport['engagementMetrics']
): string[] {
  const tags: string[] = []

  // 业务类型
  tags.push(merchant.businessType)

  // 分类
  if (merchant.category) tags.push(merchant.category)

  // 地域
  if (merchant.location) tags.push(merchant.location)

  // 内容特征
  if (merchant.videoCount > merchant.totalContentCount * 0.7) {
    tags.push('视频为主')
  }
  if (merchant.articleCount > merchant.totalContentCount * 0.3) {
    tags.push('图文内容')
  }

  // 互动特征
  if (metrics.engagementRate === '极高' || metrics.engagementRate === '高') {
    tags.push('高互动')
  }
  if (metrics.avgDiggsPerContent > 1000) {
    tags.push('高点赞')
  }

  // 数据来源
  tags.push(`来源:${merchant.dataSource}`)

  return tags
}

/**
 * 生成短视频文案建议
 */
function generateVideoScriptSuggestions(
  merchant: MerchantExportData,
  metrics: AnalysisReport['engagementMetrics'],
  tags: string[]
): string[] {
  const suggestions: string[] = []

  // 基于商家名称和分类的建议
  suggestions.push(
    `介绍"${merchant.name}"的核心业务和特色服务`
  )

  // 基于热门内容的建议
  if (merchant.recentContents.length > 0) {
    const topContent = merchant.recentContents[0]
    suggestions.push(
      `参考热门内容"${topContent.title.substring(0, 20)}..."的创作角度`
    )
  }

  // 基于互动数据的建议
  if (metrics.avgDiggsPerContent > 500) {
    suggestions.push(
      `强调用户喜爱的内容点,平均每条${metrics.avgDiggsPerContent}个点赞`
    )
  }

  // 基于内容类型的建议
  if (merchant.videoCount > merchant.articleCount) {
    suggestions.push(
      '延续视频内容优势,创作短视频系列'
    )
  }

  // 基于地域的建议
  if (merchant.location) {
    suggestions.push(
      `融入${merchant.location}的地域特色和文化元素`
    )
  }

  return suggestions
}

/**
 * 批量分析商家
 */
async function batchAnalyzeMerchants(options: {
  inputPath?: string
  outputDir?: string
  batchSize?: number
}) {
  const {
    inputPath = 'data/merchants-export.json',
    outputDir = 'data/analysis-reports',
    batchSize = 10,
  } = options

  console.log('📖 读取商家数据...')

  // 读取导出的商家数据
  const data = await fs.readFile(inputPath, 'utf-8')
  const merchants: MerchantExportData[] = JSON.parse(data)

  console.log(`📊 共 ${merchants.length} 个商家待分析`)

  // 确保输出目录存在
  await fs.mkdir(outputDir, { recursive: true })

  // 批量处理
  const reports: AnalysisReport[] = []

  for (let i = 0; i < merchants.length; i += batchSize) {
    const batch = merchants.slice(i, i + batchSize)
    console.log(`\n🔄 处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(merchants.length / batchSize)}`)

    // 分析当前批次
    for (const merchant of batch) {
      console.log(`  - 分析: ${merchant.name}`)
      const report = analyzeMerchant(merchant)
      reports.push(report)

      // 保存单个报告
      const reportPath = path.join(
        outputDir,
        `${merchant.uid}_${merchant.name.replace(/[\/\\:*?"<>|]/g, '_')}.json`
      )
      await fs.writeFile(
        reportPath,
        JSON.stringify(report, null, 2),
        'utf-8'
      )
    }
  }

  // 保存汇总报告
  const summaryPath = path.join(outputDir, 'summary.json')
  await fs.writeFile(
    summaryPath,
    JSON.stringify({
      totalMerchants: reports.length,
      analysisDate: new Date().toISOString(),
      reports: reports.map(r => ({
        merchantId: r.merchantId,
        merchantName: r.merchantName,
        category: r.basicInfo.category,
        location: r.basicInfo.location,
        contentCount: r.contentStats.totalCount,
        engagementRate: r.engagementMetrics.engagementRate,
        tags: r.tags,
      })),
    }, null, 2),
    'utf-8'
  )

  console.log(`\n✅ 分析完成!`)
  console.log(`📁 报告目录: ${outputDir}`)
  console.log(`📄 单个报告数: ${reports.length}`)
  console.log(`📋 汇总报告: ${summaryPath}`)

  return reports
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const inputPath = args[0] || 'data/merchants-export.json'
    const outputDir = args[1] || 'data/analysis-reports'
    const batchSize = args[2] ? parseInt(args[2]) : 10

    await batchAnalyzeMerchants({ inputPath, outputDir, batchSize })
  } catch (error) {
    console.error('❌ 分析失败:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { batchAnalyzeMerchants, analyzeMerchant, type AnalysisReport }
