/**
 * 测试 302.AI 是否支持从视频中提取音频
 *
 * 目标：找到一个稳定的云端方案，在 Vercel 环境下使用
 *
 * 使用方法:
 * npx tsx scripts/test-302ai-video-to-audio.ts
 */

import dotenv from 'dotenv'
import path from 'path'

// 加载环境变量
const envPath = path.resolve(process.cwd(), '.env.local')
dotenv.config({ path: envPath })

const API_302_BASE = 'https://api.302.ai'
const API_302_KEY = process.env.LLM_API_KEY
const TIKHUB_API_KEY = process.env.TIKHUB_API_KEY
const TIKHUB_API_BASE_URL = process.env.TIKHUB_API_BASE_URL || 'https://api.tikhub.io'

// 测试链接
const testLink = `5.84 10/06 s@e.bA HvF:/ 你就说行不行！这福利够不够！ # 烧烤烤肉 # 围炉煮茶 # 烧烤炉  https://v.douyin.com/iirk2Mp8VBE/ 复制此链接，打开Dou音搜索，直接观看视频`

// 抖音请求头
const DOUYIN_DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  'Accept': '*/*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Referer': 'https://www.douyin.com/'
}

/**
 * 解析抖音分享链接
 */
async function parseDouyinShareLink(shareText: string): Promise<string | null> {
  const urlMatch = shareText.match(/https?:\/\/[^\s]+/)
  if (!urlMatch) return null

  const shareUrl = urlMatch[0]
  console.log(`  解析URL: ${shareUrl}`)

  try {
    const response = await fetch(shareUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
      }
    })

    const finalUrl = response.url
    console.log(`  最终URL: ${finalUrl}`)

    const videoMatch = finalUrl.match(/\/video\/(\d+)/)
    if (videoMatch) return videoMatch[1]

    const modalMatch = finalUrl.match(/modal_id=(\d+)/)
    if (modalMatch) return modalMatch[1]

    return null
  } catch (error) {
    console.error('  解析链接失败:', error)
    return null
  }
}

/**
 * 调用TikHub API获取视频详情
 */
async function fetchVideoDetail(videoId: string): Promise<any> {
  const endpoint = `${TIKHUB_API_BASE_URL}/api/v1/douyin/app/v3/fetch_one_video`

  const response = await fetch(`${endpoint}?aweme_id=${videoId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TIKHUB_API_KEY}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`TikHub API错误: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return data.data?.aweme_detail || null
}

/**
 * 从TikHub返回的aweme_detail中提取视频URL
 */
function resolvePlayableVideoUrl(awemeDetail: any): string | null {
  const videoData: any = awemeDetail.video || awemeDetail
  if (!videoData) return null

  const candidates: Array<string | undefined> = []

  if (Array.isArray(videoData.play_addr?.url_list)) {
    candidates.push(...videoData.play_addr.url_list)
  }

  if (Array.isArray(videoData.bit_rate)) {
    for (const item of videoData.bit_rate) {
      if (Array.isArray(item?.play_addr?.url_list)) {
        candidates.push(...item.play_addr.url_list)
      }
    }
  }

  if (Array.isArray(videoData.download_addr?.url_list)) {
    candidates.push(...videoData.download_addr.url_list)
  }

  const sanitized = candidates
    .map((url) => (url?.includes('playwm') ? url.replace('playwm', 'play') : url))
    .filter((url): url is string => Boolean(url))

  return sanitized.find((url) => url.includes('aweme')) || sanitized[0] || null
}

/**
 * 方案1：测试 302.AI Whisper API（直接传视频URL）
 */
async function test302WhisperWithVideoUrl(videoUrl: string): Promise<void> {
  console.log('\n📋 方案1: 测试 302.AI Whisper API（视频URL）')
  console.log('  尝试直接传视频URL给Whisper...')

  try {
    const response = await fetch(`${API_302_BASE}/v1/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_302_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'whisper-1',
        url: videoUrl,
        response_format: 'text'
      })
    })

    console.log(`  HTTP状态码: ${response.status}`)
    const result = await response.text()
    console.log(`  响应: ${result.substring(0, 200)}...`)

    if (response.ok) {
      console.log('  ✅ 方案1成功!')
    } else {
      console.log('  ❌ 方案1失败')
    }
  } catch (error) {
    console.log(`  ❌ 方案1错误: ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * 方案2：测试 302.AI Whisper API（下载视频后上传）
 */
async function test302WhisperWithVideoBuffer(videoUrl: string): Promise<void> {
  console.log('\n📋 方案2: 测试 302.AI Whisper API（上传视频文件）')

  try {
    // 下载视频
    console.log('  下载视频...')
    const videoResponse = await fetch(videoUrl, { headers: DOUYIN_DEFAULT_HEADERS })
    if (!videoResponse.ok) {
      throw new Error(`视频下载失败: ${videoResponse.status}`)
    }
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer())
    console.log(`  视频大小: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`)

    // 构建FormData
    const formData = new FormData()
    const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' })
    formData.append('file', videoBlob, 'video.mp4')
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'text')

    console.log('  上传到Whisper API...')
    const response = await fetch(`${API_302_BASE}/v1/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_302_KEY}`
      },
      body: formData
    })

    console.log(`  HTTP状态码: ${response.status}`)
    const result = await response.text()
    console.log(`  响应: ${result.substring(0, 500)}`)

    if (response.ok) {
      console.log('  ✅ 方案2成功!')
    } else {
      console.log('  ❌ 方案2失败')
    }
  } catch (error) {
    console.log(`  ❌ 方案2错误: ${error instanceof Error ? error.message : error}`)
  }
}

/**
 * 方案3：测试 gpt-4o-audio-preview 直接处理视频
 */
async function test302AudioPreviewWithVideo(videoUrl: string): Promise<void> {
  console.log('\n📋 方案3: 测试 gpt-4o-audio-preview（视频URL）')

  try {
    // 下载视频
    console.log('  下载视频...')
    const videoResponse = await fetch(videoUrl, { headers: DOUYIN_DEFAULT_HEADERS })
    if (!videoResponse.ok) {
      throw new Error(`视频下载失败: ${videoResponse.status}`)
    }
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer())
    console.log(`  视频大小: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`)

    const base64Video = videoBuffer.toString('base64')

    // 尝试以视频格式发送
    const response = await fetch(`${API_302_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_302_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-audio-preview',
        modalities: ['text'],
        max_tokens: 4000,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: '请转录这段视频中的语音内容，只返回转录文字：'
            },
            {
              type: 'input_audio',
              input_audio: {
                data: base64Video,
                format: 'mp4'  // 尝试mp4格式
              }
            }
          ]
        }]
      })
    })

    console.log(`  HTTP状态码: ${response.status}`)
    const result = await response.text()
    console.log(`  响应: ${result.substring(0, 500)}`)

    if (response.ok) {
      console.log('  ✅ 方案3成功!')
    } else {
      console.log('  ❌ 方案3失败')
    }
  } catch (error) {
    console.log(`  ❌ 方案3错误: ${error instanceof Error ? error.message : error}`)
  }
}

async function main() {
  console.log('='.repeat(80))
  console.log('🧪 测试 302.AI 云端视频转音频/转录方案')
  console.log('='.repeat(80))

  // 检查环境变量
  if (!API_302_KEY) {
    console.error('❌ 错误: 未配置 LLM_API_KEY')
    process.exit(1)
  }
  if (!TIKHUB_API_KEY) {
    console.error('❌ 错误: 未配置 TIKHUB_API_KEY')
    process.exit(1)
  }

  console.log('✅ 环境检查通过')
  console.log(`  302.AI API Key: ${API_302_KEY.substring(0, 20)}...`)

  try {
    // 解析链接获取视频
    console.log('\n📋 步骤1: 解析抖音链接...')
    const videoId = await parseDouyinShareLink(testLink)
    if (!videoId) {
      throw new Error('无法解析视频ID')
    }
    console.log(`  ✅ 视频ID: ${videoId}`)

    console.log('\n📋 步骤2: 获取视频详情...')
    const awemeDetail = await fetchVideoDetail(videoId)
    if (!awemeDetail) {
      throw new Error('获取视频详情失败')
    }

    const videoUrl = resolvePlayableVideoUrl(awemeDetail)
    if (!videoUrl) {
      throw new Error('获取视频URL失败')
    }
    console.log(`  ✅ 视频URL: ${videoUrl.substring(0, 60)}...`)

    // 检查是否有音频直链
    const audioUrl = awemeDetail?.music?.play_url?.url_list?.[0]
    console.log(`  ${audioUrl ? '✅' : '⚠️'} 音频直链: ${audioUrl ? '可用' : '不可用'}`)

    // 测试各种方案
    await test302WhisperWithVideoUrl(videoUrl)
    await test302WhisperWithVideoBuffer(videoUrl)
    await test302AudioPreviewWithVideo(videoUrl)

    console.log('\n' + '='.repeat(80))
    console.log('📊 测试完成')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  }
}

main().catch(console.error)
