/**
 * 商家数据提取脚本
 * 从数据库读取商家信息并导出为 JSON 文件,用于批量分析
 */

import { PrismaClient } from '@prisma/client'
import fs from 'fs/promises'
import path from 'path'

const prisma = new PrismaClient()

interface MerchantExportData {
  id: string
  uid: string
  name: string
  description: string | null
  category: string | null
  location: string | null
  address: string | null
  businessType: string
  totalDiggCount: number
  totalCommentCount: number
  totalCollectCount: number
  totalShareCount: number
  totalContentCount: number
  dataSource: string
  status: string
  isVerified: boolean
  lastCollectedAt: string | null
  createdAt: string
  updatedAt: string

  // 聚合统计
  videoCount: number
  articleCount: number
  imageCount: number
  audioCount: number
  otherCount: number

  // 最近内容
  recentContents: Array<{
    title: string
    contentType: string
    transcript?: string | null
    diggCount: number
    commentCount: number
    collectCount: number
    shareCount: number
    publishedAt: string | null
  }>
}

async function exportMerchantData(options: {
  limit?: number
  status?: string
  outputPath?: string
}) {
  const { limit, status = 'ACTIVE', outputPath = 'data/merchants-export.json' } = options

  console.log('🔄 开始提取商家数据...')

  // 查询商家数据
  const merchants = await prisma.merchant.findMany({
    where: status ? { status: status as any } : undefined,
    take: limit,
    include: {
      category: true,
      contents: {
        orderBy: { publishedAt: 'desc' },
        take: 10, // 最近10条内容
      },
    },
    orderBy: { totalContentCount: 'desc' }, // 按内容数量排序
  })

  console.log(`📊 查询到 ${merchants.length} 个商家`)

  // 转换为导出格式
  const exportData: MerchantExportData[] = merchants.map(merchant => {
    // 统计各类型内容数量
    const contentStats = merchant.contents.reduce(
      (acc, content) => {
        acc[content.contentType.toLowerCase() + 'Count']++
        return acc
      },
      { videoCount: 0, articleCount: 0, imageCount: 0, audioCount: 0, otherCount: 0 }
    )

    return {
      id: merchant.id,
      uid: merchant.uid,
      name: merchant.name,
      description: merchant.description,
      category: merchant.category?.name || null,
      location: merchant.location,
      address: merchant.address,
      businessType: merchant.businessType,
      totalDiggCount: merchant.totalDiggCount,
      totalCommentCount: merchant.totalCommentCount,
      totalCollectCount: merchant.totalCollectCount,
      totalShareCount: merchant.totalShareCount,
      totalContentCount: merchant.totalContentCount,
      dataSource: merchant.dataSource,
      status: merchant.status,
      isVerified: merchant.isVerified,
      lastCollectedAt: merchant.lastCollectedAt?.toISOString() || null,
      createdAt: merchant.createdAt.toISOString(),
      updatedAt: merchant.updatedAt.toISOString(),

      ...contentStats,

      recentContents: merchant.contents.map(content => ({
        title: content.title,
        contentType: content.contentType,
        transcript: content.transcript,
        diggCount: content.diggCount,
        commentCount: content.commentCount,
        collectCount: content.collectCount,
        shareCount: content.shareCount,
        publishedAt: content.publishedAt?.toISOString() || null,
      })),
    }
  })

  // 确保输出目录存在
  const dir = path.dirname(outputPath)
  await fs.mkdir(dir, { recursive: true })

  // 写入文件
  await fs.writeFile(
    outputPath,
    JSON.stringify(exportData, null, 2),
    'utf-8'
  )

  console.log(`✅ 成功导出 ${exportData.length} 个商家数据到: ${outputPath}`)
  console.log(`📁 文件大小: ${(await fs.stat(outputPath)).size / 1024} KB`)

  // 打印统计信息
  const totalVideos = exportData.reduce((sum, m) => sum + m.videoCount, 0)
  const totalContents = exportData.reduce((sum, m) => sum + m.totalContentCount, 0)

  console.log('\n📈 统计信息:')
  console.log(`  - 总商家数: ${exportData.length}`)
  console.log(`  - 总内容数: ${totalContents}`)
  console.log(`  - 总视频数: ${totalVideos}`)
  console.log(`  - 平均内容/商家: ${(totalContents / exportData.length).toFixed(1)}`)

  return exportData
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const limit = args[0] ? parseInt(args[0]) : undefined
    const status = args[1] || 'ACTIVE'
    const outputPath = args[2] || 'data/merchants-export.json'

    await exportMerchantData({ limit, status, outputPath })
  } catch (error) {
    console.error('❌ 导出失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

export { exportMerchantData, type MerchantExportData }
