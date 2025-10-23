/**
 * 测试302.AI API Key有效性
 */
import { config } from 'dotenv'
import { resolve } from 'path'

// 加载环境变量
config({ path: resolve(process.cwd(), '.env.local') })

async function testApiKey() {
  const apiKey = process.env.LLM_API_KEY || process.env.LLM_CLAUDE_API_KEY
  const apiBase = process.env.LLM_API_BASE || 'https://api.302.ai/v1'

  if (!apiKey) {
    console.error('❌ 未找到API Key')
    return
  }

  console.log('测试302.AI API状态...\n')
  console.log('API Base:', apiBase)
  console.log('API Key:', `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`)
  console.log()

  // 测试多个模型
  const models = [
    'claude-3-5-haiku-20241022',
    'claude-3-5-sonnet-20241022',
    'gemini-2.5-pro'
  ]

  for (const model of models) {
    console.log(`\n测试模型: ${model}`)
    console.log('─'.repeat(50))

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
          model,
          messages: [{ role: 'user', content: 'Say hi in 3 words' }],
          max_tokens: 20,
          stream: false
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      console.log(`状态码: ${response.status} ${response.statusText}`)

      if (response.ok) {
        const data = await response.json()
        console.log('✅ 成功!')
        console.log('响应:', JSON.stringify(data.choices?.[0]?.message, null, 2))
      } else {
        const errorText = await response.text()
        console.log('❌ 失败')
        console.log('错误详情:', errorText.substring(0, 500))

        // 解析错误信息
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.error) {
            console.log('\n错误类型:', errorJson.error.type || 'unknown')
            console.log('错误消息:', errorJson.error.message || errorJson.error)
          }
        } catch {
          // 不是JSON格式的错误
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('❌ 请求超时 (>10秒)')
        } else {
          console.log('❌ 网络错误:', error.message)
        }
      }
    }
  }

  // 测试models端点
  console.log('\n\n测试 /models 端点')
  console.log('─'.repeat(50))
  try {
    const response = await fetch(`${apiBase}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      const modelCount = data.data?.length || 0
      console.log(`✅ 成功! 可用模型数量: ${modelCount}`)

      if (modelCount > 0 && modelCount < 10) {
        console.log('可用模型:')
        data.data.forEach((model: any) => {
          console.log(`  - ${model.id}`)
        })
      }
    } else {
      console.log(`❌ 失败: ${response.status} ${response.statusText}`)
    }
  } catch (error) {
    console.log('❌ 请求失败:', error instanceof Error ? error.message : error)
  }
}

testApiKey().catch(console.error)
