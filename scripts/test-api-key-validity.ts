/**
 * 测试API KEY是否有效
 * 通过调用已知可用的端点来验证
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function testApiKeyValidity() {
  const apiKey = process.env.TIKHUB_API_KEY
  const baseURL = process.env.TIKHUB_API_BASE_URL || 'https://api.tikhub.io'

  console.log('🔐 测试API KEY有效性\n')
  console.log(`API Key: ${apiKey?.substring(0, 20)}...${apiKey?.substring(apiKey.length - 10)}`)
  console.log(`API Base: ${baseURL}\n`)

  // 测试已知可用的端点
  const endpoints = [
    {
      name: '获取用户信息',
      url: '/api/v1/tikhub/user/get_user_info',
      params: {}
    },
    {
      name: '获取每日使用情况',
      url: '/api/v1/tikhub/user/get_user_daily_usage',
      params: {}
    },
    {
      name: '计算价格',
      url: '/api/v1/tikhub/user/calculate_price',
      params: { request_count: 1 }
    },
  ]

  for (const endpoint of endpoints) {
    console.log(`\n${'═'.repeat(70)}`)
    console.log(`📋 测试: ${endpoint.name}`)
    console.log(`端点: ${endpoint.url}`)

    try {
      const url = new URL(endpoint.url, baseURL)
      Object.entries(endpoint.params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value))
      })

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      })

      console.log(`HTTP状态: ${response.status} ${response.statusText}`)

      const data = await response.json()

      if (response.ok && data.code === 200) {
        console.log('✅ 成功!')

        if (data.data) {
          if (data.data.user_email) {
            console.log(`  邮箱: ${data.data.user_email}`)
            console.log(`  余额: $${data.data.balance}`)
          }
          if (data.data.date) {
            console.log(`  日期: ${data.data.date}`)
            console.log(`  今日请求: ${data.data.total_request_per_day}`)
          }
        }
      } else {
        console.log('❌ 失败')
        console.log(`错误: ${data.message_zh || data.message}`)
      }
    } catch (error: any) {
      console.log(`❌ 异常: ${error.message}`)
    }

    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log('\n\n' + '═'.repeat(70))
  console.log('📊 结论:\n')
  console.log('如果以上端点都成功:')
  console.log('  → API KEY有效，但搜索端点可能需要额外权限或参数')
  console.log('  → 建议查看官方文档或联系TikHub支持')
  console.log('\n如果以上端点也失败:')
  console.log('  → API KEY可能无效或过期')
  console.log('  → 请在 https://user.tikhub.io 检查API KEY状态')
}

testApiKeyValidity().catch(console.error)
