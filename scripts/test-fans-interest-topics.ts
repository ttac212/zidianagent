/**
 * TikHub API 粉丝感兴趣话题测试脚本
 *
 * 测试 TikHub API 的粉丝感兴趣话题接口
 * 端点: /api/v1/douyin/billboard/fetch_hot_account_fans_interest_topic_list (GET)
 *
 * 使用方法:
 * npx tsx scripts/test-fans-interest-topics.ts
 * npx tsx scripts/test-fans-interest-topics.ts --sec-uid=MS4wLjABAAAA8U_l6rBzmy7bcy6xOJel4v0RzoR_wfAubGPeJimN__4
 */

// 必须在最顶部加载环境变量，在任何其他 import 之前
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { getTikHubClient } from '@/lib/tikhub'
import type { FansInterestTopic } from '@/lib/tikhub/types'

/**
 * 测试获取粉丝感兴趣的话题
 */
async function testGetFansInterestTopics(secUid: string, accountName?: string) {
  console.log('=== 测试获取粉丝感兴趣的话题 ===\n')

  try {
    const client = getTikHubClient({
      apiKey: process.env.TIKHUB_API_KEY,
      baseURL: process.env.TIKHUB_API_BASE_URL,
    })

    console.log(`查询参数:`)
    console.log(`  用户sec_uid: ${secUid}`)
    if (accountName) {
      console.log(`  账号名称: ${accountName}`)
    }
    console.log()

    console.log('正在获取粉丝感兴趣的话题...\n')
    const response = await client.getFansInterestTopicList({
      sec_uid: secUid,
    })

    // 检查响应数据
    if (!response || !response.data) {
      console.error('❌ 响应数据格式错误')
      console.log('响应内容:', JSON.stringify(response, null, 2))
      return false
    }

    const topics = Array.isArray(response.data) ? response.data : []

    console.log(`✅ 成功获取粉丝感兴趣的话题`)
    console.log(`话题数量: ${topics.length}\n`)

    // 显示话题列表
    if (topics.length > 0) {
      console.log('=== 粉丝感兴趣的话题列表 ===\n')
      topics.forEach((topic, index) => {
        console.log(`${index + 1}. ${topic.topic_name || JSON.stringify(topic)}`)
        if (topic.topic_id) {
          console.log(`   话题ID: ${topic.topic_id}`)
        }
        if (topic.interest_score !== undefined) {
          console.log(`   兴趣度分数: ${topic.interest_score}`)
        }
        if (topic.rank !== undefined) {
          console.log(`   排名: ${topic.rank}`)
        }
        console.log()
      })
    } else {
      console.log('未获取到话题数据\n')
      console.log('原始响应:', JSON.stringify(response, null, 2))
    }

    // 保存完整数据到文件
    const fs = await import('fs/promises')
    const outputPath = './fans-interest-topics-output.json'
    await fs.writeFile(
      outputPath,
      JSON.stringify(
        {
          secUid,
          accountName: accountName || '未知',
          count: topics.length,
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
 * 预设的测试账号
 */
const TEST_ACCOUNTS = [
  {
    name: '人民日报',
    sec_uid: 'MS4wLjABAAAA8U_l6rBzmy7bcy6xOJel4v0RzoR_wfAubGPeJimN__4',
  },
  {
    name: '央视新闻',
    sec_uid: 'MS4wLjABAAAAgq8cb7cn9ByhZbmx-XQDdRTvFzmJeBBXOUO4QflP96M',
  },
  {
    name: '新华社',
    sec_uid: 'MS4wLjABAAAAxA44mxJVod_Aq5wc0cZrbZHJ2S_DnoJctGpb_mOvsxs',
  },
]

/**
 * 主函数
 */
async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║     TikHub API - 粉丝感兴趣话题测试工具          ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // 解析命令行参数
  const args = process.argv.slice(2)
  const secUidParam = args.find((arg) => arg.startsWith('--sec-uid='))?.split('=')[1]

  if (secUidParam) {
    // 使用命令行指定的 sec_uid
    await testGetFansInterestTopics(secUidParam)
  } else {
    // 使用默认测试账号（人民日报）
    const defaultAccount = TEST_ACCOUNTS[0]
    console.log(`使用默认测试账号: ${defaultAccount.name}`)
    console.log(`提示: 可使用 --sec-uid=<sec_uid> 参数指定其他账号\n`)

    await testGetFansInterestTopics(defaultAccount.sec_uid, defaultAccount.name)
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

export { testGetFansInterestTopics, TEST_ACCOUNTS }
