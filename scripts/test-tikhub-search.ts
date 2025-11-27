/**
 * 测试 TikHub 搜索 API
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// 加载 .env.local 文件
config({ path: resolve(__dirname, '../.env.local') })
config({ path: resolve(__dirname, '../.env') })

import { getTikHubClient } from '../lib/tikhub/client'

async function testSearch() {
  const client = getTikHubClient()

  console.log('测试 TikHub 搜索 API...\n')

  // 测试1: 用户搜索 (已知可用)
  console.log('1. 测试用户搜索 API...')
  try {
    const userResult = await client.searchUser({ keyword: '全屋定制', count: 5 })
    console.log('✅ 用户搜索成功，找到', userResult.user_list?.length || 0, '个用户')
  } catch (err: any) {
    console.log('❌ 用户搜索失败:', err.message)
  }

  // 测试2: 综合搜索 V4
  console.log('\n2. 测试综合搜索 V4 API...')
  try {
    const searchResult = await client.generalSearchV4({
      keyword: '全屋定制',
      sort_type: '0',
      publish_time: '0',
      content_type: '0',
    })
    console.log('✅ 综合搜索 V4 成功，找到', searchResult.data?.length || 0, '条结果')
  } catch (err: any) {
    console.log('❌ 综合搜索 V4 失败:', err.message)
    console.log('   详情:', JSON.stringify(err.details || {}, null, 2))
  }

  // 测试3: 综合搜索 V5
  console.log('\n3. 测试综合搜索 V5 API...')
  try {
    const searchResult = await client.generalSearchV5({
      keyword: '全屋定制',
      offset: 0,
      page: 0,
    })
    console.log('✅ 综合搜索 V5 成功，找到', searchResult.data?.length || 0, '条结果')
  } catch (err: any) {
    console.log('❌ 综合搜索 V5 失败:', err.message)
    console.log('   详情:', JSON.stringify(err.details || {}, null, 2))
  }

  // 测试4: 热门视频列表
  console.log('\n4. 测试热门视频列表 API...')
  try {
    const hotVideos = await client.getHotVideoList({ page: 1, page_size: 5 })
    console.log('✅ 热门视频列表成功，找到', hotVideos.data?.objs?.length || 0, '条结果')
  } catch (err: any) {
    console.log('❌ 热门视频列表失败:', err.message)
  }

  // 测试5: 低粉爆款榜
  console.log('\n5. 测试低粉爆款榜 API...')
  try {
    const lowFanVideos = await client.getLowFanList({ page: 1, page_size: 5 })
    console.log('✅ 低粉爆款榜成功，找到', lowFanVideos.data?.objs?.length || 0, '条结果')
  } catch (err: any) {
    console.log('❌ 低粉爆款榜失败:', err.message)
  }

  console.log('\n测试完成!')
}

testSearch().catch(console.error)
