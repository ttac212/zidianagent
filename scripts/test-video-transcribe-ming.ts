/**
 * 测试使用 inclusionai/ming-flash-omini-preview 模型进行视频转录
 *
 * 该模型支持直接处理视频文件，无需提取音频
 * 解决某些视频没有音频直链的问题
 *
 * 使用方法:
 * npx tsx scripts/test-video-transcribe-ming.ts
 */

// 必须在所有其他导入之前加载环境变量
import dotenv from 'dotenv'
import path from 'path'

// 加载 .env.local 文件
const envPath = path.resolve(process.cwd(), '.env.local')
dotenv.config({ path: envPath })

// 测试链接 - 可以替换为其他抖音视频链接
const testLink = `5.84 10/06 s@e.bA HvF:/ 你就说行不行！这福利够不够！ # 烧烤烤肉 # 围炉煮茶 # 烧烤炉  https://v.douyin.com/iirk2Mp8VBE/ 复制此链接，打开Dou音搜索，直接观看视频`

// API 配置 - 使用 302.AI 进行音频转录测试
const ASR_API_BASE = 'https://api.302.ai/v1'
const ASR_API_KEY = process.env.LLM_API_KEY  // 302.AI 的 API Key
const ZENMUX_API_KEY = process.env.ZENMUX_API_KEY
const TIKHUB_API_KEY = process.env.TIKHUB_API_KEY
const TIKHUB_API_BASE_URL = process.env.TIKHUB_API_BASE_URL || 'https://api.tikhub.io'
// 302.AI 使用的模型
const VIDEO_TRANSCRIBE_MODEL = 'gpt-4o-audio-preview'

interface VideoInfo {
  title: string
  author: string
  duration: number
  videoId: string
}

/**
 * 解析抖音分享链接，提取视频ID
 */
async function parseDouyinShareLink(shareText: string): Promise<string | null> {
  // 提取URL
  const urlMatch = shareText.match(/https?:\/\/[^\s]+/)
  if (!urlMatch) return null

  const shareUrl = urlMatch[0]
  console.log(`  解析URL: ${shareUrl}`)

  try {
    // 跟随重定向获取最终URL
    const response = await fetch(shareUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
      }
    })

    const finalUrl = response.url
    console.log(`  最终URL: ${finalUrl}`)

    // 从URL中提取视频ID
    // 格式1: /video/7575104442370903330
    const videoMatch = finalUrl.match(/\/video\/(\d+)/)
    if (videoMatch) return videoMatch[1]

    // 格式2: modal_id=7575104442370903330
    const modalMatch = finalUrl.match(/modal_id=(\d+)/)
    if (modalMatch) return modalMatch[1]

    // 格式3: 短链接重定向后的路径 /share/video/xxx
    const shareMatch = finalUrl.match(/\/share\/video\/(\d+)/)
    if (shareMatch) return shareMatch[1]

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
 * 从TikHub返回的aweme_detail中提取可播放URL
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
 * 规范化视频时长（统一为秒）
 */
function normalizeDurationSeconds(duration?: number | null): number {
  if (!duration || Number.isNaN(duration)) return 0
  return duration >= 1000 ? duration / 1000 : duration
}

/**
 * 使用 gpt-4o-audio-preview 模型转录音频
 * 使用 302.AI 的 API 端点
 */
async function transcribeAudioWithMing(
  audioBuffer: Buffer,
  videoInfo: VideoInfo
): Promise<string> {
  console.log('\n📝 调用 gpt-4o-audio-preview 进行音频转录...')
  console.log(`  模型: ${VIDEO_TRANSCRIBE_MODEL}`)
  console.log(`  API: ${ASR_API_BASE}`)
  console.log(`  音频大小: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`)

  const base64Audio = audioBuffer.toString('base64')

  // 使用与 302.AI gpt-4o-audio-preview 相同的格式
  const requestBody = {
    model: VIDEO_TRANSCRIBE_MODEL,
    modalities: ['text'],
    max_tokens: 4000,
    temperature: 0.1,
    stream: true,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `这是一段抖音视频的音频转录任务。请仔细转录音频内容，注意以下要点：

1. **准确识别**：尽可能准确地识别每个字词，特别注意处理方言口音和不标准发音
2. **同音字辨析**：遇到同音字时，结合上下文语境选择正确的汉字
3. **专业术语**：遇到行业术语、品牌名称或网络用语时，使用最常见的规范写法
4. **保持原意**：完整转录说话内容，包括语气词（如"嗯"、"啊"、"哦"等）
5. **纯文本输出**：只返回转录的文字，不要添加任何说明、解释或格式标记

请开始转录：`
          },
          {
            type: 'input_audio',
            input_audio: {
              data: base64Audio,
              format: 'mp3'
            }
          }
        ]
      }
    ]
  }

  console.log('\n  发送请求到 302.AI...')

  const response = await fetch(`${ASR_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ASR_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  })

  console.log(`  HTTP状态码: ${response.status}`)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API请求失败: ${response.status} - ${errorText}`)
  }

  // 处理流式响应
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('无法读取响应流')
  }

  const decoder = new TextDecoder()
  let transcript = ''
  let buffer = ''

  console.log('\n  接收响应...')

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim() || line.startsWith(':')) continue
        if (line === 'data: [DONE]') continue

        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            const delta = data.choices?.[0]?.delta?.content
            if (delta) {
              transcript += delta
              process.stdout.write(delta)
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  console.log('\n')

  return transcript
}

/**
 * 使用 ming-flash-omini-preview 模型转录视频
 * 支持直接传入视频的 base64 数据
 */
async function transcribeVideoWithMing(
  videoBuffer: Buffer,
  videoInfo: VideoInfo
): Promise<string> {
  console.log('\n📝 调用 ming-flash-omini-preview 进行视频转录...')
  console.log(`  模型: ${VIDEO_TRANSCRIBE_MODEL}`)
  console.log(`  API: ${ZENMUX_API_BASE}`)
  console.log(`  视频大小: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`)

  const base64Video = videoBuffer.toString('base64')

  // 构建请求 - 使用 OpenAI 多模态格式
  // 参考: https://platform.openai.com/docs/guides/vision
  const requestBody = {
    model: VIDEO_TRANSCRIBE_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:video/mp4;base64,${base64Video}`
            }
          },
          {
            type: 'text',
            text: `这是一段抖音视频的语音转录任务。请仔细转录视频中的语音内容，注意以下要点：

1. **准确识别**：尽可能准确地识别每个字词，特别注意处理方言口音和不标准发音
2. **同音字辨析**：遇到同音字时，结合上下文语境选择正确的汉字
3. **专业术语**：遇到行业术语、品牌名称或网络用语时，使用最常见的规范写法
4. **保持原意**：完整转录说话内容，包括语气词（如"嗯"、"啊"、"哦"等）
5. **纯文本输出**：只返回转录的文字，不要添加任何说明、解释或格式标记

请开始转录：`
          }
        ]
      }
    ],
    max_tokens: 4000,
    temperature: 0.1,
    stream: true
  }

  console.log('\n  发送请求...')
  console.log('  请求体结构:', JSON.stringify({
    model: requestBody.model,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:video/mp4;base64,[${base64Video.length} chars]` } },
        { type: 'text', text: '...' }
      ]
    }]
  }, null, 2))

  const response = await fetch(`${ZENMUX_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ZENMUX_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  })

  console.log(`  HTTP状态码: ${response.status}`)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API请求失败: ${response.status} - ${errorText}`)
  }

  // 处理流式响应
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('无法读取响应流')
  }

  const decoder = new TextDecoder()
  let transcript = ''
  let buffer = ''

  console.log('\n  接收响应...')

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim() || line.startsWith(':')) continue
        if (line === 'data: [DONE]') continue

        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            const delta = data.choices?.[0]?.delta?.content
            if (delta) {
              transcript += delta
              process.stdout.write(delta)
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  console.log('\n')

  return transcript
}

/**
 * 备选方案：尝试使用视频URL而不是base64
 */
async function transcribeVideoWithUrl(
  videoUrl: string,
  videoInfo: VideoInfo
): Promise<string> {
  console.log('\n📝 调用 ming-flash-omini-preview 进行视频转录（URL模式）...')
  console.log(`  模型: ${VIDEO_TRANSCRIBE_MODEL}`)
  console.log(`  视频URL: ${videoUrl.substring(0, 80)}...`)

  const requestBody = {
    model: VIDEO_TRANSCRIBE_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'video',
            video: videoUrl
          },
          {
            type: 'text',
            text: `这是一段抖音视频的语音转录任务。请仔细转录视频中的语音内容，注意以下要点：

1. **准确识别**：尽可能准确地识别每个字词，特别注意处理方言口音和不标准发音
2. **同音字辨析**：遇到同音字时，结合上下文语境选择正确的汉字
3. **专业术语**：遇到行业术语、品牌名称或网络用语时，使用最常见的规范写法
4. **保持原意**：完整转录说话内容，包括语气词（如"嗯"、"啊"、"哦"等）
5. **纯文本输出**：只返回转录的文字，不要添加任何说明、解释或格式标记

请开始转录：`
          }
        ]
      }
    ],
    max_tokens: 4000,
    temperature: 0.1,
    stream: true
  }

  const response = await fetch(`${ZENMUX_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ZENMUX_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  })

  console.log(`  HTTP状态码: ${response.status}`)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API请求失败: ${response.status} - ${errorText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('无法读取响应流')
  }

  const decoder = new TextDecoder()
  let transcript = ''
  let buffer = ''

  console.log('\n  接收响应...')

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim() || line.startsWith(':')) continue
        if (line === 'data: [DONE]') continue

        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            const delta = data.choices?.[0]?.delta?.content
            if (delta) {
              transcript += delta
              process.stdout.write(delta)
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  console.log('\n')

  return transcript
}

// 抖音请求头
const DOUYIN_DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  'Accept': '*/*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Referer': 'https://www.douyin.com/'
}

async function main() {
  console.log('='.repeat(80))
  console.log('🎬 测试 ming-flash-omini-preview 视频转录')
  console.log('='.repeat(80))
  console.log()

  // 检查环境变量
  if (!ASR_API_KEY) {
    console.error('❌ 错误: 未配置 LLM_API_KEY 环境变量（302.AI API Key）')
    process.exit(1)
  }

  if (!TIKHUB_API_KEY) {
    console.error('❌ 错误: 未配置 TIKHUB_API_KEY 环境变量')
    process.exit(1)
  }

  console.log('✅ 环境检查通过')
  console.log(`  302.AI API Base: ${ASR_API_BASE}`)
  console.log(`  Model: ${VIDEO_TRANSCRIBE_MODEL}`)
  console.log(`  302.AI API Key: ${ASR_API_KEY.substring(0, 20)}...`)
  console.log(`  TikHub API Base: ${TIKHUB_API_BASE_URL}`)
  console.log(`  TikHub API Key: ${TIKHUB_API_KEY.substring(0, 20)}...`)
  console.log()

  try {
    // 步骤1: 解析链接
    console.log('📋 步骤1: 解析抖音链接...')
    const videoId = await parseDouyinShareLink(testLink)

    if (!videoId) {
      throw new Error('无法从链接中提取视频ID')
    }

    console.log(`  ✅ 视频ID: ${videoId}`)

    // 步骤2: 获取视频详情
    console.log('\n📋 步骤2: 获取视频详情...')
    const awemeDetail = await fetchVideoDetail(videoId)

    if (!awemeDetail) {
      throw new Error('TikHub未返回视频详情数据')
    }

    const videoUrl = resolvePlayableVideoUrl(awemeDetail)
    if (!videoUrl) {
      throw new Error('未能获取可用的视频播放地址')
    }

    const videoInfo: VideoInfo = {
      title: awemeDetail.desc || '未知标题',
      author: awemeDetail.author?.nickname || '未知作者',
      duration: normalizeDurationSeconds(awemeDetail.video?.duration),
      videoId: videoId
    }

    console.log(`  ✅ 标题: ${videoInfo.title}`)
    console.log(`  ✅ 作者: ${videoInfo.author}`)
    console.log(`  ✅ 时长: ${videoInfo.duration.toFixed(1)}秒`)
    console.log(`  ✅ 视频URL: ${videoUrl.substring(0, 60)}...`)

    // 检查音频直链
    const audioUrl = awemeDetail?.music?.play_url?.url_list?.[0]
    console.log(`  ${audioUrl ? '✅' : '⚠️'} 音频直链: ${audioUrl ? audioUrl.substring(0, 50) + '...' : '不可用'}`)

    let transcript = ''
    let method = ''

    // 步骤3: 优先使用音频直链
    if (audioUrl) {
      console.log('\n📋 步骤3: 下载音频（直链）...')

      const audioResponse = await fetch(audioUrl, {
        headers: DOUYIN_DEFAULT_HEADERS
      })

      if (audioResponse.ok) {
        const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())
        console.log(`  ✅ 音频下载完成: ${(audioBuffer.length / 1024).toFixed(2)} KB`)

        // 步骤4: 使用音频转录
        console.log('\n📋 步骤4: 调用模型转录（音频模式）...')
        method = '音频直链模式'

        try {
          transcript = await transcribeAudioWithMing(audioBuffer, videoInfo)
        } catch (audioError) {
          console.log(`  ⚠️ 音频转录失败: ${audioError instanceof Error ? audioError.message : audioError}`)
        }
      } else {
        console.log(`  ⚠️ 音频下载失败: ${audioResponse.status}`)
      }
    }

    // 如果音频模式失败或不可用，下载视频后从视频中提取音频
    if (!transcript) {
      console.log('\n📋 步骤3b: 下载视频并提取音频...')

      const videoResponse = await fetch(videoUrl, {
        headers: DOUYIN_DEFAULT_HEADERS
      })

      if (!videoResponse.ok) {
        throw new Error(`视频下载失败: ${videoResponse.status}`)
      }

      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer())
      console.log(`  ✅ 视频下载完成: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`)

      // 尝试使用 FFmpeg 提取音频（如果可用）
      console.log('  尝试提取音频...')

      try {
        // 动态导入 VideoProcessor
        const { VideoProcessor } = await import('@/lib/video/video-processor')

        const audioBuffer = await VideoProcessor.extractAudio(videoBuffer, {
          format: 'mp3',
          sampleRate: 16000,
          channels: 1,
          bitrate: '128k'
        })

        console.log(`  ✅ 音频提取完成: ${(audioBuffer.length / 1024).toFixed(2)} KB`)

        // 步骤4: 使用音频转录
        console.log('\n📋 步骤4: 调用模型转录（提取音频模式）...')
        method = '视频提取音频模式'
        transcript = await transcribeAudioWithMing(audioBuffer, videoInfo)
      } catch (extractError) {
        console.log(`  ⚠️ 音频提取失败: ${extractError instanceof Error ? extractError.message : extractError}`)
        console.log('  FFmpeg可能未安装，跳过音频提取')

        // 最后尝试视频模式
        console.log('\n📋 步骤4: 调用模型转录（视频模式）...')
        method = '视频Base64模式'
        transcript = await transcribeVideoWithMing(videoBuffer, videoInfo)
      }
    }

    // 显示结果
    console.log('\n' + '='.repeat(80))
    console.log('📝 转录结果')
    console.log('='.repeat(80))
    console.log(`\n使用方法: ${method}`)
    console.log(`文本长度: ${transcript.length} 字符`)
    console.log('\n--- 转录内容 ---\n')
    console.log(transcript || '(无内容)')
    console.log('\n--- 结束 ---')

    console.log('\n' + '='.repeat(80))
    console.log('✅ 测试完成!')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    if (error instanceof Error) {
      console.error('错误信息:', error.message)
      if (error.stack) {
        console.error('堆栈:', error.stack)
      }
    }
    process.exit(1)
  }
}

main().catch(console.error)
