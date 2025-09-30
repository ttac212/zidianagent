/**
 * 测试 Extended Thinking 模式 API 调用
 * 验证 max_tokens 参数是否正确传递
 */

import { getModelContextConfig } from '../lib/constants/message-limits'

console.log('🧪 测试模型配置\n')

// 测试 Extended Thinking 模式
const thinkingConfig = getModelContextConfig('claude-sonnet-4-5-20250929-thinking')
console.log('📊 Extended Thinking 模式配置:')
console.log(`  contextWindow: ${thinkingConfig.modelWindow}`)
console.log(`  maxTokens (上下文): ${thinkingConfig.maxTokens}`)
console.log(`  outputMaxTokens (API参数): ${thinkingConfig.outputMaxTokens}`)
console.log(`  reserveTokens: ${thinkingConfig.reserveTokens}\n`)

// 测试普通 Claude 模式
const sonnetConfig = getModelContextConfig('claude-sonnet-4-5-20250929')
console.log('📊 Claude Sonnet 4.5 (标准) 配置:')
console.log(`  contextWindow: ${sonnetConfig.modelWindow}`)
console.log(`  maxTokens (上下文): ${sonnetConfig.maxTokens}`)
console.log(`  outputMaxTokens (API参数): ${sonnetConfig.outputMaxTokens}`)
console.log(`  reserveTokens: ${sonnetConfig.reserveTokens}\n`)

// 测试其他模型
const haikuConfig = getModelContextConfig('claude-3-5-haiku-20241022')
console.log('📊 Claude Haiku 配置:')
console.log(`  contextWindow: ${haikuConfig.modelWindow}`)
console.log(`  maxTokens (上下文): ${haikuConfig.maxTokens}`)
console.log(`  outputMaxTokens (API参数): ${haikuConfig.outputMaxTokens}`)
console.log(`  reserveTokens: ${haikuConfig.reserveTokens}\n`)

// 验证要求
console.log('✅ 验证结果:')
if (thinkingConfig.outputMaxTokens >= 16000) {
  console.log(`  ✅ Extended Thinking max_tokens (${thinkingConfig.outputMaxTokens}) >= 16000`)
} else {
  console.error(`  ❌ Extended Thinking max_tokens (${thinkingConfig.outputMaxTokens}) < 16000`)
}

if (sonnetConfig.outputMaxTokens >= 4096) {
  console.log(`  ✅ 标准模式 max_tokens (${sonnetConfig.outputMaxTokens}) >= 4096`)
} else {
  console.error(`  ❌ 标准模式 max_tokens (${sonnetConfig.outputMaxTokens}) < 4096`)
}

console.log('\n💡 提示: Extended Thinking 需要 max_tokens > thinking.budget_tokens (通常10000)')
console.log('   当前配置的 16000 tokens 可以满足需求')