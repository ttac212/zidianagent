/**
 * 诊断GPT-4o Audio转录问题
 */

import { parseDouyinVideoShare } from '@/lib/douyin/share-link'
import { getTikHubClient } from '@/lib/tikhub'
import { VideoProcessor } from '@/lib/video/video-processor'
import { DOUYIN_DEFAULT_HEADERS } from '@/lib/douyin/constants'
import { writeFileSync } from 'fs'
import { join } from 'path'

async function main() {
  console.log('=== 诊断ASR转录问题 ===\n')

  const TEST_VIDEO_URL = 'https://v.douyin.com/dn2WTcNpnRA/'
  const ASR_API_KEY = process.env.DOUBAO_ASR_API_KEY || process.env.LLM_API_KEY

  if (!ASR_API_KEY) {
    console.error('❌ 缺少ASR API密钥')
    process.exit(1)
  }

  try {
    // 步骤1: 解析链接
    console.log('步骤1: 解析链接...')
    const shareResult = await parseDouyinVideoShare(TEST_VIDEO_URL)
    console.log('✅ 视频ID:', shareResult.videoId)

    // 步骤2: 获取视频详情
    console.log('\n步骤2: 获取视频详情...')
    const client = getTikHubClient()
    const videoDetail = await client.getVideoDetail({
      aweme_id: shareResult.videoId!
    })
    const awemeDetail = videoDetail.aweme_detail
    console.log('✅ 标题:', awemeDetail.desc)
    console.log('时长:', awemeDetail.video.duration / 1000, '秒')

    // 步骤3: 使用正确的URL选择策略
    console.log('\n步骤3: 获取播放地址...')

    // 使用项目中的URL选择逻辑
    const resolvePlayableUrl = (video: any): string | null => {
      type Candidate = { url: string; priority: number }
      const candidates: Candidate[] = []

      const pushUrls = (urls: unknown, priority: number) => {
        if (!Array.isArray(urls)) return
        for (const rawUrl of urls) {
          if (typeof rawUrl !== 'string' || !rawUrl) continue
          const sanitized = rawUrl.includes('playwm')
            ? rawUrl.replace('playwm', 'play')
            : rawUrl
          candidates.push({ url: sanitized, priority })
        }
      }

      // 优先级策略
      const music = video?.music
      if (music) {
        pushUrls(music.play_url?.url_list, 0)
        pushUrls(music.play_url_lowbr?.url_list, 0)
      }

      pushUrls(video?.video?.play_addr_lowbr?.url_list, 1)

      if (Array.isArray(video?.video?.bit_rate)) {
        for (const item of video.video.bit_rate) {
          const bitrate = typeof item?.bit_rate === 'number' ? item.bit_rate : 0
          const dynamicPriority =
            bitrate > 0 ? Math.min(9, 2 + Math.round(bitrate / 1_000_000)) : 4
          pushUrls(item?.play_addr?.url_list, dynamicPriority)
        }
      }

      pushUrls(video?.video?.play_addr?.url_list, 8)
      pushUrls(video?.video?.download_addr?.url_list, 9)

      if (candidates.length === 0) return null

      // 去重并排序
      const bestByUrl = new Map<string, Candidate>()
      for (const candidate of candidates) {
        const existing = bestByUrl.get(candidate.url)
        if (!existing || candidate.priority < existing.priority) {
          bestByUrl.set(candidate.url, candidate)
        }
      }

      const ordered = Array.from(bestByUrl.values()).sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority
        }
        const aIsAweme = a.url.includes('aweme')
        const bIsAweme = b.url.includes('aweme')
        if (aIsAweme !== bIsAweme) {
          return aIsAweme ? -1 : 1
        }
        return a.url.length - b.url.length
      })

      return ordered[0]?.url ?? null
    }

    const videoUrl = resolvePlayableUrl(awemeDetail)
    if (!videoUrl) {
      console.error('❌ 无法获取可用的播放地址')
      process.exit(1)
    }
    console.log('使用URL:', videoUrl.substring(0, 100) + '...')
    console.log('URL类型:', videoUrl.includes('aweme') ? 'aweme域名' : '其他域名')

    // 步骤4: 下载视频
    console.log('\n步骤4: 下载视频...')
    const videoInfo = await VideoProcessor.getVideoInfo(videoUrl, {
      headers: DOUYIN_DEFAULT_HEADERS
    })
    console.log('视频大小:', (videoInfo.size / 1024 / 1024).toFixed(2), 'MB')

    const downloadResult = await VideoProcessor.downloadVideo(videoUrl, videoInfo, {
      headers: DOUYIN_DEFAULT_HEADERS,
      onProgress: (downloaded, total) => {
        const percent = Math.floor((downloaded / total) * 100)
        if (percent % 20 === 0) {
          process.stdout.write(`${percent}% `)
        }
      }
    })
    console.log('\n✅ 下载完成，大小:', (downloadResult.buffer.length / 1024 / 1024).toFixed(2), 'MB')

    // 步骤5: 提取音频
    console.log('\n步骤5: 提取音频...')
    const audioBuffer = await VideoProcessor.extractAudio(downloadResult.buffer, {
      format: 'mp3',
      sampleRate: 16000,
      channels: 1,
      bitrate: '128k'
    })
    console.log('✅ 音频大小:', (audioBuffer.length / 1024 / 1024).toFixed(2), 'MB')

    // 保存音频文件用于检查
    const audioPath = join(process.cwd(), 'temp-audio.mp3')
    writeFileSync(audioPath, audioBuffer)
    console.log('音频已保存到:', audioPath)

    // 步骤6: 检查音频内容
    console.log('\n步骤6: 检查音频文件...')
    console.log('音频采样率: 16000 Hz')
    console.log('声道数: 1 (单声道)')
    console.log('比特率: 128 kbps')
    console.log('音频时长约:', Math.round((audioBuffer.length * 8) / (128 * 1000)), '秒')

    // 步骤7: 测试ASR API
    console.log('\n步骤7: 测试GPT-4o Audio API...')
    const base64Audio = audioBuffer.toString('base64')
    console.log('Base64编码后大小:', (base64Audio.length / 1024 / 1024).toFixed(2), 'MB')

    console.log('\n发送ASR请求...')
    const asrResponse = await fetch('https://api.302.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ASR_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-audio-preview',
        modalities: ['text'],
        max_tokens: 4000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '请转录这段音频的内容，输出完整的中文文本。'
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
      })
    })

    console.log('HTTP状态码:', asrResponse.status)
    console.log('响应头:', Object.fromEntries(asrResponse.headers.entries()))

    if (!asrResponse.ok) {
      const errorText = await asrResponse.text()
      console.error('❌ ASR请求失败')
      console.error('状态码:', asrResponse.status)
      console.error('错误信息:', errorText)
      process.exit(1)
    }

    const asrResult = await asrResponse.json()
    console.log('\n=== ASR响应 ===')
    console.log(JSON.stringify(asrResult, null, 2))

    const transcribedText = asrResult.choices?.[0]?.message?.content || ''
    console.log('\n=== 转录文本 ===')
    console.log(transcribedText)
    console.log('\n文本长度:', transcribedText.length, '字符')

    // 分析问题
    console.log('\n=== 问题分析 ===')
    if (transcribedText.includes('无法完成') || transcribedText.includes('对不起')) {
      console.log('❌ GPT-4o拒绝转录')
      console.log('可能原因:')
      console.log('1. 视频内容包含背景音乐但没有人声')
      console.log('2. 音频质量太差无法识别')
      console.log('3. 音频内容违反了GPT-4o的使用政策')
      console.log('4. 音频格式或编码有问题')
      console.log('\n建议:')
      console.log('1. 检查原视频是否有人声配音')
      console.log('2. 尝试使用其他ASR服务（如Whisper）')
      console.log('3. 检查音频文件是否正常播放: temp-audio.mp3')
    } else if (transcribedText.length < 10) {
      console.log('⚠️  转录文本太短')
      console.log('可能是视频主要是音乐，没有语音内容')
    } else {
      console.log('✅ 转录成功!')
    }

  } catch (error: any) {
    console.error('\n❌ 诊断过程出错')
    console.error('错误:', error.message)
    console.error('堆栈:', error.stack)
    process.exit(1)
  }
}

main()
