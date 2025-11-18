/**
 * TikHub API 热门账号测试脚本
 *
 * 测试 TikHub API 的热门账号接口
 * 端点: /api/v1/douyin/billboard/fetch_hot_account_list (POST)
 *
 * 使用方法:
 * npx tsx scripts/test-hot-accounts.ts
 * npx tsx scripts/test-hot-accounts.ts --tag=628  # 美食垂类
 * npx tsx scripts/test-hot-accounts.ts --hours=48 --size=20  # 48小时窗口，每页20条
 */

// 必须在最顶部加载环境变量，在任何其他 import 之前
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { getTikHubClient } from '@/lib/tikhub'
import type { HotAccountInfo, HotAccountQueryTag } from '@/lib/tikhub/types'

/**
 * 格式化粉丝数（缩写形式）
 */
function formatFollowerCount(count: number): string {
  if (count >= 10000000) {
    return `${(count / 10000000).toFixed(1)}千万`
  } else if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万`
  }
  return count.toString()
}

/**
 * 格式化获赞数（缩写形式）
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
 * 测试获取热门账号列表（全部垂类）
 */
async function testGetAllHotAccounts(options: {
  dateWindow?: number
  pageSize?: number
}) {
  console.log('=== 测试获取热门账号列表（全部垂类）===\n')

  try {
    const client = getTikHubClient({
      apiKey: process.env.TIKHUB_API_KEY,
      baseURL: process.env.TIKHUB_API_BASE_URL,
    })

    const { dateWindow = 24, pageSize = 10 } = options

    console.log(`查询参数:`)
    console.log(`  时间窗口: ${dateWindow} 小时`)
    console.log(`  每页数量: ${pageSize}`)
    console.log(`  垂类筛选: 全部\n`)

    console.log('正在获取热门账号...\n')
    const response = await client.getHotAccountList({
      date_window: dateWindow,
      page_num: 1,
      page_size: pageSize,
    })

    // 检查响应数据
    if (!response || !response.data || !response.data.user_list) {
      console.error('❌ 响应数据格式错误')
      console.log('响应内容:', JSON.stringify(response, null, 2))
      return false
    }

    const accounts = response.data.user_list
    const total = response.data.total
    const hasMore = response.data.has_more

    console.log(`✅ 成功获取热门账号`)
    console.log(`本页数量: ${accounts.length}`)
    if (total !== undefined) console.log(`总数: ${total}`)
    if (hasMore !== undefined) console.log(`有更多数据: ${hasMore ? '是' : '否'}\n`)

    // 显示账号列表
    console.log('=== 热门账号列表 ===\n')
    accounts.forEach((account, index) => {
      const rank = account.rank || index + 1
      console.log(`${rank}. ${account.nick_name}`)
      console.log(`   粉丝数: ${formatFollowerCount(account.fans_cnt)}`)
      console.log(`   获赞数: ${formatLikeCount(account.like_cnt)}`)
      console.log(`   作品数: ${account.publish_cnt}`)
      if (account.signature) {
        const signature = account.signature.slice(0, 50)
        console.log(`   简介: ${signature}${account.signature.length > 50 ? '...' : ''}`)
      }
      if (account.hot_value) {
        console.log(`   热度值: ${account.hot_value}`)
      }
      console.log(`   UID: ${account.user_id}`)
      console.log()
    })

    // 保存完整数据到文件
    const fs = await import('fs/promises')
    const outputPath = './hot-accounts-output.json'
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
          count: accounts.length,
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
 * 测试获取特定垂类的热门账号
 */
async function testGetCategoryHotAccounts(options: {
  tagId: number
  tagName?: string
  dateWindow?: number
  pageSize?: number
}) {
  const { tagId, tagName = '未知', dateWindow = 24, pageSize = 10 } = options

  console.log(`=== 测试获取热门账号列表（${tagName}垂类）===\n`)

  try {
    const client = getTikHubClient({
      apiKey: process.env.TIKHUB_API_KEY,
      baseURL: process.env.TIKHUB_API_BASE_URL,
    })

    const queryTag: HotAccountQueryTag = { value: tagId }

    console.log(`查询参数:`)
    console.log(`  时间窗口: ${dateWindow} 小时`)
    console.log(`  每页数量: ${pageSize}`)
    console.log(`  垂类筛选: ${tagName} (ID: ${tagId})\n`)

    console.log('正在获取热门账号...\n')
    const response = await client.getHotAccountList({
      date_window: dateWindow,
      page_num: 1,
      page_size: pageSize,
      query_tag: queryTag,
    })

    // 检查响应数据
    if (!response || !response.data || !response.data.user_list) {
      console.error('❌ 响应数据格式错误')
      console.log('响应内容:', JSON.stringify(response, null, 2))
      return false
    }

    const accounts = response.data.user_list
    const total = response.data.total
    const hasMore = response.data.has_more

    console.log(`✅ 成功获取热门账号`)
    console.log(`本页数量: ${accounts.length}`)
    if (total !== undefined) console.log(`总数: ${total}`)
    if (hasMore !== undefined) console.log(`有更多数据: ${hasMore ? '是' : '否'}\n`)

    // 显示账号列表
    console.log(`=== ${tagName}垂类 - 热门账号列表 ===\n`)
    accounts.forEach((account, index) => {
      const rank = account.rank || index + 1
      console.log(`${rank}. ${account.nick_name}`)
      console.log(`   粉丝数: ${formatFollowerCount(account.fans_cnt)}`)
      console.log(`   获赞数: ${formatLikeCount(account.like_cnt)}`)
      console.log(`   作品数: ${account.publish_cnt}`)
      if (account.signature) {
        const signature = account.signature.slice(0, 50)
        console.log(`   简介: ${signature}${account.signature.length > 50 ? '...' : ''}`)
      }
      if (account.hot_value) {
        console.log(`   热度值: ${account.hot_value}`)
      }
      console.log()
    })

    // 保存完整数据到文件
    const fs = await import('fs/promises')
    const outputPath = `./hot-accounts-${tagId}-output.json`
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
          count: accounts.length,
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
  console.log('║     TikHub API - 热门账号测试工具                ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // 解析命令行参数
  const args = process.argv.slice(2)
  const tagParam = args.find((arg) => arg.startsWith('--tag='))?.split('=')[1]
  const hoursParam = args.find((arg) => arg.startsWith('--hours='))?.split('=')[1]
  const sizeParam = args.find((arg) => arg.startsWith('--size='))?.split('=')[1]

  const dateWindow = hoursParam ? parseInt(hoursParam, 10) : 24
  const pageSize = sizeParam ? parseInt(sizeParam, 10) : 10

  const tests: Array<{ name: string; fn: () => Promise<boolean> }> = []

  if (tagParam) {
    // 获取特定垂类的热门账号
    const tagId = parseInt(tagParam, 10)
    const tagName = await getTagName(tagId)

    tests.push({
      name: `获取${tagName}垂类热门账号`,
      fn: () =>
        testGetCategoryHotAccounts({
          tagId,
          tagName,
          dateWindow,
          pageSize,
        }),
    })
  } else {
    // 获取全部垂类的热门账号
    tests.push({
      name: '获取全部垂类热门账号',
      fn: () =>
        testGetAllHotAccounts({
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

export { testGetAllHotAccounts, testGetCategoryHotAccounts }
