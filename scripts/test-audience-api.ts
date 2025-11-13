/**
 * 测试API返回的数据格式
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const merchantId = 'cmhx9w1mp0008wtqsfj71nzn1' // 聚力整装官方号

async function main() {
  console.log('🔍 测试API返回的数据...\n')
  console.log(`商家ID: ${merchantId}\n`)

  const response = await fetch(`http://localhost:3007/api/merchants/${merchantId}/analyze-audience`, {
    headers: {
      'Cookie': 'next-auth.session-token=your-token-here' // 需要认证
    }
  })

  console.log(`HTTP状态码: ${response.status}\n`)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('API错误响应:', errorText)
    return
  }

  const data = await response.json()

  console.log('📊 API返回的数据结构:\n')
  console.log('字段检查:')
  console.log(`- id: ${data.id}`)
  console.log(`- merchantId: ${data.merchantId}`)
  console.log(`- videosAnalyzed: ${data.videosAnalyzed} (类型: ${typeof data.videosAnalyzed})`)
  console.log(`- commentsAnalyzed: ${data.commentsAnalyzed} (类型: ${typeof data.commentsAnalyzed})`)
  console.log(`- tokenUsed: ${data.tokenUsed} (类型: ${typeof data.tokenUsed})`)
  console.log(`- modelUsed: ${data.modelUsed} (类型: ${typeof data.modelUsed})`)
  console.log(`- analyzedAt: ${data.analyzedAt} (类型: ${typeof data.analyzedAt})`)
  console.log(`- locationStats存在: ${Boolean(data.locationStats)} (数组长度: ${data.locationStats?.length || 0})`)
  console.log(`- rawMarkdown存在: ${Boolean(data.rawMarkdown)} (长度: ${data.rawMarkdown?.length || 0})`)

  if (data.locationStats && data.locationStats.length > 0) {
    console.log('\n📍 地域分布 TOP3:')
    data.locationStats.slice(0, 3).forEach((stat: any, i: number) => {
      console.log(`  ${i + 1}. ${stat.location}: ${stat.count}条 (${stat.percentage.toFixed(1)}%)`)
    })
  }

  if (data.rawMarkdown) {
    console.log('\n📝 Markdown报告预览（前200字符）:')
    console.log(data.rawMarkdown.substring(0, 200))
    console.log('...\n')
  }

  console.log('\n✅ 完整数据对象:')
  console.log(JSON.stringify(data, null, 2))
}

main()
  .then(() => {
    console.log('\n✅ 测试完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 测试失败:', error)
    process.exit(1)
  })
