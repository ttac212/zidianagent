/**
 * 测试 GPT-5.1 在 ZenMux 上的可用性
 */
import { config } from 'dotenv'
import { resolve } from 'path'

// 加载环境变量
config({ path: resolve(process.cwd(), '.env.local') })

async function testGPT51() {
  // 使用 ZenMux 配置
  const apiKey = process.env.ZENMUX_API_KEY
  const apiBase = process.env.ZENMUX_API_BASE || 'https://zenmux.ai/api/v1'
  const modelId = 'openai/gpt-5.1'

  console.log('\n🧪 测试 GPT-5.1 模型')
  console.log('═'.repeat(60))
  console.log(`API Base: ${apiBase}`)
  console.log(`Model ID: ${modelId}`)
  console.log(`API Key: ${apiKey ? '✅ 已配置' : '❌ 未配置'}`)
  console.log('═'.repeat(60))

  if (!apiKey) {
    console.error('\n❌ 错误: 未配置 ZENMUX_API_KEY')
    console.log('请在 .env.local 中添加: ZENMUX_API_KEY=<你的Key>')
    process.exit(1)
  }

  try {
    console.log('\n📤 发送测试请求...')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超时

    const requestBody = {
      model: modelId,
      messages: [
        {
          role: 'user',
          content: '你是什么模型？请简单介绍一下你的能力。'
        }
      ],
      max_tokens: 200,
      stream: false
    }

    console.log('\n请求体:')
    console.log(JSON.stringify(requestBody, null, 2))

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    console.log(`\n📥 响应状态: ${response.status} ${response.statusText}`)

    const responseText = await response.text()

    if (response.ok) {
      const data = JSON.parse(responseText)
      console.log('\n✅ GPT-5.1 可用！')
      console.log('\n💬 回复内容:')
      console.log('─'.repeat(60))
      console.log(data.choices?.[0]?.message?.content || '无内容')
      console.log('─'.repeat(60))

      if (data.usage) {
        console.log('\n📊 Token使用情况:')
        console.log(`  • Prompt tokens: ${data.usage.prompt_tokens}`)
        console.log(`  • Completion tokens: ${data.usage.completion_tokens}`)
        console.log(`  • Total tokens: ${data.usage.total_tokens}`)
      }

      if (data.model) {
        console.log(`\n🏷️  实际使用的模型: ${data.model}`)
      }

      console.log('\n✅ 结论: ZenMux 支持 openai/gpt-5.1')
      console.log('你可以将其添加到 MODEL_ALLOWLIST 中使用')

    } else {
      console.log('\n❌ GPT-5.1 不可用')
      console.log('\n错误响应:')
      console.log('─'.repeat(60))
      console.log(responseText)
      console.log('─'.repeat(60))

      try {
        const errorJson = JSON.parse(responseText)
        if (errorJson.error) {
          console.log('\n📋 错误详情:')
          console.log(`  • 类型: ${errorJson.error.type || 'unknown'}`)
          console.log(`  • 消息: ${errorJson.error.message || errorJson.error}`)
          console.log(`  • 代码: ${errorJson.error.code || 'N/A'}`)
        }
      } catch {
        // 不是JSON格式的错误
      }

      console.log('\n💡 可能的原因:')
      console.log('  1. ZenMux 不支持 openai/gpt-5.1 模型')
      console.log('  2. 模型ID格式错误（尝试其他格式如 gpt-5.1）')
      console.log('  3. API Key 权限不足')
      console.log('  4. ZenMux 暂未更新支持 GPT-5.1')

      console.log('\n🔍 建议:')
      console.log('  • 查看 ZenMux 控制台的可用模型列表')
      console.log('  • 尝试访问: https://zenmux.ai/models')
      console.log('  • 或使用 302.AI 作为 GPT-5.1 的备选提供商')
    }

  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.log('\n❌ 请求超时 (>30秒)')
      } else {
        console.log('\n❌ 网络错误:', error.message)
        console.log('完整错误:', error)
      }
    }
    process.exit(1)
  }
}

// 同时测试其他可能的模型ID格式
async function testAlternativeFormats() {
  console.log('\n\n🔄 测试其他可能的模型ID格式')
  console.log('═'.repeat(60))

  const apiKey = process.env.ZENMUX_API_KEY
  const apiBase = process.env.ZENMUX_API_BASE || 'https://zenmux.ai/api/v1'

  const alternativeIds = [
    'gpt-5.1',              // 不带前缀
    'openai/gpt-5-1',       // 使用连字符
    'gpt-5.1-turbo',        // 可能的变体
  ]

  for (const modelId of alternativeIds) {
    console.log(`\n测试: ${modelId}`)

    try {
      const response = await fetch(`${apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10
        })
      })

      if (response.ok) {
        console.log(`  ✅ ${modelId} 可用`)
      } else {
        const error = await response.text()
        console.log(`  ❌ ${modelId} 不可用: ${error.substring(0, 100)}`)
      }
    } catch (error) {
      console.log(`  ❌ ${modelId} 错误:`, error instanceof Error ? error.message : error)
    }

    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}

async function main() {
  console.log('\n🚀 GPT-5.1 可用性测试')
  console.log('═'.repeat(60))

  // 测试主要格式
  await testGPT51()

  // 测试其他格式
  await testAlternativeFormats()

  console.log('\n\n测试完成！')
}

main().catch(console.error)
