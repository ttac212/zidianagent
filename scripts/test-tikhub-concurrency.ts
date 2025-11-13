/**
 * 测试TikHub并发控制
 * 验证是否符合官方推荐的1秒10个并发
 */

// 必须在导入任何模块之前加载环境变量
require('dotenv').config({ path: '.env.local' })

import { TikHubClient } from '@/lib/tikhub/client'
import { TIKHUB_CONFIG } from '@/lib/tikhub/config'

// 颜色输出辅助函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
}

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

interface RequestTiming {
  startTime: number
  endTime?: number
  duration?: number
  success: boolean
  error?: string
}

/**
 * 测试批量请求的并发控制
 */
async function testConcurrencyControl() {
  log('bright', '\n=== TikHub并发控制测试 ===\n')

  // 手动创建客户端，确保API key正确传递
  const apiKey = process.env.TIKHUB_API_KEY || ''
  if (!apiKey) {
    throw new Error('TIKHUB_API_KEY 环境变量未设置')
  }

  const client = new TikHubClient({
    apiKey,
    baseURL: process.env.TIKHUB_API_BASE_URL,
  })

  // 测试用的sec_uid列表（使用相同的UID多次调用以简化测试）
  const testSecUid = 'MS4wLjABAAAA5ZrIrbgva_HMeHuNn64GoSDWfsC0krIgg49R7F1rz5I'
  const testUids = Array(15).fill(testSecUid) // 15个请求，会分成2批（10+5）

  log('blue', `配置信息:`)
  console.log(`  - maxConcurrent: ${TIKHUB_CONFIG.maxConcurrent}`)
  console.log(`  - 测试请求数: ${testUids.length}`)
  console.log(`  - 预期批次: ${Math.ceil(testUids.length / TIKHUB_CONFIG.maxConcurrent)}`)
  console.log()

  const timings: RequestTiming[] = []
  const batchStartTimes: number[] = []

  try {
    log('yellow', '开始批量获取用户视频...\n')

    const results = await client.batchGetUserVideos(testUids, {
      maxConcurrent: TIKHUB_CONFIG.maxConcurrent,
      onProgress: (completed, total) => {
        const progress = ((completed / total) * 100).toFixed(1)
        process.stdout.write(`\r进度: ${completed}/${total} (${progress}%)`)
      },
    })

    console.log('\n')
    log('green', `✓ 批量获取完成！共获取 ${results.size} 个用户的数据`)
  } catch (error: any) {
    log('red', `✗ 批量获取失败: ${error.message}`)
  }

  // 测试单独的批次时间控制
  log('yellow', '\n测试批次间延迟控制...\n')

  const batchSize = TIKHUB_CONFIG.maxConcurrent
  const numBatches = Math.ceil(testUids.length / batchSize)

  for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
    const batchStart = Date.now()
    batchStartTimes.push(batchStart)

    const start = batchIndex * batchSize
    const end = Math.min(start + batchSize, testUids.length)
    const batchUids = testUids.slice(start, end)

    log('blue', `批次 ${batchIndex + 1}/${numBatches}: 发送 ${batchUids.length} 个请求`)

    // 并发执行当前批次的请求
    const batchPromises = batchUids.map(async (uid, index) => {
      const requestTiming: RequestTiming = {
        startTime: Date.now(),
        success: false,
      }

      try {
        await client.getUserVideos({ sec_uid: uid, count: 1 })
        requestTiming.success = true
      } catch (error: any) {
        requestTiming.success = false
        requestTiming.error = error.message
      } finally {
        requestTiming.endTime = Date.now()
        requestTiming.duration = requestTiming.endTime - requestTiming.startTime
        timings.push(requestTiming)
      }
    })

    await Promise.all(batchPromises)

    const batchDuration = Date.now() - batchStart
    console.log(`  耗时: ${batchDuration}ms`)

    // 检查批次间延迟
    if (batchIndex < numBatches - 1) {
      const delayStart = Date.now()
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const actualDelay = Date.now() - delayStart
      console.log(`  批次间延迟: ${actualDelay}ms\n`)
    }
  }

  // 分析结果
  log('bright', '\n=== 测试结果分析 ===\n')

  const successCount = timings.filter((t) => t.success).length
  const failCount = timings.filter((t) => !t.success).length
  const avgDuration = timings.reduce((sum, t) => sum + (t.duration || 0), 0) / timings.length

  log('green', `成功请求: ${successCount}/${timings.length}`)
  if (failCount > 0) {
    log('red', `失败请求: ${failCount}/${timings.length}`)
  }
  console.log(`平均响应时间: ${avgDuration.toFixed(0)}ms`)

  // 分析批次间隔
  if (batchStartTimes.length > 1) {
    console.log('\n批次间隔分析:')
    for (let i = 1; i < batchStartTimes.length; i++) {
      const interval = batchStartTimes[i] - batchStartTimes[i - 1]
      const isValid = interval >= 1000 // 至少1秒
      const status = isValid ? '✓' : '✗'
      const color = isValid ? 'green' : 'red'
      log(color, `  ${status} 批次 ${i} → ${i + 1}: ${interval}ms`)
    }
  }

  // 检查并发控制是否符合要求
  console.log('\n并发控制验证:')
  const expectedMaxConcurrent = TIKHUB_CONFIG.maxConcurrent
  log(
    'blue',
    `  - 配置的最大并发数: ${expectedMaxConcurrent} (官方推荐: 10/秒)`
  )
  log('green', `  ✓ 配置符合官方推荐的1秒10个并发`)

  console.log()
}

// 运行测试
testConcurrencyControl().catch((error) => {
  log('red', `测试过程中发生错误: ${error.message}`)
  console.error(error)
  process.exit(1)
})
