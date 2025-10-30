/**
 * 验证ZenMux配置脚本
 * 用途：检查ZenMux是否正确配置为主提供商
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// 加载 .env.local 文件
config({ path: resolve(process.cwd(), '.env.local') })

import { getLLMProviders, selectProvider, getProviderHealthStatus } from '../lib/ai/provider-manager'
import { ALLOWED_MODELS, DEFAULT_MODEL } from '../lib/ai/models'

console.log('='.repeat(60))
console.log('ZenMux配置验证报告')
console.log('='.repeat(60))

// 1. 检查环境变量
console.log('\n📋 环境变量配置:')
console.log(`  ZENMUX_API_BASE: ${process.env.ZENMUX_API_BASE || '❌ 未配置'}`)
console.log(`  ZENMUX_API_KEY: ${process.env.ZENMUX_API_KEY ? '✅ 已配置' : '❌ 未配置'}`)
console.log(`  ZENMUX_DEFAULT_MODEL: ${process.env.ZENMUX_DEFAULT_MODEL || '❌ 未配置'}`)
console.log(`  LLM_API_BASE (302.AI): ${process.env.LLM_API_BASE || '❌ 未配置'}`)
console.log(`  LLM_API_KEY (302.AI): ${process.env.LLM_API_KEY ? '✅ 已配置' : '❌ 未配置'}`)

// 2. 检查提供商列表
console.log('\n🔌 可用提供商列表:')
const providers = getLLMProviders()
providers.forEach((p, index) => {
  console.log(`  ${index + 1}. ${p.name}`)
  console.log(`     - 优先级: ${p.priority}`)
  console.log(`     - 状态: ${p.enabled ? '✅ 启用' : '❌ 禁用'}`)
  console.log(`     - API Base: ${p.baseURL}`)
  console.log(`     - API Key: ${p.apiKey ? '✅ 已配置' : '❌ 未配置'}`)
})

// 3. 检查模型白名单
console.log('\n📜 模型白名单 (MODEL_ALLOWLIST):')
ALLOWED_MODELS.forEach((m, index) => {
  console.log(`  ${index + 1}. ${m.id}`)
  console.log(`     - 显示名称: ${m.name}`)
  console.log(`     - 提供商: ${m.capabilities.provider}`)
  console.log(`     - 支持推理: ${m.capabilities.supportsReasoning ? '✅ 是' : '❌ 否'}`)
})

// 4. 测试模型选择逻辑
console.log('\n🎯 模型选择逻辑测试:')
const testModel = DEFAULT_MODEL
console.log(`  测试模型: ${testModel}`)
const selectedProvider = selectProvider(testModel)
if (selectedProvider) {
  console.log(`  ✅ 选中提供商: ${selectedProvider.name}`)
  console.log(`  - API Base: ${selectedProvider.baseURL}`)
  console.log(`  - 优先级: ${selectedProvider.priority}`)
} else {
  console.log('  ❌ 无可用提供商')
}

// 5. 健康状态检查
console.log('\n💊 提供商健康状态:')
const health = getProviderHealthStatus()
console.log(`  总提供商数: ${health.totalProviders}`)
console.log(`  启用提供商数: ${health.enabledProviders}`)
console.log(`  主提供商: ${health.primary?.name || '无'}`)

// 6. 结论
console.log('\n' + '='.repeat(60))
if (selectedProvider?.name === 'ZenMux') {
  console.log('✅ 配置正确！对话将优先使用 ZenMux')
} else if (selectedProvider?.name === '302.AI') {
  console.log('⚠️  当前使用 302.AI（ZenMux未配置或不可用）')
} else {
  console.log('❌ 配置错误！无可用提供商')
}
console.log('='.repeat(60))
