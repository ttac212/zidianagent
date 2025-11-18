/**
 * 测试Web版本的搜索API
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function testWebSearch() {
  const apiKey = process.env.TIKHUB_API_KEY
  const baseURL = process.env.TIKHUB_API_BASE_URL || 'https://api.tikhub.io'

  console.log('🔍 测试Web版本搜索API\n')
  console.log(`API Base: ${baseURL}`)
  console.log(`API Key: ${apiKey?.substring(0, 20)}...\n`)

  const testCases = [
    { keyword: '全屋定制', count: 5 },
    { keyword: '装修', count: 5 },
    { keyword: '门窗', count: 5 },
  ]

  for (const testCase of testCases) {
    console.log(`\n📋 测试关键词: "${testCase.keyword}"`)
    console.log('═'.repeat(60))

    try {
      // 构建URL
      const url = new URL('/api/v1/douyin/web/fetch_user_search_result', baseURL)
      url.searchParams.append('keyword', testCase.keyword)
      url.searchParams.append('offset', '0')
      url.searchParams.append('count', testCase.count.toString())

      console.log(`请求URL: ${url.toString()}\n`)

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      console.log(`HTTP状态: ${response.status} ${response.statusText}`)

      const data = await response.json()

      console.log(`响应code: ${data.code}`)

      if (data.code === 200 && data.data) {
        const users = data.data.user_list || []
        console.log(`✅ 成功! 找到 ${users.length} 个用户\n`)

        users.slice(0, 3).forEach((item: any, index: number) => {
          const user = item.user_info || item
          console.log(`${index + 1}. ${user.nickname || user.nick_name}`)
          console.log(`   粉丝: ${(user.follower_count || 0).toLocaleString()}`)
          console.log(`   sec_uid: ${user.sec_uid}`)
        })
      } else {
        console.log(`❌ 失败`)
        console.log(`错误信息: ${data.message || data.message_zh}`)
        console.log(`完整响应:`)
        console.log(JSON.stringify(data, null, 2))
      }
    } catch (error: any) {
      console.log(`❌ 请求失败: ${error.message}`)
      if (error.cause) {
        console.log(`原因: ${error.cause}`)
      }
    }

    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log('\n\n' + '═'.repeat(60))
  console.log('测试完成')
}

testWebSearch().catch(console.error)
