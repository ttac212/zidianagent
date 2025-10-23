/**
 * 测试特定模型的可用性
 */
import { config } from 'dotenv'
import { resolve } from 'path'

// 加载环境变量
config({ path: resolve(process.cwd(), '.env.local') })

async function testModel(modelId: string) {
  const apiKey = process.env.LLM_API_KEY || process.env.LLM_CLAUDE_API_KEY
  const apiBase = process.env.LLM_API_BASE || 'https://api.302.ai/v1'

  console.log(`\n测试模型: ${modelId}`)
  console.log('='.repeat(60))

  try {
    console.log('发送测试请求...')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'user', content: '请用一句话介绍自己' }
        ],
        max_tokens: 100,
        stream: false
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    console.log(`\n响应状态: ${response.status} ${response.statusText}`)

    if (response.ok) {
      const data = await response.json()
      console.log('\n✅ 模型可用！')
      console.log('\n回复内容:')
      console.log('─'.repeat(60))
      console.log(data.choices?.[0]?.message?.content || '无内容')
      console.log('─'.repeat(60))

      if (data.usage) {
        console.log('\nToken使用情况:')
        console.log(`  - Prompt tokens: ${data.usage.prompt_tokens}`)
        console.log(`  - Completion tokens: ${data.usage.completion_tokens}`)
        console.log(`  - Total tokens: ${data.usage.total_tokens}`)
      }

      return true
    } else {
      const errorText = await response.text()
      console.log('\n❌ 模型不可用')
      console.log('错误响应:', errorText.substring(0, 500))

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.error) {
          console.log('\n错误详情:')
          console.log(`  - 类型: ${errorJson.error.type || 'unknown'}`)
          console.log(`  - 消息: ${errorJson.error.message || errorJson.error}`)
        }
      } catch {
        // 不是JSON格式
      }

      return false
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.log('\n❌ 请求超时 (>15秒)')
      } else {
        console.log('\n❌ 网络错误:', error.message)
      }
    }
    return false
  }
}

async function main() {
  console.log('测试白名单中的模型')
  console.log('='.repeat(60))

  const models = [
    'claude-sonnet-4-5-20250929',
    'claude-sonnet-4-5-20250929-thinking',
    'claude-opus-4-1-20250805',
    'gemini-2.5-pro'
  ]

  const results: Record<string, boolean> = {}

  for (const model of models) {
    const available = await testModel(model)
    results[model] = available

    // 等待一下避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log('\n\n总结')
  console.log('='.repeat(60))
  console.log('模型可用性:')
  for (const [model, available] of Object.entries(results)) {
    const status = available ? '✅ 可用' : '❌ 不可用'
    console.log(`  ${status} - ${model}`)
  }

  // 推荐默认模型
  const availableModels = Object.entries(results)
    .filter(([_, available]) => available)
    .map(([model]) => model)

  if (availableModels.length > 0) {
    console.log(`\n推荐默认模型: ${availableModels[0]}`)
  } else {
    console.log('\n⚠️  警告: 没有可用的模型！')
  }
}

main().catch(console.error)
