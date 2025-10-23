/**
 * 验证当前系统默认模型配置
 */
import { ALLOWED_MODELS, DEFAULT_MODEL } from '@/lib/ai/models'

console.log('\n=== 模型配置验证 ===\n')

console.log('环境变量 MODEL_ALLOWLIST:')
console.log(process.env.MODEL_ALLOWLIST || '(未设置，使用内置默认值)')

console.log('\n白名单模型列表:')
ALLOWED_MODELS.forEach((model, index) => {
  const isDefault = index === 0
  console.log(`  ${isDefault ? '→' : ' '} ${model.id} (${model.name})${isDefault ? ' [默认]' : ''}`)
})

console.log('\n当前默认模型:')
console.log(`  ${DEFAULT_MODEL}`)

console.log('\n根据测试结果:')
console.log('  ✅ claude-sonnet-4-5-20250929-thinking - 可用')
console.log('  ❌ claude-sonnet-4-5-20250929 - 不可用 (500错误)')
console.log('  ✅ claude-opus-4-1-20250805 - 可用')
console.log('  ❌ gemini-2.5-pro - 超时/不可用')

console.log('\n推荐操作:')
console.log('  1. 在浏览器中清除localStorage: localStorage.clear()')
console.log('  2. 刷新页面，系统会自动使用默认模型')
console.log('  3. 或在前端手动选择 "Sonnet 4.5 (思考)" 模型')

console.log('\n如果问题持续:')
console.log('  - 打开浏览器开发者工具 (F12)')
console.log('  - 在Console中运行: localStorage.removeItem("claude-code:selectedModel")')
console.log('  - 刷新页面')
