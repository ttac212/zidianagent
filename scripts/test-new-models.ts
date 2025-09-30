/**
 * 测试新模型配置
 * 验证模型白名单和Key选择逻辑
 */

// 手动加载.env.local
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { ALLOWED_MODELS, ALLOWED_MODEL_IDS, DEFAULT_MODEL, isAllowed } from '@/lib/ai/models'
import { selectApiKey, getKeyHealthStatus } from '@/lib/ai/key-manager'

console.log('🧪 测试新模型配置\n')

// 1. 检查模型白名单
console.log('📋 步骤1: 检查模型白名单')
console.log(`  白名单模型数量: ${ALLOWED_MODEL_IDS.length}`)
console.log(`  默认模型: ${DEFAULT_MODEL}`)
console.log('\n  模型列表:')
ALLOWED_MODELS.forEach((model, index) => {
  const isDefault = model.id === DEFAULT_MODEL
  console.log(`    ${index + 1}. ${model.name} (${model.id})${isDefault ? ' [默认]' : ''}`)
})

// 2. 测试新模型是否在白名单中
console.log('\n✅ 步骤2: 验证新模型是否在白名单中')
const newModels = [
  'claude-sonnet-4-5-20250929-thinking',
  'claude-sonnet-4-5-20250929'
]

newModels.forEach(modelId => {
  const allowed = isAllowed(modelId)
  console.log(`  ${modelId}: ${allowed ? '✅ 已允许' : '❌ 未允许'}`)
})

// 3. 测试Key选择逻辑
console.log('\n🔑 步骤3: 测试Key选择逻辑')
const testModels = [
  'claude-sonnet-4-5-20250929-thinking',
  'claude-sonnet-4-5-20250929',
  'claude-opus-4-1-20250805',
  'gemini-2.5-pro'
]

testModels.forEach(modelId => {
  const { apiKey, provider } = selectApiKey(modelId)
  const keyPreview = apiKey ? `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}` : '(无)'
  console.log(`  ${modelId}`)
  console.log(`    提供商: ${provider}`)
  console.log(`    Key: ${keyPreview}`)
})

// 4. 检查Key健康状态
console.log('\n🏥 步骤4: Key健康状态检查')
const health = getKeyHealthStatus()
console.log(`  API Base: ${health.apiBase}`)
console.log(`  Keys状态:`)
console.log(`    Claude通用Key: ${health.keys.claude ? '✅' : '❌'}`)
console.log(`    Claude Sonnet 4.5 Thinking Key: ${health.keys.claudeSonnet45Thinking ? '✅' : '❌'}`)
console.log(`    Claude Sonnet 4.5 Key: ${health.keys.claudeSonnet45 ? '✅' : '❌'}`)
console.log(`    Gemini Key: ${health.keys.gemini ? '✅' : '❌'}`)
console.log(`    OpenAI Key: ${health.keys.openai ? '✅' : '❌'}`)
console.log(`    回退Key: ${health.keys.fallback ? '✅' : '❌'}`)
console.log(`  总体状态: ${health.hasKey ? '✅ 正常' : '❌ 缺少Key'}`)

console.log('\n✅ 所有测试完成！')
