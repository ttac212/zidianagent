/**
 * TikHub API 数据格式查看脚本
 * 直接展示API返回的数据结构
 *
 * 运行方法:
 * 1. 使用环境变量提供sec_uid：
 *    SEC_UID="MS4wLjABAAAA..." npx tsx scripts/view-tikhub-data-format.ts
 *
 * 2. 使用默认测试（需要你手动提供一个有效的sec_uid）
 */

const TIKHUB_API_KEY = process.env.TIKHUB_API_KEY || 'nasQXM88xWilwWy0O6/F5DftDxaSfaA9vSPz62eARtiKgAucPXmRZzaxaA=='
const TIKHUB_API_BASE = 'https://api.tikhub.io'
const TEST_SEC_UID = process.env.SEC_UID

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║        TikHub API 数据格式查看工具               ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  console.log('API Key:', TIKHUB_API_KEY.substring(0, 20) + '...\n')

  if (!TEST_SEC_UID) {
    console.log('⚠️  未提供 sec_uid 环境变量\n')
    console.log('要测试API数据格式，你需要提供一个有效的抖音用户 sec_uid\n')
    console.log('获取 sec_uid 的方法:')
    console.log('  1. 访问抖音网页版: https://www.douyin.com')
    console.log('  2. 找到一个用户主页')
    console.log('  3. 查看URL，例如: https://www.douyin.com/user/MS4wLjABAAAA...')
    console.log('  4. 复制 /user/ 后面的部分（MS4wLjABAAAA...）\n')
    console.log('使用方法:')
    console.log('  SEC_UID="你的sec_uid" npx tsx scripts/view-tikhub-data-format.ts\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log('现在我将展示API请求的基本信息和预期的数据格式...\n')

    showExpectedDataFormat()
    return
  }

  console.log('使用 sec_uid:', TEST_SEC_UID.substring(0, 30) + '...\n')

  // 测试1: 获取用户资料
  console.log('【测试1】获取用户资料')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  await testGetUserProfile(TEST_SEC_UID)

  // 测试2: 获取用户视频列表
  console.log('\n【测试2】获取用户视频列表')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  await testGetUserVideos(TEST_SEC_UID)

  console.log('\n✅ 测试完成！\n')
}

async function testGetUserProfile(secUid: string) {
  const url = `${TIKHUB_API_BASE}/api/v1/douyin/app/v3/fetch_user_profile?sec_uid=${secUid}`

  console.log('请求 URL:', url)
  console.log('')

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TIKHUB_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('HTTP 状态:', response.status, response.statusText)
    console.log('')

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ 请求失败:', errorText)
      return
    }

    const data = await response.json()

    console.log('✅ 获取成功！\n')
    console.log('========== API 完整响应 ==========')
    console.log(JSON.stringify(data, null, 2))
    console.log('\n')

    console.log('========== 响应结构分析 ==========')
    console.log('顶层字段:', Object.keys(data))
    console.log('')

    if (data.data) {
      console.log('data 字段结构:', Object.keys(data.data))
      console.log('')
      console.log('用户信息摘要:')
      console.log('  昵称:', data.data.nickname)
      console.log('  UID:', data.data.uid)
      console.log('  粉丝数:', data.data.follower_count?.toLocaleString())
      console.log('  作品数:', data.data.aweme_count?.toLocaleString())
    }

  } catch (error: any) {
    console.error('❌ 异常:', error.message)
  }
}

async function testGetUserVideos(secUid: string) {
  const url = `${TIKHUB_API_BASE}/api/v1/douyin/app/v3/fetch_user_post_videos?sec_user_id=${secUid}&count=5&max_cursor=0`

  console.log('请求 URL:', url)
  console.log('')

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TIKHUB_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('HTTP 状态:', response.status, response.statusText)
    console.log('')

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ 请求失败:', errorText)
      return
    }

    const data = await response.json()

    console.log('✅ 获取成功！\n')

    // 限制输出，只显示前2个视频
    const limitedData = { ...data }
    if (limitedData.data?.aweme_list) {
      const fullList = limitedData.data.aweme_list
      limitedData.data.aweme_list = fullList.slice(0, 2)
      console.log(`注意: 实际返回 ${fullList.length} 个视频，这里只显示前2个以节省空间\n`)
    }

    console.log('========== API 完整响应（前2个视频）==========')
    console.log(JSON.stringify(limitedData, null, 2))
    console.log('\n')

    console.log('========== 响应结构分析 ==========')
    console.log('顶层字段:', Object.keys(data))
    console.log('')

    if (data.data) {
      console.log('data 字段结构:', Object.keys(data.data))
      console.log('')

      const awemeList = data.data.aweme_list
      if (awemeList && awemeList.length > 0) {
        console.log('视频列表长度:', awemeList.length)
        console.log('')

        const firstVideo = awemeList[0]
        console.log('单个视频的字段结构:')
        console.log('  顶层:', Object.keys(firstVideo))
        console.log('  statistics:', firstVideo.statistics ? Object.keys(firstVideo.statistics) : '无')
        console.log('  author:', firstVideo.author ? Object.keys(firstVideo.author) : '无')
        console.log('  video:', firstVideo.video ? Object.keys(firstVideo.video) : '无')
        console.log('  music:', firstVideo.music ? Object.keys(firstVideo.music) : '无')
        console.log('')

        console.log('视频数据示例（第一个视频）:')
        console.log('  视频ID:', firstVideo.aweme_id)
        console.log('  描述:', firstVideo.desc?.substring(0, 50) || '无')
        console.log('  作者:', firstVideo.author?.nickname)
        console.log('  点赞:', firstVideo.statistics?.digg_count?.toLocaleString())
        console.log('  评论:', firstVideo.statistics?.comment_count?.toLocaleString())
        console.log('  分享:', firstVideo.statistics?.share_count?.toLocaleString())
        console.log('  收藏:', firstVideo.statistics?.collect_count?.toLocaleString())
        console.log('  播放:', firstVideo.statistics?.play_count?.toLocaleString() || '未知')
        console.log('')

        console.log('分页信息:')
        console.log('  has_more:', data.data.has_more)
        console.log('  max_cursor:', data.data.max_cursor)
      }
    }

  } catch (error: any) {
    console.error('❌ 异常:', error.message)
  }
}

function showExpectedDataFormat() {
  console.log('预期的API响应数据格式:\n')

  console.log('1️⃣  用户资料 API (fetch_user_profile):')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(JSON.stringify({
    code: 200,
    message: "Success",
    data: {
      uid: "用户UID",
      sec_uid: "加密的用户ID",
      nickname: "用户昵称",
      signature: "个人签名",
      avatar_thumb: {
        url_list: ["头像URL"]
      },
      follower_count: 10000,
      following_count: 100,
      total_favorited: 50000,
      aweme_count: 200,
      ip_location: "地理位置",
      verification_type: 0,
      enterprise_verify_reason: "企业认证信息"
    }
  }, null, 2))

  console.log('\n\n2️⃣  用户视频列表 API (fetch_user_post_videos):')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(JSON.stringify({
    code: 200,
    message: "Success",
    data: {
      aweme_list: [
        {
          aweme_id: "视频ID",
          desc: "视频描述",
          create_time: 1234567890,
          author: {
            uid: "作者UID",
            sec_uid: "作者sec_uid",
            nickname: "作者昵称",
            unique_id: "作者抖音号"
          },
          statistics: {
            comment_count: 100,
            digg_count: 1000,
            share_count: 50,
            play_count: 10000,
            collect_count: 200
          },
          video: {
            duration: 15,
            width: 1080,
            height: 1920,
            play_addr: {
              url_list: ["视频播放URL"]
            },
            cover: {
              url_list: ["封面URL"]
            }
          },
          music: {
            id: "音乐ID",
            title: "音乐标题",
            author: "音乐作者",
            duration: 60
          },
          share_url: "分享链接",
          text_extra: [
            {
              hashtag_name: "标签名称",
              hashtag_id: "标签ID",
              type: 0
            }
          ]
        }
      ],
      has_more: true,
      max_cursor: 123456789,
      status_code: 0
    }
  }, null, 2))

  console.log('\n\n💡 使用提示:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('1. 所有成功的响应都有统一格式: { code, message, data }')
  console.log('2. code: 200 表示成功，其他值表示错误')
  console.log('3. data 字段包含实际的业务数据')
  console.log('4. 视频列表支持分页，使用 max_cursor 获取下一页')
  console.log('5. 统计数据都在 statistics 对象中')
  console.log('6. 标签信息在 text_extra 数组中')
  console.log('')
}

// 运行主函数
main().catch(console.error)
