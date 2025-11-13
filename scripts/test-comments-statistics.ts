/**
 * 测试抖音评论统计数据获取
 * 诊断 fetch-statistics 步骤的错误
 */

import { getTikHubClient } from '@/lib/tikhub'

async function testStatistics() {
  console.log('🔍 测试抖音视频统计数据获取...\n')

  // 使用一个常见的抖音视频ID进行测试，支持通过参数或环境变量覆盖
  const testVideoId =
    process.argv[2] ||
    process.env.TEST_VIDEO_ID ||
    '7440876832499690809' // 默认保留稳定视频ID，排查时可自定义

  try {
    const client = getTikHubClient()

    console.log(`📹 测试视频ID: ${testVideoId}`)
    console.log('⏳ 正在获取统计数据...\n')

    const statsResponse = await client.getVideoStatistics({
      aweme_ids: testVideoId
    })

    console.log('✅ 原始响应数据:')
    console.log(JSON.stringify(statsResponse, null, 2))
    console.log('')

    // 检查响应结构
    console.log('🔍 响应结构分析:')
    console.log(`- statistics 字段存在: ${!!statsResponse.statistics}`)
    console.log(`- statistics 类型: ${Array.isArray(statsResponse.statistics) ? 'Array' : typeof statsResponse.statistics}`)

    if (statsResponse.statistics) {
      console.log(`- statistics 长度: ${statsResponse.statistics.length}`)
    }

    // 检查是否有 statistics_list 字段
    const statsAny = statsResponse as any
    console.log(`- statistics_list 字段存在: ${!!statsAny.statistics_list}`)

    if (statsAny.statistics_list) {
      console.log(`- statistics_list 类型: ${Array.isArray(statsAny.statistics_list) ? 'Array' : typeof statsAny.statistics_list}`)
      console.log(`- statistics_list 长度: ${statsAny.statistics_list.length}`)
    }

    // 尝试提取统计数据
    const statisticsList = statsAny.statistics_list ?? statsResponse.statistics

    if (!statisticsList || statisticsList.length === 0) {
      console.error('❌ 错误: 未获取到统计数据')
      console.log('完整响应:', JSON.stringify(statsResponse, null, 2))
      return
    }

    const stats = statisticsList[0]
    console.log('\n📊 统计数据:')
    console.log(`- 播放数: ${stats.play_count?.toLocaleString('zh-CN') || 0}`)
    console.log(`- 点赞数: ${stats.digg_count?.toLocaleString('zh-CN') || 0}`)
    console.log(`- 评论数: ${stats.comment_count?.toLocaleString('zh-CN') || 0}`)
    console.log(`- 分享数: ${stats.share_count?.toLocaleString('zh-CN') || 0}`)
    console.log(`- 收藏数: ${stats.collect_count?.toLocaleString('zh-CN') || 0}`)
    console.log(`- 下载数: ${stats.download_count?.toLocaleString('zh-CN') || 0}`)

    console.log('\n✅ 测试成功!')
  } catch (error) {
    console.error('❌ 测试失败:')
    console.error(error)

    if (error && typeof error === 'object' && 'details' in error) {
      console.log('\n详细错误信息:')
      console.log(JSON.stringify((error as any).details, null, 2))
    }
  }
}

// 运行测试
testStatistics().catch(console.error)
