/**
 * 完整参数测试TikHub搜索API
 * 根据官方文档补全所有可能的参数
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function testSearchWithAllParams() {
  const apiKey = process.env.TIKHUB_API_KEY
  const baseURL = process.env.TIKHUB_API_BASE_URL || 'https://api.tikhub.io'

  console.log('🔍 完整参数测试TikHub搜索API\n')
  console.log(`API Key存在: ${!!apiKey}`)
  console.log(`API Key长度: ${apiKey?.length}\n`)

  // 测试不同的参数组合
  const testCases = [
    {
      name: '基础参数',
      params: {
        keyword: '全屋定制',
        offset: 0,
        count: 10,
      }
    },
    {
      name: '添加排序参数',
      params: {
        keyword: '全屋定制',
        offset: 0,
        count: 10,
        sort_type: 0, // 可能的排序参数
      }
    },
    {
      name: '添加搜索ID',
      params: {
        keyword: '全屋定制',
        offset: 0,
        count: 10,
        search_id: '',
      }
    },
    {
      name: '使用cursor分页',
      params: {
        keyword: '全屋定制',
        cursor: 0,
        count: 10,
      }
    },
    {
      name: '英文关键词测试',
      params: {
        keyword: 'decoration',
        offset: 0,
        count: 10,
      }
    },
  ]

  for (const testCase of testCases) {
    console.log(`\n${'═'.repeat(70)}`)
    console.log(`📋 测试: ${testCase.name}`)
    console.log(`参数: ${JSON.stringify(testCase.params, null, 2)}`)

    try {
      const url = new URL('/api/v1/douyin/web/fetch_user_search_result', baseURL)

      // 添加所有参数
      Object.entries(testCase.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, String(value))
        }
      })

      console.log(`\n请求URL: ${url.toString()}`)

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      })

      console.log(`\nHTTP状态: ${response.status} ${response.statusText}`)

      const contentType = response.headers.get('content-type')
      console.log(`Content-Type: ${contentType}`)

      const data = await response.json()

      if (response.ok && data.code === 200) {
        console.log('✅ 成功!')

        const users = data.data?.user_list || []
        console.log(`找到 ${users.length} 个用户\n`)

        users.slice(0, 3).forEach((item: any, index: number) => {
          const user = item.user_info || item
          console.log(`${index + 1}. ${user.nickname || user.nick_name}`)
          console.log(`   粉丝: ${(user.follower_count || 0).toLocaleString()}`)
          console.log(`   sec_uid: ${user.sec_uid?.substring(0, 30)}...`)
        })

        // 如果成功了，就不需要继续测试其他参数组合
        console.log('\n✅ 找到可用的参数组合!')
        break
      } else {
        console.log('❌ 失败')
        console.log(`响应码: ${data.code || response.status}`)
        console.log(`错误: ${data.message || data.message_zh || data.detail?.message_zh}`)

        // 打印详细错误信息
        if (data.detail) {
          console.log(`\n详细信息:`)
          console.log(`  request_id: ${data.detail.request_id}`)
          console.log(`  文档: ${data.detail.docs}`)
        }
      }
    } catch (error: any) {
      console.log(`❌ 请求异常: ${error.message}`)
    }

    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  console.log('\n\n' + '═'.repeat(70))
  console.log('💡 建议:')
  console.log('1. 检查TikHub官方文档了解最新的参数要求')
  console.log('2. 联系TikHub支持获取正确的参数格式')
  console.log('3. 检查API Key是否有搜索权限')
  console.log('\n文档地址: https://docs.tikhub.io/')
  console.log('支持Discord: https://discord.gg/aMEAS8Xsvz')
}

testSearchWithAllParams().catch(console.error)
