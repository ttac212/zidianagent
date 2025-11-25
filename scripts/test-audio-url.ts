/**
 * 测试脚本：检查 TikHub API 是否返回音频 URL
 *
 * 运行方式：
 * TIKHUB_API_KEY="your_key" npx tsx scripts/test-audio-url.ts
 */

const TIKHUB_API_KEY = process.env.TIKHUB_API_KEY || 'nasQXM88xWilwWy0O6/F5DftDxaSfaA9vSPz62eARtiKgAucPXmRZzaxaA=='
const TIKHUB_API_BASE = process.env.TIKHUB_API_BASE_URL || 'https://api.tikhub.io'

// 测试分享链接
const TEST_SHARE_URL = 'https://v.douyin.com/ovjKmsLYpn8/'

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║     TikHub 音频 URL 测试                          ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  console.log('测试链接:', TEST_SHARE_URL)
  console.log('API Base:', TIKHUB_API_BASE)
  console.log('')

  // 使用 fetch_one_video_by_share_url 端点
  const url = `${TIKHUB_API_BASE}/api/v1/douyin/web/fetch_one_video_by_share_url?share_url=${encodeURIComponent(TEST_SHARE_URL)}`

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

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ 请求失败:', errorText)
      return
    }

    const result = await response.json()

    console.log('\n========== 完整响应 ==========')
    console.log(JSON.stringify(result, null, 2))

    // 分析数据结构
    const data = result.data
    if (data) {
      console.log('\n========== 关键字段分析 ==========')

      // 检查 music 字段
      if (data.music) {
        console.log('\n📀 Music 字段:')
        console.log(JSON.stringify(data.music, null, 2))

        if (data.music.play_url) {
          console.log('\n✅ 找到音频 URL!')
          console.log('play_url:', data.music.play_url)
          if (data.music.play_url.url_list) {
            console.log('url_list:', data.music.play_url.url_list)
          }
        } else {
          console.log('\n❌ music 字段中没有 play_url')
        }
      } else {
        console.log('\n❌ 没有 music 字段')
      }

      // 检查 video 字段
      if (data.video) {
        console.log('\n🎬 Video 字段的 URL:')
        if (data.video.play_addr?.url_list) {
          console.log('play_addr.url_list[0]:', data.video.play_addr.url_list[0]?.substring(0, 100) + '...')
        }
      }

      // 递归搜索所有包含 "music" 或 "audio" 的字段
      console.log('\n🔍 搜索所有可能的音频相关字段...')
      findAudioFields(data, '')
    }

  } catch (error: any) {
    console.error('❌ 异常:', error.message)
  }
}

function findAudioFields(obj: any, path: string) {
  if (!obj || typeof obj !== 'object') return

  for (const key of Object.keys(obj)) {
    const fullPath = path ? `${path}.${key}` : key
    const value = obj[key]

    // 检查 key 是否包含音频相关关键词
    if (/music|audio|sound|mp3/i.test(key)) {
      console.log(`  ${fullPath}:`, typeof value === 'object' ? JSON.stringify(value).substring(0, 200) : value)
    }

    // 检查值是否是 URL 且包含音频相关内容
    if (typeof value === 'string' && /\.(mp3|m4a|aac|wav)/i.test(value)) {
      console.log(`  🎵 ${fullPath}: ${value.substring(0, 150)}...`)
    }

    // 递归检查
    if (typeof value === 'object') {
      findAudioFields(value, fullPath)
    }
  }
}

main().catch(console.error)
