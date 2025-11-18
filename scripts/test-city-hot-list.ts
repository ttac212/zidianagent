/**
 * TikHub API 同城热点榜测试脚本
 *
 * 测试 TikHub API 的同城热点榜接口
 * 端点: /api/v1/douyin/billboard/fetch_hot_city_list (GET)
 *
 * 使用方法:
 * npx tsx scripts/test-city-hot-list.ts
 * npx tsx scripts/test-city-hot-list.ts --city=110000  # 指定城市（北京）
 * npx tsx scripts/test-city-hot-list.ts --keyword=美食  # 搜索关键词
 * npx tsx scripts/test-city-hot-list.ts --order=rank_diff --size=20  # 按排名变化排序
 */

// 必须在最顶部加载环境变量，在任何其他 import 之前
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { getTikHubClient } from '@/lib/tikhub'
import type { CityHotInfo } from '@/lib/tikhub/types'

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
 * 格式化排名变化
 */
function formatRankDiff(diff: number): string {
  if (diff > 0) {
    return `↑${diff}`
  } else if (diff < 0) {
    return `↓${Math.abs(diff)}`
  }
  return '-'
}

/**
 * 测试获取同城热点榜（全部城市）
 */
async function testGetAllCityHots(options: {
  order?: 'rank' | 'rank_diff'
  pageSize?: number
}) {
  console.log('=== 测试获取同城热点榜（全部城市）===\n')

  try {
    const client = getTikHubClient({
      apiKey: process.env.TIKHUB_API_KEY,
      baseURL: process.env.TIKHUB_API_BASE_URL,
    })

    const { order = 'rank', pageSize = 10 } = options

    console.log(`查询参数:`)
    console.log(`  排序方式: ${order === 'rank' ? '按热度' : '按排名变化'}`)
    console.log(`  每页数量: ${pageSize}`)
    console.log(`  城市筛选: 全部`)
    console.log(`  关键词筛选: 无\n`)

    console.log('正在获取同城热点榜...\n')
    const response = await client.getCityHotList({
      page: 1,
      page_size: pageSize,
      order: order,
    })

    // 检查响应数据
    if (!response || !response.data) {
      console.error('❌ 响应数据格式错误')
      console.log('响应内容:', JSON.stringify(response, null, 2))
      return false
    }

    const hots = response.data.objs || []
    const pageInfo = response.data.page
    const total = pageInfo?.total || hots.length
    const hasMore = pageInfo ? pageInfo.page * pageInfo.page_size < total : false

    console.log(`✅ 成功获取同城热点榜`)
    console.log(`本页数量: ${hots.length}`)
    console.log(`总数: ${total}`)
    console.log(`有更多数据: ${hasMore ? '是' : '否'}\n`)

    // 显示热点列表
    console.log('=== 同城热点榜列表 ===\n')
    hots.forEach((hot: CityHotInfo, index: number) => {
      const rank = hot.rank || index + 1
      console.log(`${rank}. ${hot.sentence}`)
      console.log(`   热度值: ${formatHotValue(hot.hot_score)}`)
      if (hot.rank_diff !== undefined && hot.rank_diff !== 0) {
        console.log(`   排名变化: ${formatRankDiff(hot.rank_diff)}`)
      }
      if (hot.sentence_tag) {
        console.log(`   分类: ${hot.sentence_tag}`)
      }
      if (hot.city_name) {
        console.log(`   城市: ${hot.city_name}`)
      }
      if (hot.video_count) {
        console.log(`   相关视频: ${formatHotValue(hot.video_count)}`)
      }
      console.log()
    })

    // 保存完整数据到文件
    const fs = await import('fs/promises')
    const outputPath = './city-hot-list-output.json'
    await fs.writeFile(
      outputPath,
      JSON.stringify(
        {
          queryParams: {
            order,
            pageSize,
            city: '全部',
            keyword: '无',
          },
          total: total,
          count: hots.length,
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
 * 测试获取特定城市的热点榜
 */
async function testGetCityHots(options: {
  cityCode: string
  cityName?: string
  order?: 'rank' | 'rank_diff'
  pageSize?: number
}) {
  const { cityCode, cityName, order = 'rank', pageSize = 10 } = options

  console.log(`=== 测试获取同城热点榜（${cityName || cityCode}）===\n`)

  try {
    const client = getTikHubClient({
      apiKey: process.env.TIKHUB_API_KEY,
      baseURL: process.env.TIKHUB_API_BASE_URL,
    })

    console.log(`查询参数:`)
    console.log(`  排序方式: ${order === 'rank' ? '按热度' : '按排名变化'}`)
    console.log(`  每页数量: ${pageSize}`)
    console.log(`  城市: ${cityName || cityCode} (${cityCode})`)
    console.log(`  关键词筛选: 无\n`)

    console.log('正在获取同城热点榜...\n')
    const response = await client.getCityHotList({
      page: 1,
      page_size: pageSize,
      order: order,
      city_code: cityCode,
    })

    // 检查响应数据
    if (!response || !response.data) {
      console.error('❌ 响应数据格式错误')
      console.log('响应内容:', JSON.stringify(response, null, 2))
      return false
    }

    const hots = response.data.objs || []
    const pageInfo = response.data.page
    const total = pageInfo?.total || hots.length
    const hasMore = pageInfo ? pageInfo.page * pageInfo.page_size < total : false

    console.log(`✅ 成功获取同城热点榜`)
    console.log(`本页数量: ${hots.length}`)
    console.log(`总数: ${total}`)
    console.log(`有更多数据: ${hasMore ? '是' : '否'}\n`)

    // 显示热点列表
    console.log(`=== ${cityName || cityCode} - 同城热点榜列表 ===\n`)
    if (hots.length === 0) {
      console.log('该城市暂无热点数据\n')
    } else {
      hots.forEach((hot: CityHotInfo, index: number) => {
        const rank = hot.rank || index + 1
        console.log(`${rank}. ${hot.sentence}`)
        console.log(`   热度值: ${formatHotValue(hot.hot_score)}`)
        if (hot.rank_diff !== undefined && hot.rank_diff !== 0) {
          console.log(`   排名变化: ${formatRankDiff(hot.rank_diff)}`)
        }
        if (hot.sentence_tag) {
          console.log(`   分类: ${hot.sentence_tag}`)
        }
        if (hot.video_count) {
          console.log(`   相关视频: ${formatHotValue(hot.video_count)}`)
        }
        console.log()
      })
    }

    // 保存完整数据到文件
    const fs = await import('fs/promises')
    const outputPath = `./city-hot-list-${cityCode}-output.json`
    await fs.writeFile(
      outputPath,
      JSON.stringify(
        {
          queryParams: {
            order,
            pageSize,
            city: cityName || cityCode,
            cityCode: cityCode,
            keyword: '无',
          },
          total: total,
          count: hots.length,
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
 * 测试搜索特定关键词的热点
 */
async function testSearchHots(options: {
  keyword: string
  order?: 'rank' | 'rank_diff'
  pageSize?: number
}) {
  const { keyword, order = 'rank', pageSize = 10 } = options

  console.log(`=== 测试搜索同城热点（关键词: ${keyword}）===\n`)

  try {
    const client = getTikHubClient({
      apiKey: process.env.TIKHUB_API_KEY,
      baseURL: process.env.TIKHUB_API_BASE_URL,
    })

    console.log(`查询参数:`)
    console.log(`  排序方式: ${order === 'rank' ? '按热度' : '按排名变化'}`)
    console.log(`  每页数量: ${pageSize}`)
    console.log(`  搜索关键词: ${keyword}\n`)

    console.log('正在搜索同城热点...\n')
    const response = await client.getCityHotList({
      page: 1,
      page_size: pageSize,
      order: order,
      keyword: keyword,
    })

    // 检查响应数据
    if (!response || !response.data) {
      console.error('❌ 响应数据格式错误')
      console.log('响应内容:', JSON.stringify(response, null, 2))
      return false
    }

    const hots = response.data.objs || []
    const pageInfo = response.data.page
    const total = pageInfo?.total || hots.length
    const hasMore = pageInfo ? pageInfo.page * pageInfo.page_size < total : false

    console.log(`✅ 成功获取同城热点`)
    console.log(`本页数量: ${hots.length}`)
    console.log(`总数: ${total}`)
    console.log(`有更多数据: ${hasMore ? '是' : '否'}\n`)

    // 显示热点列表
    console.log(`=== 包含"${keyword}"的同城热点列表 ===\n`)
    if (hots.length === 0) {
      console.log('未找到匹配的热点\n')
    } else {
      hots.forEach((hot: CityHotInfo, index: number) => {
        const rank = hot.rank || index + 1
        console.log(`${rank}. ${hot.sentence}`)
        console.log(`   热度值: ${formatHotValue(hot.hot_score)}`)
        if (hot.rank_diff !== undefined && hot.rank_diff !== 0) {
          console.log(`   排名变化: ${formatRankDiff(hot.rank_diff)}`)
        }
        if (hot.sentence_tag) {
          console.log(`   分类: ${hot.sentence_tag}`)
        }
        if (hot.city_name) {
          console.log(`   城市: ${hot.city_name}`)
        }
        if (hot.video_count) {
          console.log(`   相关视频: ${formatHotValue(hot.video_count)}`)
        }
        console.log()
      })
    }

    // 保存完整数据到文件
    const fs = await import('fs/promises')
    const outputPath = `./city-hot-list-${keyword}-output.json`
    await fs.writeFile(
      outputPath,
      JSON.stringify(
        {
          queryParams: {
            order,
            pageSize,
            keyword,
          },
          total: total,
          count: hots.length,
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
  console.log('║     TikHub API - 同城热点榜测试工具              ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // 解析命令行参数
  const args = process.argv.slice(2)
  const cityParam = args.find((arg) => arg.startsWith('--city='))?.split('=')[1]
  const keywordParam = args.find((arg) => arg.startsWith('--keyword='))?.split('=')[1]
  const orderParam = args.find((arg) => arg.startsWith('--order='))?.split('=')[1] as
    | 'rank'
    | 'rank_diff'
    | undefined
  const sizeParam = args.find((arg) => arg.startsWith('--size='))?.split('=')[1]

  const order = orderParam || 'rank'
  const pageSize = sizeParam ? parseInt(sizeParam, 10) : 10

  // 城市代码映射
  const cityMap: Record<string, string> = {
    '110000': '北京',
    '310000': '上海',
    '440100': '广州',
    '440300': '深圳',
    '330100': '杭州',
    '320100': '南京',
    '510100': '成都',
    '500000': '重庆',
  }

  const tests: Array<{ name: string; fn: () => Promise<boolean> }> = []

  if (keywordParam) {
    // 搜索特定关键词的热点
    tests.push({
      name: `搜索同城热点（关键词: ${keywordParam}）`,
      fn: () =>
        testSearchHots({
          keyword: keywordParam,
          order,
          pageSize,
        }),
    })
  } else if (cityParam) {
    // 获取特定城市的热点榜
    const cityName = cityMap[cityParam] || ''
    tests.push({
      name: `获取同城热点榜（${cityName || cityParam}）`,
      fn: () =>
        testGetCityHots({
          cityCode: cityParam,
          cityName,
          order,
          pageSize,
        }),
    })
  } else {
    // 获取全部城市的热点榜
    tests.push({
      name: '获取同城热点榜（全部城市）',
      fn: () =>
        testGetAllCityHots({
          order,
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

export { testGetAllCityHots, testGetCityHots, testSearchHots }
