/**
 * 测试TikHub综合搜索API
 *
 * 使用方法:
 * npx tsx scripts/test-general-search.ts [keyword] [pages] [sort]
 *
 * 参数说明:
 * - keyword: 搜索关键词，默认"全屋定制"
 * - pages: 最大页数，默认1
 * - sort: 排序方式 0-综合 1-点赞最多 2-最新发布，默认0
 *
 * 示例:
 * npx tsx scripts/test-general-search.ts 全屋定制 2 1
 */

import 'dotenv/config'
import { TikHubClient } from '../lib/tikhub/client'

async function main() {
  const keyword = process.argv[2] || '全屋定制'
  const maxPages = parseInt(process.argv[3] || '1', 10)
  const sortType = (process.argv[4] || '0') as '0' | '1' | '2'

  const sortNames: Record<string, string> = {
    '0': '综合排序',
    '1': '最多点赞',
    '2': '最新发布',
  }

  console.log('='.repeat(60))
  console.log(`TikHub 综合搜索V4 测试`)
  console.log(`关键词: ${keyword}`)
  console.log(`最大页数: ${maxPages}`)
  console.log(`排序方式: ${sortNames[sortType]}`)
  console.log('='.repeat(60))
  console.log()

  // 检查API Key
  if (!process.env.TIKHUB_API_KEY) {
    console.error('错误: 请设置 TIKHUB_API_KEY 环境变量')
    process.exit(1)
  }

  const client = new TikHubClient()

  try {
    // 测试API连接
    console.log('正在测试API连接...')
    const connected = await client.testConnection()
    if (!connected) {
      console.error('API连接失败')
      process.exit(1)
    }
    console.log('API连接成功!')
    console.log()

    // 执行搜索
    console.log(`正在搜索 "${keyword}"...`)
    console.log()

    let totalResults = 0
    let pageNum = 0

    const allVideos: Array<{
      aweme_id: string
      desc: string
      author: string
      digg_count: number
      comment_count: number
      share_count: number
      play_count?: number
    }> = []

    for await (const result of client.getAllGeneralSearchV4Results(keyword, {
      maxPages,
      sort_type: sortType,
      onProgress: (current, total) => {
        console.log(`进度: ${current}/${total} 页`)
      },
    })) {
      pageNum++
      console.log()
      console.log(`--- 第 ${pageNum} 页 ---`)
      console.log(`结果数量: ${result.data?.length || 0}`)
      console.log(`是否有更多: ${result.has_more === 1 ? '是' : '否'}`)

      totalResults += result.data?.length || 0

      // 提取视频信息
      for (const item of result.data || []) {
        if (item.aweme_info) {
          const video = item.aweme_info
          allVideos.push({
            aweme_id: video.aweme_id,
            desc: video.desc?.slice(0, 60) || '无描述',
            author: video.author?.nickname || '未知作者',
            digg_count: video.statistics?.digg_count || 0,
            comment_count: video.statistics?.comment_count || 0,
            share_count: video.statistics?.share_count || 0,
            play_count: video.statistics?.play_count,
          })
        }
      }
    }

    // 输出统计信息
    console.log()
    console.log('='.repeat(60))
    console.log('搜索完成!')
    console.log('='.repeat(60))
    console.log(`总结果数: ${totalResults}`)
    console.log(`视频数量: ${allVideos.length}`)
    console.log()

    // 输出视频列表
    if (allVideos.length > 0) {
      console.log('视频列表:')
      console.log('-'.repeat(60))

      // 按点赞数排序（如果不是按点赞排序的话）
      if (sortType !== '1') {
        allVideos.sort((a, b) => b.digg_count - a.digg_count)
      }

      // 只显示前20个
      const displayVideos = allVideos.slice(0, 20)
      for (let i = 0; i < displayVideos.length; i++) {
        const video = displayVideos[i]
        console.log(`${i + 1}. ${video.desc}`)
        console.log(`   作者: ${video.author}`)
        console.log(
          `   互动: 点赞 ${formatNumber(video.digg_count)} | 评论 ${formatNumber(video.comment_count)} | 分享 ${formatNumber(video.share_count)}${video.play_count ? ` | 播放 ${formatNumber(video.play_count)}` : ''}`
        )
        console.log(`   ID: ${video.aweme_id}`)
        console.log()
      }

      if (allVideos.length > 20) {
        console.log(`... 还有 ${allVideos.length - 20} 个视频未显示`)
      }
    }

    // 导出完整数据到JSON文件
    const outputPath = `scripts/output/search-${keyword}-${Date.now()}.json`
    const fs = await import('fs/promises')
    const path = await import('path')

    // 确保输出目录存在
    const outputDir = path.dirname(outputPath)
    try {
      await fs.mkdir(outputDir, { recursive: true })
    } catch {
      // 目录已存在
    }

    await fs.writeFile(
      outputPath,
      JSON.stringify(
        {
          keyword,
          sortType: sortNames[sortType],
          searchTime: new Date().toISOString(),
          totalResults,
          videoCount: allVideos.length,
          videos: allVideos,
        },
        null,
        2
      ),
      'utf-8'
    )
    console.log()
    console.log(`完整数据已保存到: ${outputPath}`)
  } catch (error: any) {
    console.error('搜索失败:', error.message || error)
    if (error.details) {
      console.error('详情:', JSON.stringify(error.details, null, 2))
    }
    process.exit(1)
  }
}

function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  return num.toString()
}

main()
