/**
 * 纯API测试 - 不依赖Prisma
 * 直接调用TikHub API获取商家数据
 */

const TIKHUB_API_KEY = process.env.TIKHUB_API_KEY
if (!TIKHUB_API_KEY) {
  console.error('❌ TIKHUB_API_KEY 环境变量未配置')
  console.error('   请运行: TIKHUB_API_KEY="your_key" npx tsx scripts/test-api-direct.ts')
  process.exit(1)
}
const TIKHUB_API_BASE = 'https://api.tikhub.io'

/**
 * 发送API请求
 */
async function apiRequest(endpoint: string, params: Record<string, any> = {}) {
  const url = new URL(endpoint, TIKHUB_API_BASE)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value))
    }
  })

  console.log(`🔗 请求: ${endpoint}`)
  console.log(`📍 URL: ${url.toString()}`)

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${TIKHUB_API_KEY}`,
      'Content-Type': 'application/json',
    },
  })

  const data = await response.json()

  console.log(`📊 状态码: ${response.status}`)
  console.log(`✅ 响应:`, JSON.stringify(data, null, 2).substring(0, 500) + '...\n')

  if (response.status !== 200) {
    throw new Error(`API错误: ${response.status} - ${data.message || '未知错误'}`)
  }

  // TikHub API返回格式: { code, router, data, ... }
  // 但有些接口直接返回api_key_data等
  return data
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║     TikHub API 商家数据获取测试               ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  console.log('API密钥:', TIKHUB_API_KEY.substring(0, 30) + '...')
  console.log()

  try {
    // 1. 测试连接 - 获取账户信息
    console.log('═══ 步骤1: 测试API连接 ═══\n')
    const userInfo = await apiRequest('/api/v1/tikhub/user/get_user_info')
    console.log('✅ 连接成功！')

    // TikHub返回的数据结构
    const apiKeyData = userInfo.api_key_data || {}
    console.log('API Key名称:', apiKeyData.api_key_name || '未知')
    console.log('权限范围:', apiKeyData.api_key_scopes?.length || 0, '个接口')
    console.log('过期时间:', apiKeyData.api_key_expired_at || '未知')
    console.log()

    // 2. 获取今日使用情况 (先跳过，直接搜索用户)
    console.log('═══ 步骤2: 跳过使用情况查询 ═══\n')
    console.log('直接进入用户搜索...\n')

    // 3. 搜索用户（使用"门窗"关键词）
    console.log('═══ 步骤3: 搜索抖音用户（关键词: 门窗）═══\n')
    const searchResult = await apiRequest('/api/v1/douyin/web/fetch_user_search_result', {
      keyword: '门窗',
      offset: 0,
      count: 10
    })

    if (!searchResult.data || !searchResult.data.user_list || searchResult.data.user_list.length === 0) {
      console.log('⚠️  未找到用户')
      return
    }

    console.log(`找到 ${searchResult.data.user_list.length} 个用户:\n`)

    // 显示搜索结果
    searchResult.data.user_list.slice(0, 5).forEach((item: any, index: number) => {
      const user = item.user_info
      console.log(`${index + 1}. ${user.nickname}`)
      console.log(`   UID: ${user.uid}`)
      console.log(`   SecUID: ${user.sec_uid}`)
      console.log(`   签名: ${user.signature || '无'}`)
      console.log(`   粉丝: ${user.follower_count?.toLocaleString()} | 作品: ${user.aweme_count?.toLocaleString()}`)
      console.log(`   位置: ${user.ip_location || user.city || '未知'}`)
      console.log()
    })

    // 选择第一个用户进行详细测试
    const firstUser = searchResult.data.user_list[0].user_info
    const sec_uid = firstUser.sec_uid

    console.log(`✨ 选择用户: ${firstUser.nickname} (${sec_uid})`)
    console.log()

    // 4. 获取用户详细资料
    console.log('═══ 步骤4: 获取用户详细资料 ═══\n')
    const profile = await apiRequest('/api/v1/douyin/app/v3/fetch_user_profile', {
      sec_uid
    })

    const profileData = profile.data
    console.log('📝 用户资料:')
    console.log('昵称:', profileData.nickname)
    console.log('UID:', profileData.uid)
    console.log('SecUID:', profileData.sec_uid)
    console.log('签名:', profileData.signature || '无')
    console.log('粉丝数:', profileData.follower_count?.toLocaleString())
    console.log('关注数:', profileData.following_count?.toLocaleString())
    console.log('获赞数:', profileData.total_favorited?.toLocaleString())
    console.log('作品数:', profileData.aweme_count?.toLocaleString())
    console.log('位置:', profileData.ip_location || profileData.city || '未知')
    console.log('是否认证:', profileData.verification_type > 0 ? '是' : '否')
    if (profileData.enterprise_verify_reason) {
      console.log('企业认证:', profileData.enterprise_verify_reason)
    }
    console.log()

    // 5. 获取用户视频列表
    console.log('═══ 步骤5: 获取用户视频列表（前20个）═══\n')
    const videos = await apiRequest('/api/v1/douyin/app/v3/fetch_user_post_videos', {
      sec_uid,
      max_cursor: 0,
      count: 20
    })

    if (!videos.data || !videos.data.aweme_list) {
      console.log('⚠️  未找到视频')
      return
    }

    console.log(`📹 找到 ${videos.data.aweme_list.length} 个视频:\n`)

    // 显示视频列表
    videos.data.aweme_list.forEach((video: any, index: number) => {
      const createDate = new Date(video.create_time * 1000)

      console.log(`${index + 1}. ${video.desc || '无标题'}`)
      console.log(`   视频ID: ${video.aweme_id}`)
      console.log(`   发布时间: ${createDate.toLocaleString('zh-CN')}`)
      console.log(`   👍 点赞: ${video.statistics?.digg_count?.toLocaleString() || 0}`)
      console.log(`   💬 评论: ${video.statistics?.comment_count?.toLocaleString() || 0}`)
      console.log(`   ⭐ 收藏: ${video.statistics?.collect_count?.toLocaleString() || 0}`)
      console.log(`   📤 分享: ${video.statistics?.share_count?.toLocaleString() || 0}`)

      if (video.video?.duration) {
        const minutes = Math.floor(video.video.duration / 60)
        const seconds = video.video.duration % 60
        console.log(`   ⏱️  时长: ${minutes}:${seconds.toString().padStart(2, '0')}`)
      }

      // 显示标签
      if (video.text_extra && video.text_extra.length > 0) {
        const tags = video.text_extra.map((t: any) => `#${t.hashtag_name}`).join(' ')
        console.log(`   🏷️  标签: ${tags}`)
      }

      console.log(`   🔗 链接: ${video.share_url}`)
      console.log()
    })

    // 统计信息
    const totalDigg = videos.data.aweme_list.reduce((sum: number, v: any) => sum + (v.statistics?.digg_count || 0), 0)
    const totalComment = videos.data.aweme_list.reduce((sum: number, v: any) => sum + (v.statistics?.comment_count || 0), 0)
    const totalCollect = videos.data.aweme_list.reduce((sum: number, v: any) => sum + (v.statistics?.collect_count || 0), 0)
    const totalShare = videos.data.aweme_list.reduce((sum: number, v: any) => sum + (v.statistics?.share_count || 0), 0)

    console.log('═══ 统计摘要 ═══')
    console.log(`视频数量: ${videos.data.aweme_list.length}`)
    console.log(`总点赞数: ${totalDigg.toLocaleString()}`)
    console.log(`总评论数: ${totalComment.toLocaleString()}`)
    console.log(`总收藏数: ${totalCollect.toLocaleString()}`)
    console.log(`总分享数: ${totalShare.toLocaleString()}`)
    console.log(`平均点赞: ${Math.round(totalDigg / videos.data.aweme_list.length).toLocaleString()}`)
    console.log()

    // 6. 获取单个视频详情
    if (videos.data.aweme_list.length > 0) {
      const firstVideo = videos.data.aweme_list[0]
      console.log('═══ 步骤6: 获取单个视频详情 ═══\n')
      const videoDetail = await apiRequest('/api/v1/douyin/app/v1/fetch_one_video', {
        aweme_id: firstVideo.aweme_id
      })

      const vd = videoDetail.data.aweme_detail
      console.log('📹 视频详情:')
      console.log('标题:', vd.desc || '无')
      console.log('作者:', vd.author.nickname)
      console.log('创建时间:', new Date(vd.create_time * 1000).toLocaleString('zh-CN'))

      if (vd.music) {
        console.log('音乐:', vd.music.title)
        console.log('音乐作者:', vd.music.author)
      }

      if (vd.video) {
        console.log('分辨率:', `${vd.video.width}x${vd.video.height}`)
        if (vd.video.cover?.url_list?.[0]) {
          console.log('封面:', vd.video.cover.url_list[0].substring(0, 80) + '...')
        }
        if (vd.video.play_addr?.url_list?.[0]) {
          console.log('播放地址:', vd.video.play_addr.url_list[0].substring(0, 80) + '...')
        }
      }
      console.log()
    }

    // 7. 输出完整的JSON数据（前3个视频）
    console.log('═══ 原始API响应数据（前3个视频）═══\n')
    const sampleData = {
      profile: {
        uid: profileData.uid,
        sec_uid: profileData.sec_uid,
        nickname: profileData.nickname,
        signature: profileData.signature,
        follower_count: profileData.follower_count,
        aweme_count: profileData.aweme_count,
        location: profileData.ip_location || profileData.city
      },
      videos: videos.data.aweme_list.slice(0, 3).map((v: any) => ({
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
    }

    console.log(JSON.stringify(sampleData, null, 2))
    console.log()

    console.log('✅ 测试完成！所有数据获取成功')

  } catch (error: any) {
    console.error('\n❌ 错误:', error.message)
    console.error('详情:', error)
    process.exit(1)
  }
}

main()
