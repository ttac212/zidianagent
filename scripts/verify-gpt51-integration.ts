/**
 * 验证 GPT-5.1 集成是否正确
 */
import { config } from 'dotenv'
import { resolve } from 'path'

// 加载环境变量
config({ path: resolve(process.cwd(), '.env.local') })

console.log('🔍 验证 GPT-5.1 集成配置\n')
console.log('═'.repeat(60))

// 1. 检查环境变量
console.log('\n1️⃣  环境变量检查')
console.log('─'.repeat(60))

const zenmuxApiKey = process.env.ZENMUX_API_KEY
const zenmuxApiBase = process.env.ZENMUX_API_BASE
const modelAllowlist = process.env.MODEL_ALLOWLIST

console.log(`ZENMUX_API_KEY: ${zenmuxApiKey ? '✅ 已配置' : '❌ 未配置'}`)
console.log(`ZENMUX_API_BASE: ${zenmuxApiBase || '❌ 未配置'}`)
console.log(`MODEL_ALLOWLIST: ${modelAllowlist || '❌ 未配置'}`)

if (modelAllowlist) {
  const models = modelAllowlist.split(',').map(m => m.trim())
  const hasGPT51 = models.some(m => m.includes('gpt-5.1'))
  console.log(`\n包含的模型:`)
  models.forEach(m => {
    const isGPT51 = m.includes('gpt-5.1')
    console.log(`  ${isGPT51 ? '✅' : '  '} ${m}`)
  })

  if (!hasGPT51) {
    console.log('\n⚠️  警告: MODEL_ALLOWLIST 中未包含 openai/gpt-5.1')
  }
}

// 主函数
async function main() {
  // 2. 检查代码配置
  console.log('\n\n2️⃣  代码配置检查')
  console.log('─'.repeat(60))

  try {
    // 动态导入模块
    const modelsModule = await import('../lib/ai/models.js')
    const keyManagerModule = await import('../lib/ai/key-manager.js')

    const { ALLOWED_MODELS, getModelCapabilities } = modelsModule
    const { selectApiKey } = keyManagerModule

    console.log(`\n已加载的模型数量: ${ALLOWED_MODELS.length}`)

    // 查找 GPT-5.1
    const gpt51Model = ALLOWED_MODELS.find((m: any) => m.id.includes('gpt-5.1'))

    if (gpt51Model) {
      console.log('\n✅ GPT-5.1 模型配置正确!')
      console.log(`  ID: ${gpt51Model.id}`)
      console.log(`  名称: ${gpt51Model.name}`)
      console.log(`  能力:`)
      console.log(`    - 支持推理: ${gpt51Model.capabilities.supportsReasoning}`)
      console.log(`    - 提供商: ${gpt51Model.capabilities.provider}`)
      console.log(`    - 家族: ${gpt51Model.capabilities.family}`)

      // 测试 Key 选择
      const keyResult = selectApiKey(gpt51Model.id)
      console.log(`\n  API Key 选择:`)
      console.log(`    - Provider: ${keyResult.provider}`)
      console.log(`    - 有Key: ${!!keyResult.apiKey}`)

    } else {
      console.log('\n❌ GPT-5.1 未在模型列表中找到')
      console.log('\n可用的模型:')
      ALLOWED_MODELS.forEach((m: any) => {
        console.log(`  - ${m.id} (${m.name})`)
      })
    }

    // 3. 测试模型能力获取
    console.log('\n\n3️⃣  模型能力测试')
    console.log('─'.repeat(60))

    const capabilities = getModelCapabilities('openai/gpt-5.1')
    console.log('\ngetModelCapabilities("openai/gpt-5.1"):')
    console.log(`  - 支持推理: ${capabilities.supportsReasoning}`)
    console.log(`  - 提供商: ${capabilities.provider}`)
    console.log(`  - 家族: ${capabilities.family}`)

  } catch (error) {
    console.error('\n❌ 代码配置检查失败:', error)
    if (error instanceof Error) {
      console.error('错误详情:', error.message)
      console.error('\n可能的原因:')
      console.error('  1. lib/ai/models.ts 中未添加 GPT-5.1 配置')
      console.error('  2. TypeScript 编译错误')
      console.error('  3. 模块导入路径错误')
    }
    process.exit(1)
  }

  // 4. 总结
  console.log('\n\n4️⃣  集成总结')
  console.log('═'.repeat(60))

  const checks = [
    { name: '环境变量配置', status: !!zenmuxApiKey && !!modelAllowlist },
    { name: 'MODEL_ALLOWLIST 包含 GPT-5.1', status: modelAllowlist?.includes('gpt-5.1') },
    { name: 'ZENMUX API 配置', status: !!zenmuxApiBase },
  ]

  let allPassed = true
  checks.forEach(check => {
    const icon = check.status ? '✅' : '❌'
    console.log(`${icon} ${check.name}`)
    if (!check.status) allPassed = false
  })

  if (allPassed) {
    console.log('\n🎉 所有检查通过！GPT-5.1 已成功集成')
    console.log('\n下一步:')
    console.log('  1. 重启开发服务器: pnpm dev')
    console.log('  2. 在前端模型选择器中查看 GPT-5.1 选项')
    console.log('  3. 发送测试消息验证功能')
  } else {
    console.log('\n⚠️  部分检查未通过，请根据上述提示修复')
    console.log('\n修复步骤:')
    console.log('  1. 更新 .env.local 中的 MODEL_ALLOWLIST')
    console.log('  2. 确保包含: openai/gpt-5.1')
    console.log('  3. 重新运行此脚本验证')
  }

  console.log('\n')
}

// 运行主函数
main().catch(console.error)
