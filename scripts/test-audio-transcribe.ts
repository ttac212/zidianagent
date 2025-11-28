/**
 * 测试简化后的转录流程（仅音频直链方案）
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createVideoSourceFromShareLink } from '../lib/douyin/video-source'
import { DOUYIN_DEFAULT_HEADERS } from '../lib/douyin/constants'

async function test() {
  const shareLink = 'https://v.douyin.com/XOCowXqdNc0/'

  console.log('='.repeat(60))
  console.log('测试简化后的转录流程（仅音频直链方案）')
  console.log('='.repeat(60))
  console.log('')

  // 步骤1: 解析链接
  console.log('【步骤1】解析分享链接...')
  const videoSource = await createVideoSourceFromShareLink(shareLink)
  console.log('  标题:', videoSource.title)
  console.log('  作者:', videoSource.author)
  console.log('  时长:', videoSource.duration, '秒')
  console.log('  视频ID:', videoSource.videoId)
  console.log('  音频直链:', videoSource.audioUrl ? '有' : '无')
  console.log('')

  if (!videoSource.audioUrl) {
    console.log('❌ 未找到音频直链')
    return
  }

  // 步骤2: 下载音频
  console.log('【步骤2】下载音频...')
  const audioResponse = await fetch(videoSource.audioUrl, {
    headers: DOUYIN_DEFAULT_HEADERS,
  })

  if (!audioResponse.ok) {
    console.log('❌ 音频下载失败:', audioResponse.status)
    return
  }

  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())
  console.log('  文件大小:', (audioBuffer.length / 1024).toFixed(0), 'KB')
  console.log('')

  // 步骤3: ASR转录
  console.log('【步骤3】ASR转录（GPT-4o Audio Preview）...')
  const apiKey = process.env.LLM_API_KEY

  if (!apiKey) {
    console.log('❌ 未配置 LLM_API_KEY')
    return
  }

  const base64Audio = audioBuffer.toString('base64')

  const asrResponse = await fetch('https://api.302.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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
              text: '请转录这段音频的内容。只返回转录的文字，不要添加任何说明。',
            },
            {
              type: 'input_audio',
              input_audio: {
                data: base64Audio,
                format: 'mp3',
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
    console.log('❌ 转录失败:', asrResponse.status, errorText.substring(0, 500))
    return
  }

  const asrResult = await asrResponse.json()
  const transcribedText = asrResult.choices?.[0]?.message?.content || ''

  console.log('  转录文本长度:', transcribedText.length, '字')
  console.log('')
  console.log('='.repeat(60))
  console.log('【完整转录文本】')
  console.log('='.repeat(60))
  console.log(transcribedText)
  console.log('='.repeat(60))
}

test().catch(console.error)
