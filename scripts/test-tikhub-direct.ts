/**
 * 简单的TikHub API直接测试
 * 用于了解API真实返回格式
 */

const TIKHUB_API_KEY = process.env.TIKHUB_API_KEY || 'nasQXM88xWilwWy0O6/F5DftDxaSfaA9vSPz62eARtiKgAucPXmRZzaxaA=='
const TIKHUB_API_BASE = 'https://api.tikhub.io'

async function testAPI() {
  console.log('=== TikHub API 直接测试 ===\n')
  console.log('API Key:', TIKHUB_API_KEY.substring(0, 20) + '...\n')

  // 测试1: 搜索用户
  console.log('【测试1】搜索用户（关键词：门窗）')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // 使用APP API而不是Web API（更稳定）
  const searchUrl = `${TIKHUB_API_BASE}/api/v1/douyin/app/v1/search_user?keyword=门窗&count=5`

  try {
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TIKHUB_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('HTTP 状态码:', searchResponse.status)
    console.log('HTTP 状态文本:', searchResponse.statusText)
    console.log('')

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text()
      console.error('❌ 请求失败:')
      console.error(errorText)
      console.error('\n')
    } else {
      const searchData = await searchResponse.json()

      console.log('✅ 搜索成功！\n')
      console.log('========== 完整返回数据 ==========')
      console.log(JSON.stringify(searchData, null, 2))
      console.log('\n')

      console.log('========== 数据结构分析 ==========')
      console.log('顶层字段:', Object.keys(searchData))
      console.log('')

      // 分析用户列表
      if (searchData.data && searchData.data.user_list) {
        console.log(`找到 ${searchData.data.user_list.length} 个用户\n`)

        const firstUser = searchData.data.user_list[0]?.user_info || searchData.data.user_list[0]
        if (firstUser) {
          console.log('第一个用户信息:')
          console.log('  字段:', Object.keys(firstUser))
          console.log('  昵称:', firstUser.nickname)
          console.log('  UID:', firstUser.uid)
          console.log('  sec_uid:', firstUser.sec_uid?.substring(0, 40) + '...')
          console.log('  粉丝数:', firstUser.follower_count)
          console.log('  作品数:', firstUser.aweme_count)
          console.log('')

          // 测试2: 获取该用户的视频
          if (firstUser.sec_uid) {
            console.log('\n【测试2】获取用户视频')
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
            console.log('用户:', firstUser.nickname)
            console.log('sec_uid:', firstUser.sec_uid?.substring(0, 40) + '...\n')

            await testGetUserVideos(firstUser.sec_uid)
          }
        }
      } else if (searchData.user_list) {
        // 可能数据结构不同，直接在顶层
        console.log(`找到 ${searchData.user_list.length} 个用户`)
        const firstUser = searchData.user_list[0]?.user_info || searchData.user_list[0]
        if (firstUser && firstUser.sec_uid) {
          await testGetUserVideos(firstUser.sec_uid)
        }
      }
    }
  } catch (error: any) {
    console.error('❌ 异常:', error.message)
  }
}

async function testGetUserVideos(secUid: string) {
  // 使用APP API v3（更稳定）
  const videoUrl = `${TIKHUB_API_BASE}/api/v1/douyin/app/v3/fetch_user_post_videos?sec_uid=${secUid}&count=10&max_cursor=0`

  try {
    const videoResponse = await fetch(videoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TIKHUB_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('HTTP 状态码:', videoResponse.status)
    console.log('HTTP 状态文本:', videoResponse.statusText)
    console.log('')

    if (!videoResponse.ok) {
      const errorText = await videoResponse.text()
      console.error('❌ 请求失败:')
      console.error(errorText)
      console.error('\n')
    } else {
      const videoData = await videoResponse.json()

      console.log('✅ 获取视频成功！\n')
      console.log('========== 完整返回数据（前2个视频）==========')

      // 只显示前2个视频，避免输出过长
      const limitedData = { ...videoData }
      if (limitedData.data?.aweme_list) {
        limitedData.data.aweme_list = limitedData.data.aweme_list.slice(0, 2)
      } else if (limitedData.aweme_list) {
        limitedData.aweme_list = limitedData.aweme_list.slice(0, 2)
      }

      console.log(JSON.stringify(limitedData, null, 2))
      console.log('\n')

      console.log('========== 数据结构分析 ==========')
      console.log('顶层字段:', Object.keys(videoData))
      console.log('')

      // 分析视频列表
      const awemeList = videoData.data?.aweme_list || videoData.aweme_list
      if (awemeList && Array.isArray(awemeList)) {
        console.log(`视频数量: ${awemeList.length}\n`)

        if (awemeList.length > 0) {
          const firstVideo = awemeList[0]
          console.log('第一个视频的字段:')
          console.log('  顶层字段:', Object.keys(firstVideo))

          if (firstVideo.statistics) {
            console.log('  统计字段:', Object.keys(firstVideo.statistics))
          }

          if (firstVideo.author) {
            console.log('  作者字段:', Object.keys(firstVideo.author))
          }

          if (firstVideo.video) {
            console.log('  视频字段:', Object.keys(firstVideo.video))
          }

          console.log('\n示例视频数据:')
          console.log('  视频ID:', firstVideo.aweme_id)
          console.log('  描述:', firstVideo.desc?.substring(0, 50) + '...')
          console.log('  作者:', firstVideo.author?.nickname)
          console.log('  点赞:', firstVideo.statistics?.digg_count?.toLocaleString())
          console.log('  评论:', firstVideo.statistics?.comment_count?.toLocaleString())
          console.log('  分享:', firstVideo.statistics?.share_count?.toLocaleString())
          console.log('  播放:', firstVideo.statistics?.play_count?.toLocaleString() || '未知')
          console.log('  收藏:', firstVideo.statistics?.collect_count?.toLocaleString())

          if (firstVideo.create_time) {
            const createDate = new Date(firstVideo.create_time * 1000)
            console.log('  发布时间:', createDate.toLocaleString('zh-CN'))
          }

          console.log('')
        }

        // 分页信息
        const hasMore = videoData.data?.has_more || videoData.has_more
        const maxCursor = videoData.data?.max_cursor || videoData.max_cursor

        console.log('分页信息:')
        console.log('  是否有更多:', hasMore)
        console.log('  下一页游标:', maxCursor)
      }
    }
  } catch (error: any) {
    console.error('❌ 异常:', error.message)
  }
}

// 运行测试
testAPI().catch(console.error)
