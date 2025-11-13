/**
 * 快速测试LLM优化功能（带详细日志）
 */

import { runDouyinPipeline } from '@/lib/douyin/pipeline'
import type { DouyinPipelineEvent } from '@/lib/douyin/pipeline'

async function main() {
  console.log('=== 测试带日志的LLM优化 ===\n')

  // 使用一个简短的测试视频
  const TEST_VIDEO_URL = process.argv[2] || process.env.TEST_VIDEO_URL || 'https://v.douyin.com/dn2WTcNpnRA/'

  console.log('测试视频:', TEST_VIDEO_URL)
  console.log()

  try {
    const result = await runDouyinPipeline(
      TEST_VIDEO_URL,
      async (event: DouyinPipelineEvent) => {
        switch (event.type) {
          case 'progress':
            if (event.step === 'optimize' || event.step === 'transcribe-audio') {
              console.log(`[进度] ${event.label}: ${event.status} - ${event.detail || ''}`)
            }
            break

          case 'info':
            console.log('\n[视频信息]')
            console.log('  标题:', event.videoInfo.title)
            console.log('  作者:', event.videoInfo.author)
            console.log('  时长:', event.videoInfo.duration.toFixed(1), '秒')
            console.log()
            break

          case 'done':
            console.log('\n[完成] 转录成功')
            break

          case 'error':
            console.error('\n[错误]', event.message)
            if (event.step) {
              console.error('失败步骤:', event.step)
            }
            break
        }
      }
    )

    console.log('\n=== 最终结果 ===')
    console.log('转录文本长度:', result.transcript.length, '字符')
    console.log('\n转录文本预览:')
    console.log(result.transcript.substring(0, 200))
    console.log('\n✅ 测试完成')

  } catch (error: any) {
    console.error('\n❌ 测试失败')
    console.error('错误:', error.message)
    if (error.step) {
      console.error('失败步骤:', error.step)
    }
    process.exit(1)
  }
}

main()
