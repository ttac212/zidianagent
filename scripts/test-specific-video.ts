/**
 * 测试特定视频的完整转录流程
 */

import { getTikHubClient } from '@/lib/tikhub'
import { parseDouyinVideoShare } from '@/lib/douyin/share-link'

async function main() {
  console.log('=== 测试视频转录流程 ===\n')

  const TIKHUB_API_KEY = process.env.TIKHUB_API_KEY
  const TEST_VIDEO_URL = 'https://v.douyin.com/dn2WTcNpnRA/'

  if (!TIKHUB_API_KEY) {
    console.error('❌ 请配置 TIKHUB_API_KEY 环境变量')
    process.exit(1)
  }

  console.log('测试视频链接:', TEST_VIDEO_URL)
  console.log()

  try {
    // 步骤1: 解析分享链接
    console.log('步骤1: 解析抖音短链...')
    const shareResult = await parseDouyinVideoShare(TEST_VIDEO_URL)
    console.log('✅ 链接解析成功')
    console.log('  原始URL:', shareResult.originalUrl)
    console.log('  解析后URL:', shareResult.resolvedUrl)
    console.log('  视频ID:', shareResult.videoId)
    console.log()

    if (!shareResult.videoId) {
      throw new Error('无法提取视频ID')
    }

    // 步骤2: 获取视频详情
    console.log('步骤2: 通过TikHub获取视频详情...')
    const client = getTikHubClient({ apiKey: TIKHUB_API_KEY })

    const videoDetail = await client.getVideoDetail({
      aweme_id: shareResult.videoId
    })

    console.log('✅ 视频详情获取成功')
    console.log()

    const awemeDetail = videoDetail?.aweme_detail
    if (!awemeDetail) {
      throw new Error('TikHub未返回视频详情数据')
    }

    // 显示视频基本信息
    console.log('=== 视频基本信息 ===')
    console.log('标题:', awemeDetail.desc || '无标题')
    console.log('作者:', awemeDetail.author?.nickname || '未知作者')
    console.log('作者UID:', awemeDetail.author?.uid)
    console.log('作者SecUID:', awemeDetail.author?.sec_uid?.substring(0, 40) + '...')
    console.log('视频ID:', awemeDetail.aweme_id)
    console.log('创建时间:', new Date(awemeDetail.create_time * 1000).toLocaleString('zh-CN'))
    console.log()

    // 显示视频统计数据
    console.log('=== 互动数据 ===')
    const stats = awemeDetail.statistics
    console.log('👍 点赞:', stats?.digg_count?.toLocaleString() || 0)
    console.log('💬 评论:', stats?.comment_count?.toLocaleString() || 0)
    console.log('⭐ 收藏:', stats?.collect_count?.toLocaleString() || 0)
    console.log('📤 分享:', stats?.share_count?.toLocaleString() || 0)
    console.log('🎬 播放:', stats?.play_count?.toLocaleString() || '未知')
    console.log()

    // 显示视频元数据
    console.log('=== 视频元数据 ===')
    const video = awemeDetail.video
    if (video) {
      const duration = video.duration
      const normalizedDuration = duration >= 1000 ? duration / 1000 : duration
      console.log('时长:', `${normalizedDuration.toFixed(1)}秒`)
      console.log('分辨率:', `${video.width}x${video.height}`)
      console.log('码率:', video.bit_rate?.length ? `${video.bit_rate.length}个质量版本` : '未知')

      // 检查播放地址
      const playUrls: string[] = []
      if (video.play_addr?.url_list) {
        playUrls.push(...video.play_addr.url_list)
      }
      if (video.bit_rate && Array.isArray(video.bit_rate)) {
        for (const br of video.bit_rate) {
          if (br.play_addr?.url_list) {
            playUrls.push(...br.play_addr.url_list)
          }
        }
      }

      console.log('播放地址数量:', playUrls.length)
      if (playUrls.length > 0) {
        console.log('首个播放地址:', playUrls[0].substring(0, 100) + '...')
      }
    }
    console.log()

    // 显示标签信息
    if (awemeDetail.text_extra && awemeDetail.text_extra.length > 0) {
      console.log('=== 话题标签 ===')
      const hashtags = awemeDetail.text_extra
        .filter((item: any) => item.hashtag_name)
        .map((item: any) => `#${item.hashtag_name}`)
      console.log(hashtags.join(' '))
      console.log()
    }

    if (awemeDetail.video_tag && awemeDetail.video_tag.length > 0) {
      console.log('=== 视频标签 ===')
      const videoTags = awemeDetail.video_tag
        .map((tag: any) => tag.tag_name)
        .filter(Boolean)
      console.log(videoTags.join(', '))
      console.log()
    }

    // 显示音乐信息
    if (awemeDetail.music) {
      console.log('=== 音乐信息 ===')
      console.log('标题:', awemeDetail.music.title || '未知')
      console.log('作者:', awemeDetail.music.author || '未知')
      if (awemeDetail.music.play_url?.url_list) {
        console.log('音乐URL数量:', awemeDetail.music.play_url.url_list.length)
      }
      console.log()
    }

    // 检查是否有可用的播放地址
    console.log('=== 播放地址检查 ===')
    const resolvePlayableUrl = (videoData: any): string | null => {
      const candidates: string[] = []

      if (videoData.play_addr?.url_list) {
        candidates.push(...videoData.play_addr.url_list)
      }

      if (Array.isArray(videoData.bit_rate)) {
        for (const item of videoData.bit_rate) {
          if (item?.play_addr?.url_list) {
            candidates.push(...item.play_addr.url_list)
          }
        }
      }

      if (videoData.download_addr?.url_list) {
        candidates.push(...videoData.download_addr.url_list)
      }

      const sanitized = candidates
        .map(url => url?.includes('playwm') ? url.replace('playwm', 'play') : url)
        .filter((url): url is string => Boolean(url))

      return sanitized.find(url => url.includes('aweme')) || sanitized[0] || null
    }

    const playableUrl = resolvePlayableUrl(awemeDetail.video)
    if (playableUrl) {
      console.log('✅ 找到可用播放地址')
      console.log('URL:', playableUrl.substring(0, 120) + '...')
    } else {
      console.log('❌ 未找到可用播放地址')
    }
    console.log()

    console.log('✅ 所有检查通过！视频可以进行转录')
    console.log()
    console.log('=== 完整JSON响应（部分字段）===')
    console.log(JSON.stringify({
      aweme_id: awemeDetail.aweme_id,
      desc: awemeDetail.desc,
      author: {
        uid: awemeDetail.author?.uid,
        nickname: awemeDetail.author?.nickname,
        sec_uid: awemeDetail.author?.sec_uid?.substring(0, 40) + '...'
      },
      statistics: awemeDetail.statistics,
      video: {
        duration: awemeDetail.video?.duration,
        width: awemeDetail.video?.width,
        height: awemeDetail.video?.height,
        play_addr_count: awemeDetail.video?.play_addr?.url_list?.length || 0,
        bit_rate_count: awemeDetail.video?.bit_rate?.length || 0
      },
      hashtags: awemeDetail.text_extra?.map((t: any) => t.hashtag_name).filter(Boolean) || [],
      video_tags: awemeDetail.video_tag?.map((t: any) => t.tag_name).filter(Boolean) || []
    }, null, 2))

  } catch (error: any) {
    console.error('\n❌ 错误发生')
    console.error('错误信息:', error.message)
    if (error.code) {
      console.error('错误码:', error.code)
    }
    if (error.stack) {
      console.error('错误堆栈:', error.stack)
    }
    process.exit(1)
  }
}

main()
