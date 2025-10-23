/**
 * 测试获取用户地址信息
 */

import { resolve } from 'path'
import { readFileSync } from 'fs'
import { parse } from 'dotenv'
import { TikHubClient } from '@/lib/tikhub/client'
import { parseDouyinUserShare } from '@/lib/douyin/share-link'

// 加载环境变量
const envPath = resolve(process.cwd(), '.env.local')
const envData = parse(readFileSync(envPath))
for (const [key, value] of Object.entries(envData)) {
  if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
    process.env[key] = value
  }
}

async function testGetUserAddress() {
  console.log('🔍 开始测试获取用户地址信息...\n')

  // 从环境变量获取测试分享链接和 API Key
  const testShareUrl = process.env.TEST_SHARE_URL || 'https://v.douyin.com/Y6p-Hsws68c/'
  const apiKey = process.env.TIKHUB_API_KEY

  if (!apiKey) {
    throw new Error('未找到 TIKHUB_API_KEY 环境变量')
  }

  console.log(`📱 测试分享链接: ${testShareUrl}`)
  console.log(`🔑 API Key: ${apiKey.substring(0, 20)}...`)

  try {
    // 步骤1: 解析分享链接
    console.log('\n📍 步骤1: 解析分享链接...')
    const shareInfo = await parseDouyinUserShare(testShareUrl)

    const secUid = shareInfo.secUserId || shareInfo.userId
    if (!secUid) {
      throw new Error('无法从分享链接提取用户ID')
    }

    console.log(`✅ 成功提取 sec_uid: ${secUid.substring(0, 20)}...`)

    // 步骤2: 获取用户资料（传入 API Key 和 baseURL）
    console.log('\n📍 步骤2: 调用 TikHub API 获取用户资料...')
    const baseURL = process.env.TIKHUB_API_BASE_URL || 'https://api.tikhub.io'
    console.log(`🌐 API Base URL: ${baseURL}`)

    const client = new TikHubClient({ apiKey, baseURL })

    let profile
    try {
      profile = await client.getUserProfile({ sec_uid: secUid })
      console.log('✅ 成功获取用户资料')
    } catch (error: any) {
      if (error?.code === 404) {
        console.log('⚠️  getUserProfile 返回 404，尝试通过视频列表获取...')
        // 回退方案：通过视频列表获取作者信息
        const videos = await client.getUserVideos({ sec_uid: secUid, count: 1 })
        if (!videos.aweme_list[0]?.author) {
          throw new Error('无法获取用户信息')
        }

        const author = videos.aweme_list[0].author
        profile = {
          uid: author.uid,
          sec_uid: author.sec_uid,
          unique_id: author.unique_id,
          nickname: author.nickname,
          signature: (author as any).signature || '',
          avatar_thumb: (author as any).avatar_thumb || { url_list: [] },
          avatar_larger: (author as any).avatar_larger || { url_list: [] },
          follower_count: (author as any).follower_count || 0,
          following_count: (author as any).following_count || 0,
          total_favorited: (author as any).total_favorited || 0,
          aweme_count: (author as any).aweme_count || 0,
          favoriting_count: (author as any).favoriting_count || 0,
          location: (author as any).location || '',
          province: (author as any).province || '',
          city: (author as any).city || '',
          district: (author as any).district || '',
          gender: (author as any).gender || 0,
          birthday: (author as any).birthday || '',
          ip_location: (author as any).ip_location || '',
          custom_verify: (author as any).custom_verify || '',
          enterprise_verify_reason: (author as any).enterprise_verify_reason || '',
          is_enterprise_vip: (author as any).is_enterprise_vip || false,
          verification_type: (author as any).verification_type || 0,
          verification_badge_url: (author as any).verification_badge_url || [],
          school_name: (author as any).school_name || '',
          live_agreement: (author as any).live_agreement || 0,
          live_commerce: (author as any).live_commerce || false,
          forward_count: (author as any).forward_count || 0,
        }
        console.log('✅ 通过视频作者信息获取成功')
      } else {
        throw error
      }
    }

    // 步骤3: 提取地址信息
    console.log('\n📍 步骤3: 提取地址信息...\n')
    console.log('=' .repeat(60))
    console.log('📊 用户基本信息')
    console.log('=' .repeat(60))
    console.log(`用户ID (uid):        ${profile.uid}`)
    console.log(`昵称 (nickname):     ${profile.nickname}`)
    console.log(`抖音号 (unique_id):  ${profile.unique_id || '未设置'}`)
    console.log(`签名 (signature):    ${profile.signature || '无'}`)

    console.log('\n' + '=' .repeat(60))
    console.log('🗺️  地址信息详情')
    console.log('=' .repeat(60))
    console.log(`IP属地 (ip_location): ${profile.ip_location || '未知'}`)
    console.log(`省份 (province):      ${profile.province || '未知'}`)
    console.log(`城市 (city):          ${profile.city || '未知'}`)
    console.log(`区县 (district):      ${profile.district || '未知'}`)
    console.log(`位置 (location):      ${profile.location || '未知'}`)

    // 组合完整地址
    const fullAddress = [profile.province, profile.city, profile.district]
      .filter(Boolean)
      .join(' ')

    console.log(`\n📍 完整地址:          ${fullAddress || '未知'}`)

    console.log('\n' + '=' .repeat(60))
    console.log('📈 其他统计信息')
    console.log('=' .repeat(60))
    console.log(`性别:                ${profile.gender === 1 ? '男' : profile.gender === 2 ? '女' : '未知'}`)
    console.log(`粉丝数:              ${profile.follower_count?.toLocaleString() || 0}`)
    console.log(`关注数:              ${profile.following_count?.toLocaleString() || 0}`)
    console.log(`获赞总数:            ${profile.total_favorited?.toLocaleString() || 0}`)
    console.log(`作品数:              ${profile.aweme_count?.toLocaleString() || 0}`)
    console.log(`认证类型:            ${profile.verification_type > 0 ? '已认证' : '未认证'}`)
    console.log(`企业认证:            ${profile.is_enterprise_vip ? '是' : '否'}`)

    // 步骤4: 测试数据库存储
    console.log('\n' + '=' .repeat(60))
    console.log('💾 数据库存储测试')
    console.log('=' .repeat(60))

    // 模拟映射到商家数据
    const merchantData = {
      uid: profile.uid,
      name: profile.nickname,
      description: profile.signature,
      location: profile.ip_location || profile.city || profile.province,
      address: fullAddress || null,
      contactInfo: {
        sec_uid: profile.sec_uid,
        unique_id: profile.unique_id,
        gender: profile.gender,
        ip_location: profile.ip_location,
        province: profile.province,
        city: profile.city,
        district: profile.district,
        location: profile.location,
      }
    }

    console.log('\n映射后的商家数据:')
    console.log(JSON.stringify(merchantData, null, 2))

    console.log('\n✅ 测试完成！地址信息已成功获取。')

    return {
      success: true,
      profile,
      addressInfo: {
        ip_location: profile.ip_location,
        province: profile.province,
        city: profile.city,
        district: profile.district,
        location: profile.location,
        fullAddress,
      }
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    throw error
  }
}

// 执行测试
testGetUserAddress()
  .then((result) => {
    console.log('\n' + '='.repeat(60))
    console.log('🎉 测试成功完成！')
    console.log('='.repeat(60))
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 测试执行失败:', error.message)
    process.exit(1)
  })
