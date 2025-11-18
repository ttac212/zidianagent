/**
 * TikHub API 低粉爆款榜测试脚本
 *
 * 测试 TikHub API 的低粉爆款榜接口
 * 端点: /api/v1/douyin/billboard/fetch_hot_total_low_fan_list (POST)
 *
 * 使用方法:
 * npx tsx scripts/test-low-fan-list.ts
 * npx tsx scripts/test-low-fan-list.ts --tag=628  # 美食垂类
 * npx tsx scripts/test-low-fan-list.ts --window=1 --size=20  # 按小时窗口，每页20条
 */

// 必须在最顶部加载环境变量，在任何其他 import 之前
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { getTikHubClient } from '@/lib/tikhub'
import type { LowFanVideoInfo, HotVideoListTag } from '@/lib/tikhub/types'

/**
 * 格式化播放数（缩写形式）
 */
function formatPlayCount(count: number): string {
  if (count >= 100000000) {
    return `${(count / 100000000).toFixed(1)}亿`
  } else if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万`
  }
  return count.toString()
}

/**
 * 格式化点赞数（缩写形式）
 */
function formatLikeCount(count: number): string {
  if (count >= 100000000) {
    return `${(count / 100000000).toFixed(1)}亿`
  } else if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万`
  }
  return count.toString()
}

/**
 * 格式化时间
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}天前`
  } else if (hours > 0) {
    return `${hours}小时前`
  } else {
    return '刚刚'
  }
}

/**
 * 测试获取低粉爆款榜列表（全部垂类）
 */
async function testGetAllLowFanVideos(options: {
  dateWindow?: number
  pageSize?: number
}) {
  console.log('=== 测试获取低粉爆款榜列表（全部垂类）===\n')

  try {
    const client = getTikHubClient({
      apiKey: process.env.TIKHUB_API_KEY,
      baseURL: process.env.TIKHUB_API_BASE_URL,
    })

    const { dateWindow = 24, pageSize = 10 } = options

    console.log(`查询参数:`)
    console.log(`  时间窗口: ${dateWindow === 1 ? '按小时' : '按天'}`)
    console.log(`  每页数量: ${pageSize}`)
    console.log(`  垂类筛选: 全部\n`)

    console.log('正在获取低粉爆款榜...\n')
    const response = await client.getLowFanList({
      page: 1,
      page_size: pageSize,
      date_window: dateWindow,
    })

    // 检查响应数据
    if (!response || !response.data || !response.data.objs) {
      console.error('❌ 响应数据格式错误')
      console.log('响应内容:', JSON.stringify(response, null, 2))
      return false
    }

    const videos = response.data.objs
    const total = response.data.page.total
    const hasMore = videos.length < total

    console.log(`✅ 成功获取低粉爆款榜`)
    console.log(`本页数量: ${videos.length}`)
    if (total !== undefined) console.log(`总数: ${total}`)
    if (hasMore !== undefined) console.log(`有更多数据: ${hasMore ? '是' : '否'}\n`)

    // 显示视频列表
    console.log('=== 低粉爆款视频列表 ===\n')
    videos.forEach((video, index) => {
      const rank = video.rank || index + 1
      console.log(`${rank}. ${video.item_title ? video.item_title.slice(0, 50) : '无标题'}${video.item_title && video.item_title.length > 50 ? '...' : ''}`)
      console.log(`   作者: ${video.nick_name}`)
      console.log(`   播放: ${formatPlayCount(video.play_cnt)}`)
      console.log(`   点赞: ${formatLikeCount(video.like_cnt)}`)
      console.log(`   粉丝: ${formatLikeCount(video.fans_cnt)}`)
      console.log(`   关注: ${formatLikeCount(video.follow_cnt)}`)
      if (video.score) {
        console.log(`   热度值: ${video.score}`)
      }
      console.log(`   发布时间: ${formatTime(video.publish_time)}`)
      console.log(`   视频ID: ${video.item_id}`)
      console.log()
    })

    // 保存完整数据到文件
    const fs = await import('fs/promises')
    const outputPath = './low-fan-list-output.json'
    await fs.writeFile(
      outputPath,
      JSON.stringify(
        {
          queryParams: {
            dateWindow,
            pageSize,
            category: '全部',
          },
          total: total,
          count: videos.length,
          hasMore: hasMore,
          data: response,
        },
        null,
        2
      )
    )
    console.log(`📄 完整数据已保存到: ${outputPath}\n`)

    return true
  } catch (error: any) {
    console.error('❌ 测试失败:', error.message)
    if (error.code) {
      console.error('错误码:', error.code)
    }
    if (error.details) {
      console.error('详细信息:', JSON.stringify(error.details, null, 2))
    }
    return false
  }
}

/**
 * 测试获取特定垂类的低粉爆款榜
 */
async function testGetCategoryLowFanVideos(options: {
  tagId: number
  tagName?: string
  dateWindow?: number
  pageSize?: number
}) {
  const { tagId, tagName = '未知', dateWindow = 24, pageSize = 10 } = options

  console.log(`=== 测试获取低粉爆款榜列表（${tagName}垂类）===\n`)

  try {
    const client = getTikHubClient({
      apiKey: process.env.TIKHUB_API_KEY,
      baseURL: process.env.TIKHUB_API_BASE_URL,
    })

    const tags: HotVideoListTag[] = [{ value: tagId }]

    console.log(`查询参数:`)
    console.log(`  时间窗口: ${dateWindow === 1 ? '按小时' : '按天'}`)
    console.log(`  每页数量: ${pageSize}`)
    console.log(`  垂类筛选: ${tagName} (ID: ${tagId})\n`)

    console.log('正在获取低粉爆款榜...\n')
    const response = await client.getLowFanList({
      page: 1,
      page_size: pageSize,
      date_window: dateWindow,
      tags: tags,
    })

    // 检查响应数据
    if (!response || !response.data || !response.data.objs) {
      console.error('❌ 响应数据格式错误')
      console.log('响应内容:', JSON.stringify(response, null, 2))
      return false
    }

    const videos = response.data.objs
    const total = response.data.page.total
    const hasMore = videos.length < total

    console.log(`✅ 成功获取低粉爆款榜`)
    console.log(`本页数量: ${videos.length}`)
    if (total !== undefined) console.log(`总数: ${total}`)
    if (hasMore !== undefined) console.log(`有更多数据: ${hasMore ? '是' : '否'}\n`)

    // 显示视频列表
    console.log(`=== ${tagName}垂类 - 低粉爆款视频列表 ===\n`)
    videos.forEach((video, index) => {
      const rank = video.rank || index + 1
      console.log(`${rank}. ${video.item_title ? video.item_title.slice(0, 50) : '无标题'}${video.item_title && video.item_title.length > 50 ? '...' : ''}`)
      console.log(`   作者: ${video.nick_name}`)
      console.log(`   播放: ${formatPlayCount(video.play_cnt)}`)
      console.log(`   点赞: ${formatLikeCount(video.like_cnt)}`)
      console.log(`   粉丝: ${formatLikeCount(video.fans_cnt)}`)
      console.log(`   关注: ${formatLikeCount(video.follow_cnt)}`)
      if (video.score) {
        console.log(`   热度值: ${video.score}`)
      }
      console.log(`   发布时间: ${formatTime(video.publish_time)}`)
      console.log()
    })

    // 保存完整数据到文件
    const fs = await import('fs/promises')
    const outputPath = `./low-fan-list-${tagId}-output.json`
    await fs.writeFile(
      outputPath,
      JSON.stringify(
        {
          queryParams: {
            dateWindow,
            pageSize,
            category: tagName,
            tagId,
          },
          total: total,
          count: videos.length,
          hasMore: hasMore,
          data: response,
        },
        null,
        2
      )
    )
    console.log(`📄 完整数据已保存到: ${outputPath}\n`)

    return true
  } catch (error: any) {
    console.error('❌ 测试失败:', error.message)
    if (error.code) {
      console.error('错误码:', error.code)
    }
    if (error.details) {
      console.error('详细信息:', JSON.stringify(error.details, null, 2))
    }
    return false
  }
}

/**
 * 获取标签名称（通过标签ID查找）
 */
async function getTagName(tagId: number): Promise<string> {
  try {
    const client = getTikHubClient({
      apiKey: process.env.TIKHUB_API_KEY,
      baseURL: process.env.TIKHUB_API_BASE_URL,
    })

    const response = await client.getContentTags()
    if (response && response.data) {
      const tag = response.data.find((t) => t.value === tagId)
      if (tag) return tag.label
    }
    return `标签${tagId}`
  } catch (error) {
    return `标签${tagId}`
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║     TikHub API - 低粉爆款榜测试工具              ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // 解析命令行参数
  const args = process.argv.slice(2)
  const tagParam = args.find((arg) => arg.startsWith('--tag='))?.split('=')[1]
  const windowParam = args.find((arg) => arg.startsWith('--window='))?.split('=')[1]
  const sizeParam = args.find((arg) => arg.startsWith('--size='))?.split('=')[1]

  const dateWindow = windowParam ? parseInt(windowParam, 10) : 24
  const pageSize = sizeParam ? parseInt(sizeParam, 10) : 10

  const tests: Array<{ name: string; fn: () => Promise<boolean> }> = []

  if (tagParam) {
    // 获取特定垂类的低粉爆款榜
    const tagId = parseInt(tagParam, 10)
    const tagName = await getTagName(tagId)

    tests.push({
      name: `获取${tagName}垂类低粉爆款榜`,
      fn: () =>
        testGetCategoryLowFanVideos({
          tagId,
          tagName,
          dateWindow,
          pageSize,
        }),
    })
  } else {
    // 获取全部垂类的低粉爆款榜
    tests.push({
      name: '获取全部垂类低粉爆款榜',
      fn: () =>
        testGetAllLowFanVideos({
          dateWindow,
          pageSize,
        }),
    })
  }

  const results: Array<{ name: string; passed: boolean }> = []

  for (const test of tests) {
    const passed = await test.fn()
    results.push({ name: test.name, passed })

    // 每个测试之间延迟500ms
    if (tests.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  // 输出测试摘要
  if (results.length > 1) {
    console.log('\n╔══════════════════════════════════════════════════╗')
    console.log('║              测试结果摘要                        ║')
    console.log('╚══════════════════════════════════════════════════╝\n')

    results.forEach(({ name, passed }) => {
      const status = passed ? '✅ 通过' : '❌ 失败'
      console.log(`${name.padEnd(30)} ${status}`)
    })

    const totalPassed = results.filter((r) => r.passed).length
    const totalTests = results.length

    console.log(`\n总计: ${totalPassed}/${totalTests} 测试通过`)

    if (totalPassed === totalTests) {
      console.log('\n🎉 所有测试通过！\n')
    } else {
      console.log('\n⚠️  部分测试失败，请检查错误信息。\n')
    }
  }
}

// 运行测试
if (require.main === module) {
  main()
    .catch((error) => {
      console.error('测试运行失败:', error)
      process.exit(1)
    })
    .finally(() => {
      process.exit(0)
    })
}

export { testGetAllLowFanVideos, testGetCategoryLowFanVideos }
