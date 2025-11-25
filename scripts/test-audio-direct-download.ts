/**
 * 测试新的音频直链流程
 * 验证跳过FFmpeg直接下载音频是否工作
 *
 * 运行方式：npx tsx scripts/test-audio-direct-download.ts
 */

import { parseDouyinVideoShare } from '../lib/douyin/share-link'
import { fetchVideoDetail } from '../lib/douyin/steps/fetch-detail'

// 测试分享链接
const TEST_SHARE_TEXT = '4.84 J@i.PK 10/30 zGV:/ 分享6个超好用的衣柜黄金尺寸！ 设计师都夸你是内行！# 全屋定制 # 衣柜设计 # 整理衣橱 # 中古风装修 # 床尾柜设计  https://v.douyin.com/ovjKmsLYpn8/ 复制此链接，打开Dou音搜索，直接观看视频！'

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║     测试音频直链流程（跳过FFmpeg）                 ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  try {
    // 步骤1: 解析分享链接
    console.log('1️⃣  解析分享链接...')
    const parseResult = await parseDouyinVideoShare(TEST_SHARE_TEXT)
    console.log('   视频ID:', parseResult.videoId)
    console.log('   解析后URL:', parseResult.resolvedUrl)
    console.log('')

    if (!parseResult.videoId) {
      throw new Error('未能解析出视频ID')
    }

    // 步骤2: 获取视频详情（包括音频URL）
    console.log('2️⃣  获取视频详情...')
    const detailResult = await fetchVideoDetail({ videoId: parseResult.videoId })
    console.log('   标题:', detailResult.videoInfo.title)
    console.log('   作者:', detailResult.videoInfo.author)
    console.log('   时长:', detailResult.videoInfo.duration, '秒')
    console.log('   视频URL:', detailResult.playUrl?.substring(0, 80) + '...')
    console.log('')

    // 检查音频URL
    if (detailResult.audioUrl) {
      console.log('✅ 发现音频直链!')
      console.log('   音频URL:', detailResult.audioUrl)
      console.log('')

      // 步骤3: 测试下载音频
      console.log('3️⃣  测试下载音频...')
      const audioResponse = await fetch(detailResult.audioUrl)

      if (!audioResponse.ok) {
        throw new Error(`下载音频失败: ${audioResponse.status}`)
      }

      const audioBuffer = await audioResponse.arrayBuffer()
      console.log('   下载成功!')
      console.log('   音频大小:', (audioBuffer.byteLength / 1024).toFixed(2), 'KB')
      console.log('   Content-Type:', audioResponse.headers.get('content-type'))
      console.log('')

      console.log('🎉 音频直链流程测试通过！')
      console.log('   - 无需FFmpeg')
      console.log('   - 可在Vercel部署')
      console.log('   - 音频文件可直接发送给ASR服务')

    } else {
      console.log('❌ 未找到音频直链')
      console.log('   将使用传统FFmpeg流程（仅本地环境支持）')
    }

  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message)
    if (error.cause) {
      console.error('   原因:', error.cause)
    }
  }
}

main().catch(console.error)
