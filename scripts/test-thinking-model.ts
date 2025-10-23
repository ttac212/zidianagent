/**
 * 快速测试 claude-sonnet-4-5-20250929-thinking 模型
 */
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

async function testThinkingModel() {
  const modelId = 'claude-sonnet-4-5-20250929-thinking'
  const apiKey = process.env.LLM_CLAUDE_SONNET_4_5_THINKING_KEY ||
                 process.env.LLM_CLAUDE_API_KEY ||
                 process.env.LLM_API_KEY
  const apiBase = process.env.LLM_API_BASE || 'https://api.302.ai/v1'

  console.log(`\n🧪 测试模型: ${modelId}`)
  console.log('─'.repeat(60))

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'user', content: '1+1等于多少？只需回答数字。' }
        ],
        max_tokens: 50,
        stream: false
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    console.log(`状态码: ${response.status} ${response.statusText}`)

    if (response.ok) {
      const data = await response.json()
      console.log('\n✅ 模型可用！')
      console.log('\n回复内容:', data.choices?.[0]?.message?.content || '无内容')

      if (data.usage) {
        console.log('\nToken使用:')
        console.log(`  Prompt: ${data.usage.prompt_tokens}`)
        console.log(`  Completion: ${data.usage.completion_tokens}`)
        console.log(`  Total: ${data.usage.total_tokens}`)
      }

      console.log('\n✅ 模型测试通过 - 可以正常使用')
      return true
    } else {
      const errorText = await response.text()
      console.log('\n❌ 模型不可用')
      console.log('错误:', errorText.substring(0, 200))
      return false
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.log('\n❌ 请求超时')
      } else {
        console.log('\n❌ 错误:', error.message)
      }
    }
    return false
  }
}

testThinkingModel().then(success => {
  console.log('\n' + '='.repeat(60))
  if (success) {
    console.log('🎉 测试结论: 模型可用，配置正确')
  } else {
    console.log('⚠️  测试结论: 模型不可用，需要检查')
  }
  process.exit(success ? 0 : 1)
}).catch(console.error)
