/**
 * TikHub API 热门内容词测试脚本
 *
 * 测试 TikHub API 的热门内容词接口
 * 端点: /api/v1/douyin/billboard/fetch_hot_total_hot_word_list (POST)
 *
 * 使用方法:
 * npx tsx scripts/test-hot-word-list.ts
 * npx tsx scripts/test-hot-word-list.ts --keyword=美食  # 搜索关键词
 * npx tsx scripts/test-hot-word-list.ts --window=1 --size=50  # 按小时窗口，每页50条
 */

// 必须在最顶部加载环境变量，在任何其他 import 之前
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { getTikHubClient } from '@/lib/tikhub'
import type { HotWordInfo } from '@/lib/tikhub/types'

/**
 * 格式化热度值（缩写形式）
 */
function formatHotValue(value: number): string {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)}亿`
  } else if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`
  }
  return value.toString()
}

/**
 * 测试获取热门内容词列表（全部）
 */
async function testGetAllHotWords(options: {
  dateWindow?: number
  pageSize?: number
}) {
  console.log('=== 测试获取热门内容词列表（全部）===\n')

  try {
    const client = getTikHubClient({
      apiKey: process.env.TIKHUB_API_KEY,
      baseURL: process.env.TIKHUB_API_BASE_URL,
    })

    const { dateWindow = 24, pageSize = 10 } = options

    console.log(`查询参数:`)
    console.log(`  时间窗口: ${dateWindow === 1 ? '按小时' : '按天'}`)
    console.log(`  每页数量: ${pageSize}`)
    console.log(`  关键词筛选: 无\n`)

    console.log('正在获取热门内容词...\n')
    const response = await client.getHotWordList({
      page_num: 1,
      page_size: pageSize,
      date_window: dateWindow,
    })

    // 检查响应数据
    if (!response || !response.data || !response.data.word_list) {
      console.error('❌ 响应数据格式错误')
      console.log('响应内容:', JSON.stringify(response, null, 2))
      return false
    }

    const words = response.data.word_list
    const total = response.data.total_count
    const hasMore = words.length < total

    console.log(`✅ 成功获取热门内容词`)
    console.log(`本页数量: ${words.length}`)
    console.log(`总数: ${total}`)
    console.log(`有更多数据: ${hasMore ? '是' : '否'}\n`)

    // 显示词列表
    console.log('=== 热门内容词列表 ===\n')
    words.forEach((word: HotWordInfo, index: number) => {
      const rank = index + 1
      console.log(`${rank}. ${word.title}`)
      console.log(`   热度值: ${formatHotValue(word.score)}`)
      if (word.rising_ratio > 0) {
        console.log(`   上升比例: ${(word.rising_ratio * 100).toFixed(2)}%`)
      }
      if (word.rising_speed) {
        console.log(`   上升速度: ${word.rising_speed}`)
      }
      if (word.trends && word.trends.length > 0) {
        const latestTrend = word.trends[word.trends.length - 1]
        console.log(`   最新趋势: ${latestTrend.date} - ${formatHotValue(latestTrend.value)}`)
      }
      console.log()
    })

    // 保存完整数据到文件
    const fs = await import('fs/promises')
    const outputPath = './hot-word-list-output.json'
    await fs.writeFile(
      outputPath,
      JSON.stringify(
        {
          queryParams: {
            dateWindow,
            pageSize,
            keyword: '无',
          },
          total: total,
          count: words.length,
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
 * 测试搜索特定关键词的热门内容词
 */
async function testSearchHotWords(options: {
  keyword: string
  dateWindow?: number
  pageSize?: number
}) {
  const { keyword, dateWindow = 24, pageSize = 10 } = options

  console.log(`=== 测试搜索热门内容词（关键词: ${keyword}）===\n`)

  try {
    const client = getTikHubClient({
      apiKey: process.env.TIKHUB_API_KEY,
      baseURL: process.env.TIKHUB_API_BASE_URL,
    })

    console.log(`查询参数:`)
    console.log(`  时间窗口: ${dateWindow === 1 ? '按小时' : '按天'}`)
    console.log(`  每页数量: ${pageSize}`)
    console.log(`  搜索关键词: ${keyword}\n`)

    console.log('正在搜索热门内容词...\n')
    const response = await client.getHotWordList({
      page_num: 1,
      page_size: pageSize,
      date_window: dateWindow,
      keyword: keyword,
    })

    // 检查响应数据
    if (!response || !response.data || !response.data.word_list) {
      console.error('❌ 响应数据格式错误')
      console.log('响应内容:', JSON.stringify(response, null, 2))
      return false
    }

    const words = response.data.word_list
    const total = response.data.total_count
    const hasMore = words.length < total

    console.log(`✅ 成功获取热门内容词`)
    console.log(`本页数量: ${words.length}`)
    console.log(`总数: ${total}`)
    console.log(`有更多数据: ${hasMore ? '是' : '否'}\n`)

    // 显示词列表
    console.log(`=== 包含"${keyword}"的热门内容词列表 ===\n`)
    if (words.length === 0) {
      console.log('未找到匹配的内容词\n')
    } else {
      words.forEach((word: HotWordInfo, index: number) => {
        const rank = index + 1
        console.log(`${rank}. ${word.title}`)
        console.log(`   热度值: ${formatHotValue(word.score)}`)
        if (word.rising_ratio > 0) {
          console.log(`   上升比例: ${(word.rising_ratio * 100).toFixed(2)}%`)
        }
        if (word.rising_speed) {
          console.log(`   上升速度: ${word.rising_speed}`)
        }
        if (word.trends && word.trends.length > 0) {
          const latestTrend = word.trends[word.trends.length - 1]
          console.log(`   最新趋势: ${latestTrend.date} - ${formatHotValue(latestTrend.value)}`)
        }
        console.log()
      })
    }

    // 保存完整数据到文件
    const fs = await import('fs/promises')
    const outputPath = `./hot-word-list-${keyword}-output.json`
    await fs.writeFile(
      outputPath,
      JSON.stringify(
        {
          queryParams: {
            dateWindow,
            pageSize,
            keyword,
          },
          total: total,
          count: words.length,
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
 * 主函数
 */
async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║     TikHub API - 热门内容词测试工具              ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // 解析命令行参数
  const args = process.argv.slice(2)
  const keywordParam = args.find((arg) => arg.startsWith('--keyword='))?.split('=')[1]
  const windowParam = args.find((arg) => arg.startsWith('--window='))?.split('=')[1]
  const sizeParam = args.find((arg) => arg.startsWith('--size='))?.split('=')[1]

  const dateWindow = windowParam ? parseInt(windowParam, 10) : 24
  const pageSize = sizeParam ? parseInt(sizeParam, 10) : 10

  const tests: Array<{ name: string; fn: () => Promise<boolean> }> = []

  if (keywordParam) {
    // 搜索特定关键词的热门内容词
    tests.push({
      name: `搜索热门内容词（关键词: ${keywordParam}）`,
      fn: () =>
        testSearchHotWords({
          keyword: keywordParam,
          dateWindow,
          pageSize,
        }),
    })
  } else {
    // 获取全部热门内容词
    tests.push({
      name: '获取全部热门内容词',
      fn: () =>
        testGetAllHotWords({
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

export { testGetAllHotWords, testSearchHotWords }
