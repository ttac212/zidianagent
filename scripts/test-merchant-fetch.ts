/**
 * 测试获取指定商家数据
 *
 * 从抖音分享链接获取商家信息和视频数据
 */

import { getTikHubClient } from '@/lib/tikhub'
import * as dt from '@/lib/utils/date-toolkit'

async function main() {
  console.log('=== 测试获取商家数据 ===\n')

  const TIKHUB_API_KEY = process.env.TIKHUB_API_KEY
  const TEST_SHARE_URL = process.env.TEST_SHARE_URL || 'https://v.douyin.com/Y6p-Hsws68c/'

  if (!TIKHUB_API_KEY) {
    console.error('❌ 请配置 TIKHUB_API_KEY 环境变量')
    process.exit(1)
  }

  console.log('API Key:', TIKHUB_API_KEY.substring(0, 20) + '...')
  console.log('分享链接:', TEST_SHARE_URL)
  console.log()

  const client = getTikHubClient({
    apiKey: TIKHUB_API_KEY
  })

  try {
    // 步骤1: 测试API连接
    console.log('步骤1: 测试API连接...')
    const connected = await client.testConnection()

    if (!connected) {
      console.error('❌ API连接失败，请检查API密钥是否正确')
      process.exit(1)
    }

    console.log('✅ API连接成功\n')

    // 步骤2: 获取用户信息
    console.log('步骤2: 获取TikHub账户信息...')
    const userInfo = await client.getUserInfo()
    console.log('用户名:', userInfo.username)
    console.log('套餐:', userInfo.plan)
    console.log('余额:', `$${userInfo.balance}`)
    console.log('今日已用请求:', userInfo.daily_requests)
    console.log()

    // 步骤3: 由于是分享链接，我们需要先尝试通过Web接口解析
    // 抖音分享链接通常格式为 https://v.douyin.com/{short_code}/
    // 但TikHub需要sec_uid，所以我们先尝试搜索关键词

    console.log('步骤3: 搜索测试（使用"门窗"关键词）...')
    const searchResult = await client.searchUser({
      keyword: '门窗',
      count: 10
    })

    if (searchResult.user_list.length === 0) {
      console.log('⚠️  未找到相关用户')
    } else {
      console.log(`找到 ${searchResult.user_list.length} 个用户:\n`)

      // 显示前5个用户
      searchResult.user_list.slice(0, 5).forEach((item, index) => {
        const user = item.user_info
        console.log(`${index + 1}. ${user.nickname}`)
        console.log(`   UID: ${user.uid}`)
        console.log(`   SecUID: ${user.sec_uid.substring(0, 30)}...`)
        console.log(`   签名: ${user.signature || '无'}`)
        console.log(`   粉丝: ${user.follower_count} | 作品: ${user.aweme_count}`)
        console.log(`   位置: ${user.ip_location || user.city || '未知'}`)
        console.log()
      })

      // 步骤4: 获取第一个用户的详细资料
      const firstUser = searchResult.user_list[0].user_info
      console.log(`\n步骤4: 获取用户详细资料 (${firstUser.nickname})...\n`)

      const profile = await client.getUserProfile({
        sec_uid: firstUser.sec_uid
      })

      console.log('=== 用户资料详情 ===')
      console.log('昵称:', profile.nickname)
      console.log('UID:', profile.uid)
      console.log('SecUID:', profile.sec_uid.substring(0, 40) + '...')
      console.log('签名:', profile.signature || '无')
      console.log('粉丝数:', profile.follower_count.toLocaleString())
      console.log('关注数:', profile.following_count.toLocaleString())
      console.log('获赞数:', profile.total_favorited.toLocaleString())
      console.log('作品数:', profile.aweme_count.toLocaleString())
      console.log('位置:', profile.ip_location || profile.city || '未知')
      console.log('是否认证:', profile.verification_type > 0 ? '是' : '否')
      if (profile.enterprise_verify_reason) {
        console.log('企业认证:', profile.enterprise_verify_reason)
      }
      console.log()

      // 步骤5: 获取用户视频列表
      console.log(`步骤5: 获取用户视频列表 (前20个)...\n`)

      const videos = await client.getUserVideos({
        sec_uid: firstUser.sec_uid,
        count: 20
      })

      console.log(`=== 视频列表 (共 ${videos.aweme_list.length} 个) ===\n`)

      videos.aweme_list.forEach((video, index) => {
        console.log(`${index + 1}. ${video.desc || '无标题'}`)
        console.log(`   视频ID: ${video.aweme_id}`)
        console.log(`   发布时间: ${dt.safeDate(video.create_time * 1000)?.toLocaleString('zh-CN')}`)
        console.log(`   👍 点赞: ${video.statistics.digg_count.toLocaleString()}`)
        console.log(`   💬 评论: ${video.statistics.comment_count.toLocaleString()}`)
        console.log(`   ⭐ 收藏: ${video.statistics.collect_count.toLocaleString()}`)
        console.log(`   📤 分享: ${video.statistics.share_count.toLocaleString()}`)
        console.log(`   🎬 播放: ${video.statistics.play_count?.toLocaleString() || '未知'}`)

        if (video.video?.duration) {
          const minutes = Math.floor(video.video.duration / 60)
          const seconds = video.video.duration % 60
          console.log(`   ⏱️  时长: ${minutes}:${seconds.toString().padStart(2, '0')}`)
        }

        // 显示标签
        if (video.text_extra && video.text_extra.length > 0) {
          const tags = video.text_extra.map(t => `#${t.hashtag_name}`).join(' ')
          console.log(`   🏷️  标签: ${tags}`)
        }

        console.log(`   🔗 链接: ${video.share_url}`)
        console.log()
      })

      // 统计信息
      const totalDigg = videos.aweme_list.reduce((sum, v) => sum + v.statistics.digg_count, 0)
      const totalComment = videos.aweme_list.reduce((sum, v) => sum + v.statistics.comment_count, 0)
      const totalCollect = videos.aweme_list.reduce((sum, v) => sum + v.statistics.collect_count, 0)
      const totalShare = videos.aweme_list.reduce((sum, v) => sum + v.statistics.share_count, 0)

      console.log('=== 统计摘要 ===')
      console.log(`视频数量: ${videos.aweme_list.length}`)
      console.log(`总点赞数: ${totalDigg.toLocaleString()}`)
      console.log(`总评论数: ${totalComment.toLocaleString()}`)
      console.log(`总收藏数: ${totalCollect.toLocaleString()}`)
      console.log(`总分享数: ${totalShare.toLocaleString()}`)
      console.log(`平均点赞: ${Math.round(totalDigg / videos.aweme_list.length).toLocaleString()}`)
      console.log()

      // 步骤6: 获取单个视频的详细信息
      if (videos.aweme_list.length > 0) {
        const firstVideo = videos.aweme_list[0]
        console.log(`步骤6: 获取单个视频详情 (${firstVideo.aweme_id})...\n`)

        const videoDetail = await client.getVideoDetail({
          aweme_id: firstVideo.aweme_id
        })

        console.log('=== 视频详情 ===')
        console.log('标题:', videoDetail.aweme_detail.desc || '无')
        console.log('作者:', videoDetail.aweme_detail.author.nickname)
        console.log('创建时间:', dt.safeDate(videoDetail.aweme_detail.create_time * 1000)?.toLocaleString('zh-CN'))

        if (videoDetail.aweme_detail.music) {
          console.log('音乐:', videoDetail.aweme_detail.music.title)
          console.log('音乐作者:', videoDetail.aweme_detail.music.author)
        }

        if (videoDetail.aweme_detail.video) {
          const v = videoDetail.aweme_detail.video
          console.log('分辨率:', `${v.width}x${v.height}`)
          console.log('封面:', v.cover?.url_list?.[0]?.substring(0, 80) + '...')
          console.log('播放地址:', v.play_addr?.url_list?.[0]?.substring(0, 80) + '...')
        }

        console.log()
      }

      // 显示完整的JSON数据（前3个视频）
      console.log('=== 原始API响应数据示例（前3个视频）===\n')
      console.log(JSON.stringify({
        profile: {
          uid: profile.uid,
          sec_uid: profile.sec_uid.substring(0, 30) + '...',
          nickname: profile.nickname,
          signature: profile.signature,
          follower_count: profile.follower_count,
          aweme_count: profile.aweme_count,
          location: profile.ip_location || profile.city
        },
        videos: videos.aweme_list.slice(0, 3).map(v => ({
          aweme_id: v.aweme_id,
          desc: v.desc,
          create_time: v.create_time,
          statistics: v.statistics,
          share_url: v.share_url,
          text_extra: v.text_extra,
          video: {
            duration: v.video?.duration,
            width: v.video?.width,
            height: v.video?.height
          }
        }))
      }, null, 2))

      console.log('\n✅ 测试完成！')
    }

  } catch (error: any) {
    console.error('\n❌ 错误:', error.message)
    if (error.code) {
      console.error('错误码:', error.code)
    }
    if (error.endpoint) {
      console.error('请求端点:', error.endpoint)
    }
    if (error.details) {
      console.error('详细信息:', JSON.stringify(error.details, null, 2))
    }
    process.exit(1)
  }
}

// 运行测试
main()
