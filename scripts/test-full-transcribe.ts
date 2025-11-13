/**
 * 测试完整的视频转录流程（包括下载、提取音频、ASR转录）
 */

import { runDouyinPipeline } from '@/lib/douyin/pipeline'
import type { DouyinPipelineEvent } from '@/lib/douyin/pipeline'

async function main() {
  console.log('=== 测试完整视频转录流程 ===\n')

  const TEST_VIDEO_URL = 'https://v.douyin.com/dn2WTcNpnRA/'

  // 检查必需的环境变量
  const TIKHUB_API_KEY = process.env.TIKHUB_API_KEY
  const ASR_API_KEY = process.env.DOUBAO_ASR_API_KEY || process.env.LLM_API_KEY

  if (!TIKHUB_API_KEY) {
    console.error('❌ 缺少 TIKHUB_API_KEY 环境变量')
    process.exit(1)
  }

  if (!ASR_API_KEY) {
    console.error('❌ 缺少 DOUBAO_ASR_API_KEY 或 LLM_API_KEY 环境变量')
    process.exit(1)
  }

  console.log('✅ 环境变量检查通过')
  console.log('测试视频:', TEST_VIDEO_URL)
  console.log()

  let transcriptText = ''
  let optimizedText = ''
  let markdownText = ''

  try {
    const result = await runDouyinPipeline(
      TEST_VIDEO_URL,
      async (event: DouyinPipelineEvent) => {
        switch (event.type) {
          case 'progress':
            console.log(
              `[${event.percentage}%] ${event.label} - ${event.status === 'active' ? '进行中' : '完成'}${event.detail ? ': ' + event.detail : ''}`
            )
            break

          case 'info':
            console.log('\n=== 视频信息 ===')
            console.log('标题:', event.videoInfo.title)
            console.log('作者:', event.videoInfo.author)
            console.log('时长:', event.videoInfo.duration.toFixed(1), '秒')
            console.log('视频ID:', event.videoInfo.videoId)
            if (event.videoInfo.coverUrl) {
              console.log('封面:', event.videoInfo.coverUrl.substring(0, 80) + '...')
            }
            console.log()
            break

          case 'partial':
            if (event.key === 'transcript') {
              transcriptText += event.data
              // 实时显示转录进度
              if (transcriptText.length % 50 === 0) {
                process.stdout.write('.')
              }
            } else if (event.key === 'optimized') {
              optimizedText += event.data
            } else if (event.key === 'markdown') {
              markdownText += event.data
            } else if (event.key === 'warn') {
              console.log('\n⚠️', event.data)
            }
            break

          case 'done':
            console.log('\n\n✅ 转录完成！')
            break

          case 'error':
            console.error('\n❌ 错误:', event.message)
            if (event.step) {
              console.error('失败步骤:', event.step)
            }
            break
        }
      },
      {
        // 可以传入 AbortSignal 用于取消
        // signal: abortController.signal
      }
    )

    console.log('\n=== 转录结果 ===\n')
    console.log('原始转录文本:')
    console.log('-'.repeat(80))
    console.log(result.transcript)
    console.log('-'.repeat(80))
    console.log()

    console.log('完整Markdown输出:')
    console.log('-'.repeat(80))
    console.log(result.markdown)
    console.log('-'.repeat(80))
    console.log()

    console.log('=== 统计信息 ===')
    console.log('转录文本长度:', result.transcript.length, '字符')
    console.log('视频时长:', result.videoInfo.duration.toFixed(1), '秒')
    console.log('平均每秒字数:', (result.transcript.length / result.videoInfo.duration).toFixed(2))
    console.log()

    console.log('✅ 测试完成！')

  } catch (error: any) {
    console.error('\n❌ 转录失败')
    console.error('错误类型:', error.name)
    console.error('错误信息:', error.message)

    if (error.step) {
      console.error('失败步骤:', error.step)
    }

    if (error.cause) {
      console.error('底层错误:', error.cause)
    }

    if (error.stack) {
      console.error('\n完整堆栈:')
      console.error(error.stack)
    }

    // 显示已获取的部分结果
    if (transcriptText) {
      console.log('\n部分转录结果:')
      console.log('-'.repeat(80))
      console.log(transcriptText)
      console.log('-'.repeat(80))
    }

    process.exit(1)
  }
}

main()
