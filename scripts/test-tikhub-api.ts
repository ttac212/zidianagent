/**
 * TikHub API 测试脚本
 *
 * 用于验证TikHub API集成是否正常工作
 *
 * 使用方法:
 * npx tsx scripts/test-tikhub-api.ts
 */

import { getTikHubClient, syncMerchantData } from '@/lib/tikhub'
import * as dt from '@/lib/utils/date-toolkit'

async function testTikHubConnection() {
  console.log('=== 测试 TikHub API 连接 ===\n')

  try {
    const client = getTikHubClient()

    // 测试连接
    console.log('1. 测试API连接...')
    const connected = await client.testConnection()

    if (!connected) {
      console.error('❌ TikHub API连接失败')
      console.error('请检查环境变量 TIKHUB_API_KEY 是否正确配置')
      return false
    }

    console.log('✅ TikHub API连接成功\n')

    // 获取用户信息
    console.log('2. 获取用户信息...')
    const userInfo = await client.getUserInfo()
    console.log('用户ID:', userInfo.user_id)
    console.log('用户名:', userInfo.username)
    console.log('邮箱:', userInfo.email)
    console.log('套餐:', userInfo.plan)
    console.log('余额:', `$${userInfo.balance}`)
    console.log('总请求数:', userInfo.total_requests)
    console.log('今日请求数:', userInfo.daily_requests)
    console.log()

    // 获取今日使用情况
    console.log('3. 获取今日使用情况...')
    const dailyUsage = await client.getDailyUsage()
    console.log('日期:', dailyUsage.date)
    console.log('总请求数:', dailyUsage.total_requests)
    console.log('成功请求:', dailyUsage.successful_requests)
    console.log('失败请求:', dailyUsage.failed_requests)
    console.log('总费用:', `$${dailyUsage.total_cost}`)
    console.log()

    // 计算价格
    console.log('4. 计算价格（100次请求）...')
    const pricing = await client.calculatePrice(100)
    console.log('基础价格:', `$${pricing.base_price}`)
    console.log('折扣:', `${pricing.discount * 100}%`)
    console.log('最终价格:', `$${pricing.final_price}`)
    console.log('货币:', pricing.currency)
    console.log()

    return true
  } catch (error: any) {
    console.error('❌ 测试失败:', error.message)
    if (error.code) {
      console.error('错误码:', error.code)
    }
    return false
  }
}

async function testSearchUser() {
  console.log('=== 测试用户搜索功能 ===\n')

  try {
    const client = getTikHubClient()

    // 搜索用户（使用"门窗"作为示例关键词）
    console.log('搜索关键词: "门窗"\n')
    const searchResult = await client.searchUser({
      keyword: '门窗',
      count: 5,
    })

    console.log(`找到 ${searchResult.user_list.length} 个用户:\n`)

    searchResult.user_list.forEach((item, index) => {
      const user = item.user_info
      console.log(`${index + 1}. ${user.nickname}`)
      console.log(`   UID: ${user.uid}`)
      console.log(`   签名: ${user.signature || '无'}`)
      console.log(`   粉丝数: ${user.follower_count}`)
      console.log(`   视频数: ${user.aweme_count}`)
      console.log(`   位置: ${user.ip_location || user.city || '未知'}`)
      console.log()
    })

    return true
  } catch (error: any) {
    console.error('❌ 搜索测试失败:', error.message)
    return false
  }
}

async function testGetUserProfile() {
  console.log('=== 测试获取用户资料 ===\n')

  // 注意: 这里需要一个真实的 sec_uid
  // 您需要先通过搜索获取一个有效的 sec_uid
  const TEST_SEC_UID = process.env.TEST_SEC_UID

  if (!TEST_SEC_UID) {
    console.log('⚠️  跳过用户资料测试')
    console.log('如需测试，请设置环境变量 TEST_SEC_UID')
    console.log()
    return true
  }

  try {
    const client = getTikHubClient()

    console.log(`获取用户资料: ${TEST_SEC_UID}\n`)
    const profile = await client.getUserProfile({ sec_uid: TEST_SEC_UID })

    console.log('昵称:', profile.nickname)
    console.log('UID:', profile.uid)
    console.log('签名:', profile.signature || '无')
    console.log('粉丝数:', profile.follower_count)
    console.log('关注数:', profile.following_count)
    console.log('获赞数:', profile.total_favorited)
    console.log('作品数:', profile.aweme_count)
    console.log('位置:', profile.ip_location || profile.city || '未知')
    console.log('是否认证:', profile.verification_type > 0 ? '是' : '否')
    console.log()

    return true
  } catch (error: any) {
    console.error('❌ 获取用户资料失败:', error.message)
    return false
  }
}

async function testGetUserVideos() {
  console.log('=== 测试获取用户视频 ===\n')

  const TEST_SEC_UID = process.env.TEST_SEC_UID

  if (!TEST_SEC_UID) {
    console.log('⚠️  跳过用户视频测试')
    console.log('如需测试，请设置环境变量 TEST_SEC_UID')
    console.log()
    return true
  }

  try {
    const client = getTikHubClient()

    console.log(`获取用户视频: ${TEST_SEC_UID}\n`)
    const videos = await client.getUserVideos({
      sec_uid: TEST_SEC_UID,
      count: 5,
    })

    console.log(`找到 ${videos.aweme_list.length} 个视频:\n`)

    videos.aweme_list.forEach((video, index) => {
      console.log(`${index + 1}. ${video.desc || '无标题'}`)
      console.log(`   视频ID: ${video.aweme_id}`)
      console.log(`   点赞数: ${video.statistics.digg_count}`)
      console.log(`   评论数: ${video.statistics.comment_count}`)
      console.log(`   分享数: ${video.statistics.share_count}`)
      console.log(`   发布时间: ${dt.safeDate(video.create_time * 1000)?.toLocaleString('zh-CN')}`)
      console.log()
    })

    return true
  } catch (error: any) {
    console.error('❌ 获取用户视频失败:', error.message)
    return false
  }
}

async function testSyncMerchant() {
  console.log('=== 测试商家数据同步 ===\n')

  const TEST_SEC_UID = process.env.TEST_SEC_UID

  if (!TEST_SEC_UID) {
    console.log('⚠️  跳过商家同步测试')
    console.log('如需测试，请设置环境变量 TEST_SEC_UID')
    console.log()
    return true
  }

  try {
    console.log(`同步商家数据: ${TEST_SEC_UID}\n`)

    const result = await syncMerchantData(TEST_SEC_UID, {
      maxVideos: 10, // 仅同步10个视频用于测试
    })

    if (result.success) {
      console.log('✅ 商家数据同步成功')
      console.log('商家ID:', result.merchantId)
      console.log('视频总数:', result.totalVideos)
      console.log('新增视频:', result.newVideos)
      console.log('更新视频:', result.updatedVideos)

      if (result.errors.length > 0) {
        console.log('\n⚠️  警告信息:')
        result.errors.forEach((err) => console.log(`   - ${err}`))
      }
    } else {
      console.error('❌ 商家数据同步失败')
      result.errors.forEach((err) => console.error(`   - ${err}`))
    }

    console.log()
    return result.success
  } catch (error: any) {
    console.error('❌ 商家同步测试失败:', error.message)
    return false
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║        TikHub API 集成测试                       ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  const tests = [
    { name: '连接测试', fn: testTikHubConnection },
    { name: '用户搜索', fn: testSearchUser },
    { name: '用户资料', fn: testGetUserProfile },
    { name: '用户视频', fn: testGetUserVideos },
    { name: '商家同步', fn: testSyncMerchant },
  ]

  const results: Array<{ name: string; passed: boolean }> = []

  for (const test of tests) {
    const passed = await test.fn()
    results.push({ name: test.name, passed })

    // 每个测试之间延迟1秒
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  // 输出测试摘要
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║              测试结果摘要                        ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  results.forEach(({ name, passed }) => {
    const status = passed ? '✅ 通过' : '❌ 失败'
    console.log(`${name.padEnd(20)} ${status}`)
  })

  const totalPassed = results.filter((r) => r.passed).length
  const totalTests = results.length

  console.log(`\n总计: ${totalPassed}/${totalTests} 测试通过`)

  if (totalPassed === totalTests) {
    console.log('\n🎉 所有测试通过！TikHub API集成工作正常。\n')
  } else {
    console.log('\n⚠️  部分测试失败，请检查配置和错误信息。\n')
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

export { main as testTikHubApi }
