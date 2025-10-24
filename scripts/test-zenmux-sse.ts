/**
 * ZenMux SSE流式对话测试
 * 验证ZenMux是否支持Server-Sent Events流式响应
 */

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const ZENMUX_API_BASE = process.env.ZENMUX_API_BASE || 'https://zenmux.ai/api/v1'
const ZENMUX_API_KEY = process.env.ZENMUX_API_KEY || ''
const ZENMUX_MODEL = process.env.ZENMUX_DEFAULT_MODEL || 'anthropic/claude-sonnet-4.5'

interface StreamChunk {
  id?: string
  object?: string
  created?: number
  model?: string
  choices?: Array<{
    index: number
    delta: {
      role?: string
      content?: string
    }
    finish_reason?: string | null
  }>
}

/**
 * 解析SSE数据行
 * 支持两种格式：data: {} 和 data:{}
 */
function parseSSELine(line: string): StreamChunk | null {
  if (!line.startsWith('data:')) {
    return null
  }

  // 移除 'data:' 前缀（支持有无空格）
  const data = line.startsWith('data: ') ? line.slice(6) : line.slice(5)
  const trimmedData = data.trim()

  // [DONE] 标记表示流结束
  if (trimmedData === '[DONE]') {
    return null
  }

  try {
    return JSON.parse(trimmedData)
  } catch (e) {
    console.error('解析SSE数据失败:', trimmedData.slice(0, 100))
    return null
  }
}

/**
 * 测试流式对话
 */
async function testStreamingChat(
  messages: Array<{ role: string; content: string }>,
  testName: string
) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🧪 测试: ${testName}`)
  console.log(`${'='.repeat(80)}`)

  console.log(`\n📤 发送消息:`)
  messages.forEach((msg, i) => {
    console.log(`   [${i + 1}] ${msg.role}: ${msg.content}`)
  })

  const requestBody = {
    model: ZENMUX_MODEL,
    messages,
    stream: true,
    max_tokens: 1000,
    temperature: 0.7,
  }

  console.log(`\n📊 请求配置:`)
  console.log(`   端点: ${ZENMUX_API_BASE}/chat/completions`)
  console.log(`   模型: ${ZENMUX_MODEL}`)
  console.log(`   流式: true`)

  const startTime = Date.now()

  try {
    console.log(`\n⏳ 发送请求...`)

    const response = await fetch(`${ZENMUX_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ZENMUX_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    })

    console.log(`\n📥 响应状态: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.log(`❌ 请求失败: ${errorText}`)
      return {
        success: false,
        error: errorText,
      }
    }

    // 检查Content-Type
    const contentType = response.headers.get('content-type')
    console.log(`📋 Content-Type: ${contentType}`)

    if (!contentType?.includes('text/event-stream')) {
      console.log(`⚠️  警告: Content-Type不是text/event-stream`)
    }

    // 处理流式响应
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法获取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    let chunkCount = 0
    let firstChunkTime = 0

    console.log(`\n📨 接收流式响应:`)
    console.log(`${'─'.repeat(80)}`)

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue

        const chunk = parseSSELine(line)
        if (!chunk) {
          if (line === 'data: [DONE]') {
            console.log(`\n✅ 流结束标记: [DONE]`)
          }
          continue
        }

        chunkCount++

        if (chunkCount === 1) {
          firstChunkTime = Date.now() - startTime
          console.log(`⚡ 首个chunk延迟: ${firstChunkTime}ms`)
        }

        const delta = chunk.choices?.[0]?.delta
        if (delta?.content) {
          fullContent += delta.content
          // 实时显示接收到的内容
          process.stdout.write(delta.content)
        }

        if (chunk.choices?.[0]?.finish_reason) {
          console.log(`\n\n✅ 完成原因: ${chunk.choices[0].finish_reason}`)
        }
      }
    }

    const totalTime = Date.now() - startTime

    console.log(`\n${'─'.repeat(80)}`)
    console.log(`\n📊 统计信息:`)
    console.log(`   总耗时: ${(totalTime / 1000).toFixed(2)}秒`)
    console.log(`   首chunk延迟: ${firstChunkTime}ms`)
    console.log(`   chunk数量: ${chunkCount}`)
    console.log(`   内容长度: ${fullContent.length}字符`)
    console.log(`   平均速度: ${((fullContent.length / totalTime) * 1000).toFixed(1)} 字符/秒`)

    console.log(`\n📝 完整回复:`)
    console.log(`${'─'.repeat(80)}`)
    console.log(fullContent)
    console.log(`${'─'.repeat(80)}`)

    return {
      success: true,
      content: fullContent,
      stats: {
        totalTime,
        firstChunkTime,
        chunkCount,
        contentLength: fullContent.length,
        speed: (fullContent.length / totalTime) * 1000,
      },
    }
  } catch (error) {
    console.log(`\n❌ 测试失败: ${error}`)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * 主测试流程
 */
async function runSSETests() {
  console.log('🔬 ZenMux SSE流式对话测试\n')
  console.log(`📅 测试时间: ${new Date().toLocaleString('zh-CN')}`)
  console.log(`🌐 API端点: ${ZENMUX_API_BASE}`)
  console.log(`🤖 使用模型: ${ZENMUX_MODEL}`)

  if (!ZENMUX_API_KEY) {
    console.log('\n❌ 错误: 未配置ZENMUX_API_KEY')
    process.exit(1)
  }

  const results: any[] = []

  // 测试1：简单对话
  const test1 = await testStreamingChat(
    [
      {
        role: 'user',
        content: '你好，请用一句话介绍自己。',
      },
    ],
    '简单对话测试'
  )
  results.push({ name: '简单对话', ...test1 })

  await new Promise((resolve) => setTimeout(resolve, 2000))

  // 测试2：中文对话
  const test2 = await testStreamingChat(
    [
      {
        role: 'user',
        content: '请用100字左右介绍一下中国的传统节日春节。',
      },
    ],
    '中文长文本测试'
  )
  results.push({ name: '中文长文本', ...test2 })

  await new Promise((resolve) => setTimeout(resolve, 2000))

  // 测试3：多轮对话
  const test3 = await testStreamingChat(
    [
      {
        role: 'user',
        content: '什么是人工智能？',
      },
      {
        role: 'assistant',
        content: '人工智能是计算机科学的一个分支，旨在创建能够模拟人类智能的系统。',
      },
      {
        role: 'user',
        content: '它有哪些应用场景？请列举3个。',
      },
    ],
    '多轮对话测试'
  )
  results.push({ name: '多轮对话', ...test3 })

  await new Promise((resolve) => setTimeout(resolve, 2000))

  // 测试4：代码生成
  const test4 = await testStreamingChat(
    [
      {
        role: 'user',
        content: '请写一个JavaScript函数，用于判断一个数字是否为质数。',
      },
    ],
    '代码生成测试'
  )
  results.push({ name: '代码生成', ...test4 })

  // 汇总报告
  console.log(`\n\n${'='.repeat(80)}`)
  console.log('📊 测试汇总报告')
  console.log(`${'='.repeat(80)}`)

  console.log(`\n测试结果:`)
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌'
    console.log(`\n${index + 1}. ${status} ${result.name}`)
    if (result.success) {
      console.log(`   - 耗时: ${(result.stats.totalTime / 1000).toFixed(2)}秒`)
      console.log(`   - 首chunk: ${result.stats.firstChunkTime}ms`)
      console.log(`   - chunk数: ${result.stats.chunkCount}`)
      console.log(`   - 长度: ${result.stats.contentLength}字符`)
      console.log(`   - 速度: ${result.stats.speed.toFixed(1)} 字符/秒`)
    } else {
      console.log(`   - 错误: ${result.error}`)
    }
  })

  const successCount = results.filter((r) => r.success).length
  const totalCount = results.length

  console.log(`\n${'─'.repeat(80)}`)
  console.log(`总测试: ${totalCount}`)
  console.log(`成功: ${successCount}`)
  console.log(`失败: ${totalCount - successCount}`)
  console.log(`成功率: ${((successCount / totalCount) * 100).toFixed(1)}%`)

  if (successCount === totalCount) {
    console.log(`\n🎉 所有测试通过！ZenMux SSE流式对话工作正常。`)
  } else {
    console.log(`\n⚠️  部分测试失败，请检查错误信息。`)
  }

  console.log(`\n💡 使用建议:`)
  console.log(`- ZenMux完全支持SSE流式对话`)
  console.log(`- 模型格式: ${ZENMUX_MODEL}`)
  console.log(`- 可直接集成到现有聊天系统`)
  console.log(`- 建议设置合理的timeout和错误重试机制`)
  console.log(`${'='.repeat(80)}`)
}

// 运行测试
runSSETests().catch(console.error)
