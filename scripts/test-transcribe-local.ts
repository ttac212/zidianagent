/**
 * 本地测试脚本：视频转录 + 商家创作档案生成
 *
 * 用法：
 * npx tsx scripts/test-transcribe-local.ts
 */

import { config } from 'dotenv'
// 显式加载 .env.local
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 测试商家名称
const TEST_MERCHANT_NAME = '南宁燕姐金瀚建材瓷砖批发'
const TEST_MERCHANT_ID = 'cmifg91ts0002jr04c4dtp2yv'

// 直接使用分享链接测试转录（跳过数据库）
const TEST_SHARE_LINK = 'https://www.iesdouyin.com/share/video/7493456518679956751/'

async function testTranscribe(shareUrl: string) {
  console.log('\n📝 开始测试视频转录...')
  console.log('分享链接:', shareUrl)

  const apiKey = process.env.DOUBAO_ASR_API_KEY || process.env.LLM_API_KEY
  if (!apiKey) {
    throw new Error('未配置 API Key')
  }

  // 调用本地API
  const baseUrl = 'http://localhost:3007'

  // 需要先获取一个有效的session token，这里我们直接调用内部逻辑
  const { createVideoSourceFromShareLink } = await import('../lib/douyin/video-source')
  const { VideoProcessor } = await import('../lib/video/video-processor')
  const { VideoToolkit302 } = await import('../lib/video/video-toolkit-302')
  const { DOUYIN_DEFAULT_HEADERS } = await import('../lib/douyin/constants')

  console.log('\n1️⃣ 解析分享链接...')
  const videoSource = await createVideoSourceFromShareLink(shareUrl)
  console.log('   标题:', videoSource.title)
  console.log('   作者:', videoSource.author)
  console.log('   时长:', videoSource.duration, '秒')
  console.log('   音频URL:', videoSource.audioUrl ? '有' : '无')
  console.log('   播放URL:', videoSource.playUrl ? '有' : '无')

  console.log('\n2️⃣ 测试302.AI视频工具提取音频...')
  let audioBuffer: Buffer
  let audioFormat: 'mp3' | 'aac' = 'mp3'

  try {
    const toolkit = new VideoToolkit302(apiKey)

    console.log('   提交音频提取任务...')
    const extractResult = await toolkit.extractAudio(videoSource.playUrl, {
      maxWait: 120000, // 2分钟超时
      onProgress: (message, percent) => {
        console.log(`   [${percent || 0}%] ${message}`)
      },
    })

    console.log('   ✅ 302.AI音频提取成功!')
    console.log('   任务ID:', extractResult.taskId)
    console.log('   音频URL:', extractResult.audioUrl)
    console.log('   耗时:', (extractResult.duration / 1000).toFixed(1), '秒')

    // 下载提取后的音频
    console.log('\n   下载提取的音频...')
    const audioResponse = await fetch(extractResult.audioUrl)
    if (!audioResponse.ok) {
      throw new Error(`下载失败: HTTP ${audioResponse.status}`)
    }

    audioBuffer = Buffer.from(await audioResponse.arrayBuffer())
    audioFormat = 'mp3' // 302.AI提取的是MP3
    console.log('   音频大小:', (audioBuffer.length / 1024 / 1024).toFixed(2), 'MB')

  } catch (err) {
    console.log('\n   ❌ 302.AI提取失败:', err instanceof Error ? err.message : err)
    console.log('\n   回退到音频直链方案...')

    // 回退方案：音频直链
    if (!videoSource.audioUrl) {
      throw new Error('无音频直链可用')
    }

    const audioResponse = await fetch(videoSource.audioUrl, {
      headers: DOUYIN_DEFAULT_HEADERS,
    })

    if (!audioResponse.ok) {
      throw new Error(`音频直链下载失败: HTTP ${audioResponse.status}`)
    }

    const rawAudioBuffer = Buffer.from(await audioResponse.arrayBuffer())
    console.log('   音频直链下载成功:', (rawAudioBuffer.length / 1024 / 1024).toFixed(2), 'MB')

    // 本地环境可以用FFmpeg转换
    console.log('   转换音频格式 (AAC → MP3)...')
    audioBuffer = await VideoProcessor.extractAudio(rawAudioBuffer, {
      format: 'mp3',
      sampleRate: 16000,
      channels: 1,
      bitrate: '128k',
    })
    console.log('   转换完成:', (audioBuffer.length / 1024 / 1024).toFixed(2), 'MB')
  }

  console.log('\n3️⃣ GPT-4o 转录...')
  const base64Audio = audioBuffer.toString('base64')

  const asrResponse = await fetch('https://api.302.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-audio-preview',
      modalities: ['text'],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `请转录这段音频的内容。注意：
1. 准确识别每个字词
2. 同音字结合上下文选择正确汉字
3. 专业术语使用规范写法
4. 只返回转录文字，不要说明`,
            },
            {
              type: 'input_audio',
              input_audio: {
                data: base64Audio,
                format: audioFormat,
              },
            },
          ],
        },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    }),
  })

  if (!asrResponse.ok) {
    const errorText = await asrResponse.text()
    throw new Error(`转录失败: ${asrResponse.status} - ${errorText}`)
  }

  const asrResult = await asrResponse.json()
  const transcribedText = asrResult.choices?.[0]?.message?.content || ''

  console.log('\n✅ 转录结果:')
  console.log('─'.repeat(50))
  console.log(transcribedText)
  console.log('─'.repeat(50))
  console.log(`字数: ${transcribedText.length}`)

  return transcribedText
}

async function downloadVideoAndExtractAudio(playUrl: string): Promise<Buffer> {
  const { VideoProcessor } = await import('../lib/video/video-processor')
  const { DOUYIN_DEFAULT_HEADERS } = await import('../lib/douyin/constants')

  console.log('   获取视频信息...')
  const videoInfo = await VideoProcessor.getVideoInfo(playUrl, {
    headers: DOUYIN_DEFAULT_HEADERS,
  })
  console.log('   视频大小:', (videoInfo.size / 1024 / 1024).toFixed(2), 'MB')

  console.log('   下载视频...')
  const downloadResult = await VideoProcessor.downloadVideo(playUrl, videoInfo, {
    headers: DOUYIN_DEFAULT_HEADERS,
    onProgress: (downloaded, total) => {
      if (total) {
        const percent = Math.floor((downloaded / total) * 100)
        process.stdout.write(`\r   下载进度: ${percent}%`)
      }
    },
  })
  console.log('\n   视频下载完成')

  console.log('   提取音频...')
  const audioBuffer = await VideoProcessor.extractAudio(downloadResult.buffer, {
    format: 'mp3',
    sampleRate: 16000,
    channels: 1,
    bitrate: '128k',
  })
  console.log('   音频提取完成:', (audioBuffer.length / 1024 / 1024).toFixed(2), 'MB')

  return audioBuffer
}

async function testProfileGeneration(merchantId: string) {
  console.log('\n\n📊 开始测试商家创作档案生成...')
  console.log('商家ID:', merchantId)

  // 获取商家信息
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: {
      contents: {
        where: { hasTranscript: true },
        take: 10,
        orderBy: { diggCount: 'desc' },
      },
    },
  })

  if (!merchant) {
    throw new Error('商家不存在')
  }

  console.log('商家名称:', merchant.name)
  console.log('有转录的视频数:', merchant.contents.length)

  if (merchant.contents.length < 3) {
    console.log('⚠️ 视频转录数量不足3个，建议先转录更多视频')
    return
  }

  // 调用档案生成API
  const apiKey = process.env.ZENMUX_API_KEY || process.env.LLM_API_KEY
  const apiBase = process.env.ZENMUX_API_BASE || 'https://zenmux.ai/api/v1'
  const model = process.env.ZENMUX_DEFAULT_MODEL || 'anthropic/claude-sonnet-4.5'

  // 构建提示词
  const transcripts = merchant.contents
    .filter(c => c.transcript)
    .map((c, i) => `【视频${i + 1}】${c.title}\n${c.transcript}`)
    .join('\n\n')

  console.log('\n生成创作档案中...')

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `你是一个抖音内容分析专家。根据商家的视频转录文本，生成一份创作档案(Brief)。

输出JSON格式：
{
  "intro": "一句话介绍商家定位",
  "sellingPoints": ["核心卖点1", "核心卖点2", "核心卖点3"],
  "usageScenarios": ["使用场景1", "使用场景2"],
  "audienceProfile": {
    "age": "目标年龄段",
    "gender": "目标性别",
    "interests": ["兴趣标签1", "兴趣标签2"],
    "behaviors": "消费行为特征"
  },
  "brandTone": "品牌语调描述",
  "contentStyle": "内容风格特点",
  "highFrequencyWords": ["高频词1", "高频词2", "高频词3"]
}`,
        },
        {
          role: 'user',
          content: `商家名称：${merchant.name}
商家描述：${merchant.description || '无'}
地区：${merchant.location || '未知'}

以下是该商家的视频转录文本：

${transcripts}

请分析以上内容，生成创作档案。`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`档案生成失败: ${response.status} - ${errorText}`)
  }

  const result = await response.json()
  const profileContent = result.choices?.[0]?.message?.content || ''

  console.log('\n✅ 创作档案:')
  console.log('─'.repeat(50))
  console.log(profileContent)
  console.log('─'.repeat(50))

  return profileContent
}

async function main() {
  console.log('🚀 本地测试脚本启动')
  console.log('='.repeat(50))
  console.log('商家:', TEST_MERCHANT_NAME)
  console.log('商家ID:', TEST_MERCHANT_ID)

  try {
    // 直接测试转录
    if (TEST_SHARE_LINK) {
      console.log('\n📹 使用分享链接测试转录...')
      await testTranscribe(TEST_SHARE_LINK)
    }

    // 测试档案生成（需要数据库连接）
    try {
      console.log('\n📊 测试创作档案生成...')
      await testProfileGeneration(TEST_MERCHANT_ID)
    } catch (dbError) {
      console.log('⚠️ 数据库连接失败，跳过档案生成测试')
      console.log('   错误:', dbError instanceof Error ? dbError.message : dbError)
    }
  } catch (error) {
    console.error('\n❌ 测试失败:', error)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main()
