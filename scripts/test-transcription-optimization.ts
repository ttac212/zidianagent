/**
 * 测试抖音视频转录优化效果
 * 验证提示词是否能正确纠正"金姐→君姐"、"南京→南宁"等错误
 */

import dotenv from 'dotenv'
import path from 'path'

// 加载环境变量
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const SHARE_LINK = 'https://v.douyin.com/0z9V7X_WKkk/'
const API_ENDPOINT = 'http://localhost:3007/api/douyin/extract-text'

interface ProgressEvent {
  type: 'progress' | 'info' | 'done' | 'error'
  stage?: string
  message?: string
  percent?: number
  text?: string
  originalText?: string
  videoInfo?: {
    title: string
    author: string
  }
}

async function testTranscriptionOptimization() {
  console.log('🧪 开始测试抖音视频转录优化...\n')
  console.log(`📹 测试视频: ${SHARE_LINK}`)
  console.log(`🎯 期望结果: 转录文本中的"金姐"应被纠正为"君姐"，"南京"应被纠正为"南宁"\n`)
  console.log('─'.repeat(80))

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shareLink: SHARE_LINK,
      }),
    })

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let videoInfo: { title: string; author: string } | null = null
    let originalText = ''
    let optimizedText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue

        try {
          const data: ProgressEvent = JSON.parse(line.slice(6))

          switch (data.type) {
            case 'progress':
              process.stdout.write(`\r⏳ ${data.message || data.stage} ${data.percent ? `(${data.percent}%)` : ''}`)
              break

            case 'info':
              if (data.stage === 'analyzed' && data.videoInfo) {
                videoInfo = data.videoInfo
                console.log(`\n\n📊 视频信息:`)
                console.log(`   标题: ${videoInfo.title}`)
                console.log(`   作者: ${videoInfo.author}`)
              }
              break

            case 'done':
              console.log('\n\n✅ 转录完成!\n')
              originalText = data.originalText || ''
              optimizedText = data.text || ''
              break

            case 'error':
              console.error(`\n❌ 错误: ${data.message}`)
              break
          }
        } catch (e) {
          // 忽略JSON解析错误
        }
      }
    }

    console.log('─'.repeat(80))
    console.log('\n📝 原始转录文本 (GPT-4o Audio):')
    console.log('─'.repeat(80))
    console.log(originalText.slice(0, 500) + (originalText.length > 500 ? '...\n(已截断)' : ''))

    console.log('\n─'.repeat(80))
    console.log('✨ 优化后文本 (Claude Sonnet 4.5):')
    console.log('─'.repeat(80))
    console.log(optimizedText.slice(0, 500) + (optimizedText.length > 500 ? '...\n(已截断)' : ''))

    console.log('\n─'.repeat(80))
    console.log('🔍 纠错效果分析:')
    console.log('─'.repeat(80))

    // 检查关键词纠正
    const checks = [
      {
        name: '人名纠正',
        wrong: '金姐',
        correct: '君姐',
        inOriginal: originalText.includes('金姐'),
        inOptimized: optimizedText.includes('君姐'),
      },
      {
        name: '地名纠正',
        wrong: '南京',
        correct: '南宁',
        inOriginal: originalText.includes('南京'),
        inOptimized: optimizedText.includes('南宁'),
      },
    ]

    let allPassed = true

    checks.forEach((check) => {
      const originalCount = (originalText.match(new RegExp(check.wrong, 'g')) || []).length
      const optimizedCorrectCount = (optimizedText.match(new RegExp(check.correct, 'g')) || []).length
      const optimizedWrongCount = (optimizedText.match(new RegExp(check.wrong, 'g')) || []).length

      const passed = check.inOriginal && optimizedCorrectCount > 0 && optimizedWrongCount === 0

      console.log(`\n${passed ? '✅' : '❌'} ${check.name}:`)
      console.log(`   原始文本: "${check.wrong}" 出现 ${originalCount} 次`)
      console.log(`   优化文本: "${check.correct}" 出现 ${optimizedCorrectCount} 次, "${check.wrong}" 出现 ${optimizedWrongCount} 次`)

      if (!passed) {
        allPassed = false
        if (optimizedWrongCount > 0) {
          console.log(`   ⚠️  警告: 优化后仍存在错误词语 "${check.wrong}"`)
        }
        if (optimizedCorrectCount === 0) {
          console.log(`   ⚠️  警告: 优化后未出现正确词语 "${check.correct}"`)
        }
      }
    })

    console.log('\n─'.repeat(80))
    if (allPassed) {
      console.log('🎉 测试通过! 所有同音字错误均已成功纠正')
    } else {
      console.log('⚠️  测试失败! 部分同音字错误未能纠正，提示词需要进一步优化')
    }
    console.log('─'.repeat(80))

    // 保存测试结果
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const resultPath = path.join(process.cwd(), `reports/transcription-test-${timestamp}.json`)

    const result = {
      timestamp: new Date().toISOString(),
      shareLink: SHARE_LINK,
      videoInfo,
      originalText,
      optimizedText,
      checks: checks.map((c) => ({
        name: c.name,
        wrong: c.wrong,
        correct: c.correct,
        passed: c.inOriginal && optimizedText.includes(c.correct) && !optimizedText.includes(c.wrong),
      })),
      allPassed,
    }

    const fs = await import('fs/promises')
    await fs.mkdir(path.dirname(resultPath), { recursive: true })
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2))

    console.log(`\n💾 测试结果已保存到: ${resultPath}`)
  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  }
}

// 运行测试
testTranscriptionOptimization().catch(console.error)
