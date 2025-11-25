/**
 * 完整测试：音频直链 → ASR转录
 *
 * 运行方式：
 * TIKHUB_API_KEY="xxx" LLM_API_KEY="xxx" npx tsx scripts/test-full-audio-transcribe.ts
 */

import { parseDouyinVideoShare } from '../lib/douyin/share-link'
import { fetchVideoDetail } from '../lib/douyin/steps/fetch-detail'
import { transcribeAudio } from '../lib/douyin/steps/transcribe'

const TEST_SHARE_TEXT = '4.84 J@i.PK 10/30 zGV:/ 分享6个超好用的衣柜黄金尺寸！ https://v.douyin.com/ovjKmsLYpn8/'

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║     完整测试：音频直链 → ASR转录                   ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  const apiKey = process.env.LLM_API_KEY || process.env.DOUBAO_ASR_API_KEY
  if (!apiKey) {
    console.error('❌ 请设置 LLM_API_KEY 环境变量')
    return
  }

  try {
    // 步骤1: 解析分享链接
    console.log('1️⃣  解析分享链接...')
    const parseResult = await parseDouyinVideoShare(TEST_SHARE_TEXT)
    console.log('   视频ID:', parseResult.videoId)

    if (!parseResult.videoId) {
      throw new Error('未能解析出视频ID')
    }

    // 步骤2: 获取视频详情
    console.log('\n2️⃣  获取视频详情...')
    const detailResult = await fetchVideoDetail({ videoId: parseResult.videoId })
    console.log('   标题:', detailResult.videoInfo.title)
    console.log('   作者:', detailResult.videoInfo.author)
    console.log('   时长:', detailResult.videoInfo.duration, '秒')

    if (!detailResult.audioUrl) {
      throw new Error('未找到音频直链')
    }
    console.log('   ✅ 发现音频直链')

    // 步骤3: 下载音频
    console.log('\n3️⃣  下载音频...')
    const audioResponse = await fetch(detailResult.audioUrl)
    if (!audioResponse.ok) {
      throw new Error(`下载音频失败: ${audioResponse.status}`)
    }
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())
    console.log('   下载完成，大小:', (audioBuffer.length / 1024).toFixed(2), 'KB')

    // 步骤4: ASR转录
    console.log('\n4️⃣  ASR转录中...')
    console.log('   （这可能需要1-2分钟）\n')

    let transcript = ''
    const result = await transcribeAudio(
      { audioBuffer },
      async (event: any) => {
        if (event.type === 'partial' && event.key === 'transcript') {
          process.stdout.write(event.data)
          transcript += event.data
        }
      },
      apiKey
    )

    console.log('\n\n' + '='.repeat(60))
    console.log('📝 完整转录结果:')
    console.log('='.repeat(60))
    console.log(result.transcript)
    console.log('='.repeat(60))

    console.log('\n🎉 测试完成！')
    console.log('   - 音频直链流程工作正常')
    console.log('   - ASR转录成功')
    console.log('   - 无需FFmpeg，可部署到Vercel')

  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message)
  }
}

main().catch(console.error)
