/**
 * 测试 Pipeline Whisper 回退方案
 *
 * 验证当音频直链不可用时，Pipeline 能够自动切换到视频+Whisper方案
 *
 * 使用方法:
 * npx tsx scripts/test-pipeline-whisper-fallback.ts
 */

import dotenv from 'dotenv'
import path from 'path'

// 加载环境变量
const envPath = path.resolve(process.cwd(), '.env.local')
dotenv.config({ path: envPath })

// 动态导入 Pipeline（避免环境变量问题）
async function main() {
  console.log('='.repeat(80))
  console.log('🧪 测试 Pipeline Whisper 回退方案')
  console.log('='.repeat(80))

  // 检查环境变量
  const asrApiKey = process.env.DOUBAO_ASR_API_KEY || process.env.LLM_API_KEY
  const tikhubApiKey = process.env.TIKHUB_API_KEY

  if (!asrApiKey) {
    console.error('❌ 错误: 未配置 ASR API Key')
    process.exit(1)
  }
  if (!tikhubApiKey) {
    console.error('❌ 错误: 未配置 TIKHUB_API_KEY')
    process.exit(1)
  }

  console.log('✅ 环境检查通过')
  console.log(`  ASR API Key: ${asrApiKey.substring(0, 20)}...`)
  console.log(`  TikHub API Key: ${tikhubApiKey.substring(0, 20)}...`)
  console.log()

  // 测试链接 - 这个视频在之前的测试中显示没有音频直链
  const testLink = `5.84 10/06 s@e.bA HvF:/ 你就说行不行！这福利够不够！ # 烧烤烤肉 # 围炉煮茶 # 烧烤炉  https://v.douyin.com/iirk2Mp8VBE/ 复制此链接，打开Dou音搜索，直接观看视频`

  try {
    // 动态导入 Pipeline
    const { runDouyinPipeline } = await import('../lib/douyin/pipeline')

    console.log('📋 开始执行 Pipeline...')
    console.log(`  测试链接: ${testLink.substring(0, 50)}...`)
    console.log()

    // 创建事件处理器
    const emit = async (event: any) => {
      switch (event.type) {
        case 'progress':
          const icon = event.status === 'completed' ? '✅' : '⏳'
          console.log(`${icon} [${event.step}] ${event.label} - ${event.detail || event.description}`)
          break
        case 'info':
          console.log(`📹 视频信息:`)
          console.log(`   标题: ${event.videoInfo.title}`)
          console.log(`   作者: ${event.videoInfo.author}`)
          console.log(`   时长: ${event.videoInfo.duration}秒`)
          break
        case 'partial':
          if (event.key === 'warn') {
            console.log(`⚠️  ${event.data}`)
          } else if (event.key === 'transcript') {
            // 转录内容，只显示前100个字符
            const preview = event.data.length > 100 ? event.data.substring(0, 100) + '...' : event.data
            console.log(`📝 转录片段: ${preview}`)
          }
          break
        case 'done':
          console.log(`\n✅ Pipeline 完成!`)
          console.log(`   转录长度: ${event.transcript.length} 字符`)
          break
        case 'error':
          console.error(`❌ 错误 [${event.step}]: ${event.message}`)
          break
      }
    }

    // 运行 Pipeline
    const result = await runDouyinPipeline(testLink, emit)

    console.log('\n' + '='.repeat(80))
    console.log('📊 最终结果')
    console.log('='.repeat(80))
    console.log(`\n标题: ${result.videoInfo.title}`)
    console.log(`作者: ${result.videoInfo.author}`)
    console.log(`\n--- 转录内容 ---\n`)
    console.log(result.transcript)
    console.log('\n--- 结束 ---')

    console.log('\n✅ 测试成功!')

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
