/**
 * 测试 ZenMux 流式 API 响应格式
 * 用于调试评论分析功能的流式响应解析问题
 */

// 加载环境变量
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const ZENMUX_API_BASE = process.env.ZENMUX_API_BASE || 'https://zenmux.ai/api/v1'
const ZENMUX_API_KEY = process.env.ZENMUX_API_KEY || ''
const ZENMUX_MODEL = process.env.ZENMUX_DEFAULT_MODEL || 'anthropic/claude-sonnet-4.5'

async function testZenMuxStream() {
  console.log('🧪 测试 ZenMux 流式 API 响应格式\n')
  console.log(`API Base: ${ZENMUX_API_BASE}`)
  console.log(`Model: ${ZENMUX_MODEL}`)
  console.log(`API Key: ${ZENMUX_API_KEY ? '✅ 已配置' : '❌ 未配置'}\n`)

  if (!ZENMUX_API_KEY) {
    console.error('❌ 错误: 未配置 ZENMUX_API_KEY')
    process.exit(1)
  }

  try {
    const response = await fetch(`${ZENMUX_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZENMUX_API_KEY}`
      },
      body: JSON.stringify({
        model: ZENMUX_MODEL,
        messages: [
          {
            role: 'user',
            content: '请用一句话介绍一下你自己。'
          }
        ],
        max_tokens: 100,
        temperature: 0.7,
        stream: true
      })
    })

    console.log(`📡 响应状态: ${response.status} ${response.statusText}`)
    console.log(`📋 Content-Type: ${response.headers.get('content-type')}\n`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API 错误:', errorText)
      process.exit(1)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      console.error('❌ 无法获取响应流')
      process.exit(1)
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let chunkCount = 0
    let fullText = ''

    console.log('📦 开始接收流式数据...\n')
    console.log('=' .repeat(60))

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        console.log('\n' + '='.repeat(60))
        console.log('✅ 流式响应接收完成')
        break
      }

      chunkCount++
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) {
          console.log(`[Chunk ${chunkCount}] (空行)`)
          continue
        }

        if (line.trim() === 'data: [DONE]') {
          console.log(`[Chunk ${chunkCount}] data: [DONE]`)
          continue
        }

        console.log(`\n[Chunk ${chunkCount}] 原始数据:`)
        console.log(line)

        // ZenMux 使用 "data:" 而不是 "data: " (注意没有空格)
        if (line.startsWith('data:')) {
          try {
            // 移除 "data:" 前缀（可能有或没有空格）
            const jsonStr = line.startsWith('data: ') ? line.slice(6) : line.slice(5)
            const data = JSON.parse(jsonStr)

            console.log(`[Chunk ${chunkCount}] 解析后的 JSON:`)
            console.log(JSON.stringify(data, null, 2))

            // 检查不同的可能字段
            const delta = data.choices?.[0]?.delta?.content
            const message = data.choices?.[0]?.message?.content
            const text = data.choices?.[0]?.text

            if (delta) {
              fullText += delta
              console.log(`[Chunk ${chunkCount}] ✅ 找到 delta.content: "${delta}"`)
            } else if (message) {
              fullText += message
              console.log(`[Chunk ${chunkCount}] ✅ 找到 message.content: "${message}"`)
            } else if (text) {
              fullText += text
              console.log(`[Chunk ${chunkCount}] ✅ 找到 text: "${text}"`)
            } else {
              console.log(`[Chunk ${chunkCount}] ⚠️ 未找到内容字段`)
              console.log(`[Chunk ${chunkCount}] choices[0]:`, JSON.stringify(data.choices?.[0], null, 2))
            }
          } catch (error) {
            console.log(`[Chunk ${chunkCount}] ❌ JSON 解析失败:`, error)
          }
        } else {
          console.log(`[Chunk ${chunkCount}] ⚠️ 不是 SSE 格式 (不以 "data: " 开头)`)
        }
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 统计信息:')
    console.log(`  - 总 Chunk 数: ${chunkCount}`)
    console.log(`  - 完整文本长度: ${fullText.length}`)
    console.log(`  - 完整文本: ${fullText ? '✅ 有内容' : '❌ 为空'}`)
    console.log('\n完整文本:')
    console.log('─'.repeat(60))
    console.log(fullText || '(空)')
    console.log('─'.repeat(60))

    if (!fullText) {
      console.error('\n❌ 错误: 未能从流中提取任何文本内容')
      process.exit(1)
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  }
}

testZenMuxStream()
