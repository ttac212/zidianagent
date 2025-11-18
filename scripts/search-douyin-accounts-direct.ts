/**
 * 直接使用 TikHub REST API 搜索抖音账号
 * （绕过 MCP,使用TikHubClient,更可靠）
 *
 * 使用方式:
 * npx tsx scripts/search-douyin-accounts-direct.ts "南宁全屋定制" 5000
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { getTikHubClient } from '../lib/tikhub/client'

interface DouyinUser {
  sec_user_id: string
  sec_uid: string
  nickname: string
  signature: string
  follower_count: number
  total_favorited: number
  aweme_count: number
  avatar_thumb?: {
    url_list?: string[]
  }
}

async function searchDouyinAccountsDirect(keyword: string, minFollowers: number = 0) {
  console.log(`🔍 搜索抖音账号: "${keyword}"`)
  console.log(`📊 最低粉丝数: ${minFollowers.toLocaleString()}\n`)

  const apiKey = process.env.TIKHUB_API_KEY
  const baseURL = process.env.TIKHUB_API_BASE_URL

  if (!apiKey) {
    console.error('❌ 未配置 TIKHUB_API_KEY')
    return
  }

  const client = getTikHubClient({ apiKey, baseURL })

  try {
    // 1. 调用 TikHub API 搜索用户
    console.log('⏳ 正在搜索...')

    const result = await client.searchUser({
      keyword,
      offset: 0,
      count: 20,
    })

    console.log('✅ API 调用成功\n')

    const users: DouyinUser[] = result.user_list || []

    if (users.length === 0) {
      console.log('❌ 未找到符合条件的账号')
      console.log('💡 建议:')
      console.log('   - 尝试更通用的关键词（例如："全屋定制"）')
      console.log('   - 检查关键词拼写')
      return
    }

    console.log(`✅ 找到 ${users.length} 个账号\n`)

    // 2. 按粉丝数筛选
    const filteredUsers = users.filter(user => user.follower_count >= minFollowers)
    console.log(`🎯 符合条件的账号: ${filteredUsers.length} 个\n`)

    if (filteredUsers.length === 0) {
      console.log('💡 提示：')
      console.log(`   - 最高粉丝数: ${Math.max(...users.map(u => u.follower_count)).toLocaleString()}`)
      console.log('   - 建议降低粉丝数要求')
      console.log('   - 或更换关键词')
      return
    }

    // 3. 按粉丝数排序
    filteredUsers.sort((a, b) => b.follower_count - a.follower_count)

    // 4. 展示结果
    console.log('📋 搜索结果:\n')
    console.log('═'.repeat(100))

    filteredUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.nickname}`)
      console.log(`   👥 粉丝数: ${user.follower_count.toLocaleString()}`)
      console.log(`   ❤️  获赞数: ${user.total_favorited.toLocaleString()}`)
      console.log(`   🎬 作品数: ${user.aweme_count}`)
      console.log(`   📝 简介: ${user.signature || '(无简介)'}`)
      console.log(`   🔗 sec_uid: ${user.sec_uid}`)

      if (user.avatar_thumb?.url_list?.[0]) {
        console.log(`   🖼️  头像: ${user.avatar_thumb.url_list[0]}`)
      }
    })

    console.log('\n' + '═'.repeat(100))

    // 5. 生成统计
    const totalFollowers = filteredUsers.reduce((sum, u) => sum + u.follower_count, 0)
    const avgFollowers = Math.round(totalFollowers / filteredUsers.length)
    const maxFollowers = filteredUsers[0].follower_count
    const minFollowersInResults = filteredUsers[filteredUsers.length - 1].follower_count

    console.log('\n📊 统计信息:')
    console.log(`   账号数量: ${filteredUsers.length}`)
    console.log(`   总粉丝数: ${totalFollowers.toLocaleString()}`)
    console.log(`   平均粉丝数: ${avgFollowers.toLocaleString()}`)
    console.log(
      `   粉丝数范围: ${minFollowersInResults.toLocaleString()} - ${maxFollowers.toLocaleString()}`
    )

    // 6. 计算成本
    console.log('\n💰 API 调用成本:')
    console.log(`   本次搜索: $0.001`)
    console.log(`   剩余余额: 见 TikHub 用户中心`)

    // 7. 下一步建议
    console.log('\n💡 下一步操作:')
    console.log('   1. 复制感兴趣的账号 sec_uid')
    console.log('   2. 查看详细信息:')
    console.log(`      npx tsx scripts/get-account-details.ts <sec_uid>`)
    console.log('   3. 批量分析账号:')
    console.log(`      npx tsx scripts/batch-analyze-accounts.ts`)

    // 8. 导出为 JSON（可选）
    const exportData = filteredUsers.map(u => ({
      nickname: u.nickname,
      sec_uid: u.sec_uid,
      followers: u.follower_count,
      likes: u.total_favorited,
      videos: u.aweme_count,
      signature: u.signature,
    }))

    console.log('\n💾 导出数据（JSON）:')
    console.log('```json')
    console.log(JSON.stringify(exportData, null, 2))
    console.log('```')
  } catch (error) {
    console.error('❌ 搜索失败:', error)

    if (String(error).includes('ECONNRESET') || String(error).includes('fetch failed')) {
      console.log('\n💡 网络连接问题解决方案:')
      console.log('   1. 检查网络连接')
      console.log('   2. 尝试更换 TIKHUB_API_BASE_URL:')
      console.log('      - 中国大陆: https://api.tikhub.dev')
      console.log('      - 其他地区: https://api.tikhub.io')
      console.log('   3. 稍后重试')
    }
  }
}

// 主函数
async function main() {
  const keyword = process.argv[2] || '全屋定制'
  const minFollowers = parseInt(process.argv[3] || '5000', 10)

  console.log('🚀 抖音账号搜索工具（直接 API 版本）\n')

  await searchDouyinAccountsDirect(keyword, minFollowers)
}

main()
