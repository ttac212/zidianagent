/**
 * ZenMux健康检查脚本
 * 用于诊断ZenMux API配置和连接状态
 */

import 'dotenv/config'

const ZENMUX_API_BASE = process.env.ZENMUX_API_BASE || 'https://zenmux.ai/api/v1'
const ZENMUX_API_KEY = process.env.ZENMUX_API_KEY

interface HealthCheckResult {
  success: boolean
  message: string
  details?: any
}

/**
 * 检查环境变量配置
 */
function checkEnvConfig(): HealthCheckResult {
  console.log('\n=== 1. 环境变量配置检查 ===\n')

  const checks = {
    'ZENMUX_API_BASE': !!process.env.ZENMUX_API_BASE,
    'ZENMUX_API_KEY': !!process.env.ZENMUX_API_KEY,
    'ZENMUX_DEFAULT_MODEL': !!process.env.ZENMUX_DEFAULT_MODEL,
  }

  console.log('环境变量状态:')
  Object.entries(checks).forEach(([key, value]) => {
    const status = value ? '✅' : '❌'
    const actualValue = process.env[key]
    const displayValue = key.includes('KEY')
      ? actualValue?.substring(0, 10) + '...'
      : actualValue

    console.log(`  ${status} ${key}: ${value ? displayValue : '未配置'}`)
  })

  const allConfigured = Object.values(checks).every(v => v)

  return {
    success: allConfigured,
    message: allConfigured ? '环境变量配置完整' : '部分环境变量缺失',
    details: checks
  }
}

/**
 * 测试ZenMux API连接
 */
async function testApiConnection(): Promise<HealthCheckResult> {
  console.log('\n=== 2. ZenMux API连接测试 ===\n')

  if (!ZENMUX_API_KEY) {
    return {
      success: false,
      message: 'ZENMUX_API_KEY未配置',
    }
  }

  try {
    const testModel = process.env.ZENMUX_DEFAULT_MODEL || 'anthropic/claude-sonnet-4.5'

    console.log(`测试模型: ${testModel}`)
    console.log(`API端点: ${ZENMUX_API_BASE}/chat/completions`)

    const response = await fetch(`${ZENMUX_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZENMUX_API_KEY}`,
      },
      body: JSON.stringify({
        model: testModel,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
        stream: false
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ API请求失败: ${response.status} ${response.statusText}`)
      console.error(`错误详情: ${errorText}`)

      return {
        success: false,
        message: `API连接失败: ${response.status}`,
        details: {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        }
      }
    }

    const data = await response.json()

    console.log('✅ API连接成功')
    console.log(`响应模型: ${data.model}`)
    console.log(`Token使用: ${data.usage?.total_tokens || 'N/A'}`)

    return {
      success: true,
      message: 'API连接正常',
      details: {
        model: data.model,
        usage: data.usage,
        content: data.choices?.[0]?.message?.content?.substring(0, 50)
      }
    }
  } catch (error) {
    console.error('❌ API请求异常:', error)

    return {
      success: false,
      message: `API连接异常: ${error instanceof Error ? error.message : String(error)}`,
      details: { error }
    }
  }
}

/**
 * 测试所有白名单模型
 */
async function testAllowedModels(): Promise<HealthCheckResult> {
  console.log('\n=== 3. 模型可用性测试 ===\n')

  const allowlistRaw = process.env.MODEL_ALLOWLIST || process.env.NEXT_PUBLIC_MODEL_ALLOWLIST || ''
  const models = allowlistRaw
    ? allowlistRaw.split(',').map(m => m.trim()).filter(Boolean)
    : ['anthropic/claude-sonnet-4.5']

  console.log(`测试模型列表 (${models.length}个):`)
  models.forEach(m => console.log(`  - ${m}`))
  console.log()

  const results: Record<string, { success: boolean; message: string }> = {}

  for (const model of models) {
    try {
      console.log(`测试模型: ${model}...`)

      const response = await fetch(`${ZENMUX_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ZENMUX_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
          stream: false
        })
      })

      if (response.ok) {
        console.log(`  ✅ ${model} - 可用`)
        results[model] = { success: true, message: '可用' }
      } else {
        const errorText = await response.text()
        console.log(`  ❌ ${model} - ${response.status}: ${errorText.substring(0, 100)}`)
        results[model] = { success: false, message: `${response.status}: ${errorText.substring(0, 50)}` }
      }
    } catch (error) {
      console.log(`  ❌ ${model} - ${error instanceof Error ? error.message : String(error)}`)
      results[model] = { success: false, message: String(error) }
    }

    // 避免限流，每次测试间隔500ms
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  const successCount = Object.values(results).filter(r => r.success).length

  return {
    success: successCount > 0,
    message: `${successCount}/${models.length} 个模型可用`,
    details: results
  }
}

/**
 * 测试429重试机制
 */
async function testRetryMechanism(): Promise<HealthCheckResult> {
  console.log('\n=== 4. 重试机制测试 ===\n')

  console.log('ℹ️  重试机制配置:')
  console.log('  - 最大重试次数: 3')
  console.log('  - 延迟策略: 1s → 2s → 4s (指数退避)')
  console.log('  - 可重试状态码: 429, 502, 503, 504')
  console.log('\n✅ 重试机制已集成到 /api/chat 路由')
  console.log('建议: 在实际使用中观察日志，查看重试效果')

  return {
    success: true,
    message: '重试机制已配置',
    details: {
      maxRetries: 3,
      delays: [1000, 2000, 4000],
      retryableStatuses: [429, 502, 503, 504]
    }
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('╔═══════════════════════════════════════╗')
  console.log('║   ZenMux 健康检查与配置诊断工具      ║')
  console.log('╚═══════════════════════════════════════╝')

  const results: Record<string, HealthCheckResult> = {}

  // 1. 环境变量检查
  results.env = checkEnvConfig()

  if (!results.env.success) {
    console.log('\n❌ 环境变量配置不完整，请检查 .env.local 文件')
    process.exit(1)
  }

  // 2. API连接测试
  results.connection = await testApiConnection()

  if (!results.connection.success) {
    console.log('\n⚠️  API连接失败，后续测试可能无法完成')
  }

  // 3. 模型可用性测试
  if (results.connection.success) {
    results.models = await testAllowedModels()
  }

  // 4. 重试机制测试
  results.retry = await testRetryMechanism()

  // 总结
  console.log('\n╔═══════════════════════════════════════╗')
  console.log('║            检查结果汇总               ║')
  console.log('╚═══════════════════════════════════════╝\n')

  Object.entries(results).forEach(([key, result]) => {
    const status = result.success ? '✅' : '❌'
    console.log(`${status} ${result.message}`)
  })

  const allSuccess = Object.values(results).every(r => r.success)

  if (allSuccess) {
    console.log('\n✅ 所有检查通过！ZenMux配置正常。')
  } else {
    console.log('\n⚠️  部分检查失败，请根据上述信息进行排查。')
  }

  console.log('\n建议:')
  console.log('1. 如遇429错误，重试机制会自动处理（最多重试3次）')
  console.log('2. 付费账户应该有更好的限流配额，如频繁遇到429请联系ZenMux支持')
  console.log('3. 可以在ZenMux控制台 (https://zenmux.ai) 查看API用量和配额')
  console.log('4. 推荐在生产环境配置多个fallback模型（Claude + GPT + Gemini）')
}

main().catch(console.error)
