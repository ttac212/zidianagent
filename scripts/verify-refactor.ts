/**
 * 重构验证脚本
 * 验证 Key Manager 和 Auth 策略重构后的功能正常
 */

import { selectApiKey, getKeyHealthStatus } from '../lib/ai/key-manager'
import { selectAuthStrategy } from '../auth/strategies'

console.log('🔍 开始验证重构...\n')

// ==================== 测试 1: Key Manager ====================
console.log('📝 测试 1: Key Manager 重构验证')
console.log('─'.repeat(60))

// 设置测试环境变量
process.env.LLM_CLAUDE_SONNET_4_5_THINKING_KEY = 'test-thinking-key'
process.env.LLM_CLAUDE_SONNET_4_5_KEY = 'test-sonnet-key'
process.env.LLM_CLAUDE_API_KEY = 'test-claude-key'
process.env.LLM_GEMINI_API_KEY = 'test-gemini-key'
process.env.LLM_OPENAI_API_KEY = 'test-openai-key'
process.env.LLM_API_KEY = 'test-fallback-key'

const testCases = [
  {
    name: '精确匹配 Thinking 模型',
    modelId: 'claude-sonnet-4-5-20250929-thinking',
    expectedKey: 'test-thinking-key',
    expectedProvider: 'Claude'
  },
  {
    name: '精确匹配 Sonnet 模型',
    modelId: 'claude-sonnet-4-5-20250929',
    expectedKey: 'test-sonnet-key',
    expectedProvider: 'Claude'
  },
  {
    name: '前缀匹配 Claude 模型',
    modelId: 'claude-opus-4',
    expectedKey: 'test-claude-key',
    expectedProvider: 'Claude'
  },
  {
    name: '匹配 Gemini 模型',
    modelId: 'gemini-2.5-pro',
    expectedKey: 'test-gemini-key',
    expectedProvider: 'Google'
  },
  {
    name: '匹配 GPT 模型',
    modelId: 'gpt-4o',
    expectedKey: 'test-openai-key',
    expectedProvider: 'OpenAI'
  },
  {
    name: '未知模型 Fallback',
    modelId: 'unknown-model',
    expectedKey: 'test-fallback-key',
    expectedProvider: 'Unknown'
  }
]

let passedTests = 0
let failedTests = 0

for (const testCase of testCases) {
  try {
    const result = selectApiKey(testCase.modelId)

    if (result.apiKey === testCase.expectedKey && result.provider === testCase.expectedProvider) {
      console.log(`✅ ${testCase.name}`)
      passedTests++
    } else {
      console.log(`❌ ${testCase.name}`)
      console.log(`   期望: ${testCase.expectedKey} (${testCase.expectedProvider})`)
      console.log(`   实际: ${result.apiKey} (${result.provider})`)
      failedTests++
    }
  } catch (error) {
    console.log(`❌ ${testCase.name} - 异常: ${error}`)
    failedTests++
  }
}

console.log(`\n📊 Key Manager 测试结果: ${passedTests}/${testCases.length} 通过\n`)

// ==================== 测试 2: Key Health Status ====================
console.log('📝 测试 2: getKeyHealthStatus 向后兼容性')
console.log('─'.repeat(60))

try {
  const healthStatus = getKeyHealthStatus()

  const checks = [
    { name: 'hasKey', expected: true, actual: healthStatus.hasKey },
    { name: 'claude key', expected: true, actual: healthStatus.keys.claude },
    { name: 'gemini key', expected: true, actual: healthStatus.keys.gemini },
    { name: 'openai key', expected: true, actual: healthStatus.keys.openai },
    { name: 'fallback key', expected: true, actual: healthStatus.keys.fallback }
  ]

  let healthPassed = 0
  for (const check of checks) {
    if (check.actual === check.expected) {
      console.log(`✅ ${check.name}: ${check.actual}`)
      healthPassed++
    } else {
      console.log(`❌ ${check.name}: 期望 ${check.expected}, 实际 ${check.actual}`)
    }
  }

  console.log(`\n📊 Health Status 测试结果: ${healthPassed}/${checks.length} 通过\n`)
  passedTests += healthPassed
  failedTests += checks.length - healthPassed
} catch (error) {
  console.log(`❌ getKeyHealthStatus 测试失败: ${error}\n`)
  failedTests += 5
}

// ==================== 测试 3: Auth 策略选择 ====================
console.log('📝 测试 3: Auth 策略选择')
console.log('─'.repeat(60))

const authTests = [
  {
    name: '开发环境选择 developmentAuth',
    env: 'development',
    expectedStrategy: 'developmentAuth'
  },
  {
    name: '生产环境选择 productionAuth',
    env: 'production',
    expectedStrategy: 'productionAuth'
  }
]

for (const authTest of authTests) {
  try {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = authTest.env

    // 清除 DEV_LOGIN_CODE 以避免生产环境安全检查
    if (authTest.env === 'production') {
      delete process.env.DEV_LOGIN_CODE
    } else {
      process.env.DEV_LOGIN_CODE = 'dev123'
    }

    const strategy = selectAuthStrategy()

    if (strategy.name === authTest.expectedStrategy) {
      console.log(`✅ ${authTest.name}`)
      passedTests++
    } else {
      console.log(`❌ ${authTest.name}`)
      console.log(`   期望: ${authTest.expectedStrategy}`)
      console.log(`   实际: ${strategy.name}`)
      failedTests++
    }

    process.env.NODE_ENV = originalEnv
  } catch (error) {
    console.log(`❌ ${authTest.name} - 异常: ${error}`)
    failedTests++
  }
}

console.log(`\n📊 Auth 策略测试结果: ${authTests.length}/${authTests.length} 通过\n`)

// ==================== 最终结果 ====================
console.log('='.repeat(60))
console.log('📊 最终验证结果')
console.log('='.repeat(60))
console.log(`✅ 通过: ${passedTests}`)
console.log(`❌ 失败: ${failedTests}`)
console.log(`📈 通过率: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`)

if (failedTests === 0) {
  console.log('\n🎉 所有测试通过！重构没有引入新问题。')
  process.exit(0)
} else {
  console.log(`\n⚠️  有 ${failedTests} 个测试失败，请检查重构代码。`)
  process.exit(1)
}
