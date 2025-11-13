/**
 * 测试 LLM 优化调试日志
 *
 * 用途：验证新添加的调试日志是否能正确输出 ZenMux API 的响应格式
 *
 * 运行：npx tsx scripts/test-llm-debug.ts [抖音分享链接]
 */

import { runDouyinPipeline } from '@/lib/douyin/pipeline'
import type { DouyinPipelineEvent } from '@/lib/douyin/pipeline'

async function main() {
  console.log('=== 测试 LLM 优化调试日志 ===\n')

  // 使用命令行参数或环境变量提供的测试视频
  const TEST_VIDEO_URL = process.argv[2] || process.env.TEST_VIDEO_URL || 'https://v.douyin.com/dn2WTcNpnRA/'

  console.log('📹 测试视频:', TEST_VIDEO_URL)
  console.log('🔍 关注以下调试日志输出：')
  console.log('  - [Pipeline] 原始SSE数据')
  console.log('  - [Pipeline] 解析后的data对象')
  console.log('  - [Pipeline] delta提取结果')
  console.log()

  try {
    const result = await runDouyinPipeline(
      TEST_VIDEO_URL,
      async (event: DouyinPipelineEvent) => {
        switch (event.type) {
          case 'progress':
            // 只显示优化和转录相关的进度
            if (event.step === 'optimize' || event.step === 'transcribe-audio') {
              console.log(`\n[事件] ${event.label}: ${event.status}`)
              if (event.detail) {
                console.log(`  详情: ${event.detail}`)
              }
            }
            break

          case 'info':
            console.log('\n[视频信息]')
            console.log('  标题:', event.videoInfo.title)
            console.log('  作者:', event.videoInfo.author)
            console.log('  时长:', event.videoInfo.duration.toFixed(1), '秒')
            break

          case 'partial':
            // 不输出partial事件，避免干扰调试日志
            break

          case 'done':
            console.log('\n✅ [完成] 处理成功')
            break

          case 'error':
            console.error('\n❌ [错误]', event.message)
            if (event.step) {
              console.error('  失败步骤:', event.step)
            }
            break
        }
      }
    )

    console.log('\n\n=== 最终结果 ===')
    console.log('✅ 转录文本长度:', result.transcript.length, '字符')
    console.log('\n📝 转录文本预览（前200字）:')
    console.log(result.transcript.substring(0, 200))
    console.log('\n\n💡 请检查上方的调试日志，特别是：')
    console.log('  1. [Pipeline] 解析后的data对象 - 查看 ZenMux API 的响应结构')
    console.log('  2. [Pipeline] delta提取结果 - 查看是否成功提取内容')
    console.log('  3. [Pipeline] 有效delta数量 - 应该 > 0')
    console.log('  4. [Pipeline] 优化文本最终长度 - 应该 > 0')

  } catch (error: any) {
    console.error('\n❌ 测试失败')
    console.error('错误:', error.message)
    if (error.step) {
      console.error('失败步骤:', error.step)
    }
    if (error.cause) {
      console.error('原因:', error.cause)
    }
    process.exit(1)
  }
}

main()
