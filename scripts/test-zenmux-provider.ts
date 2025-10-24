/**
 * ZenMux提供商测试脚本
 * 测试ZenMux作为对话备选方案是否正常工作
 */

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

import {
  getLLMProviders,
  selectProvider,
  transformModelId,
  getProviderHealthStatus,
  buildChatRequest,
} from '@/lib/ai/provider-manager'

async function testZenMuxProvider() {
  console.log('🔬 ZenMux提供商配置测试\n')
  console.log('='.repeat(80))

  // 1. 检查提供商健康状态
  console.log('\n📊 提供商健康状态:')
  const health = getProviderHealthStatus()
  console.log(`   总提供商数: ${health.totalProviders}`)
  console.log(`   已启用: ${health.enabledProviders}`)
  console.log(`   主提供商: ${health.primary?.name || '无'}`)

  console.log('\n📋 提供商列表:')
  health.providers.forEach(p => {
    const status = p.enabled ? '✅' : '❌'
    console.log(`   ${status} ${p.name} (优先级: ${p.priority})`)
    console.log(`      - API Key: ${p.hasApiKey ? '已配置' : '未配置'}`)
    console.log(`      - Base URL: ${p.baseURL}`)
  })

  // 2. 测试模型ID转换
  console.log('\n' + '='.repeat(80))
  console.log('🔄 模型ID转换测试:')

  const testModels = [
    'claude-sonnet-4-5-20250929',
    'anthropic/claude-sonnet-4.5',
    'gemini-2.5-pro',
  ]

  const providers = getLLMProviders()
  for (const model of testModels) {
    console.log(`\n   原始模型: ${model}`)
    for (const provider of providers) {
      const transformed = transformModelId(model, provider)
      console.log(`   ${provider.name}: ${transformed}`)
    }
  }

  // 3. 测试提供商选择
  console.log('\n' + '='.repeat(80))
  console.log('🎯 提供商选择测试:')

  const testCases = [
    { model: 'claude-sonnet-4-5-20250929', desc: '标准Claude模型' },
    { model: 'anthropic/claude-sonnet-4.5', desc: 'ZenMux格式模型' },
    { model: 'gemini-2.5-pro', desc: 'Gemini模型' },
  ]

  for (const testCase of testCases) {
    console.log(`\n   ${testCase.desc} (${testCase.model}):`)
    const provider = selectProvider(testCase.model)
    if (provider) {
      console.log(`   ✅ 选择: ${provider.name}`)
      console.log(`      优先级: ${provider.priority}`)
    } else {
      console.log(`   ❌ 未找到可用提供商`)
    }
  }

  // 4. 测试实际API调用
  console.log('\n' + '='.repeat(80))
  console.log('🚀 实际API调用测试:')

  const zenmuxProvider = providers.find(p => p.name === 'ZenMux')

  if (!zenmuxProvider) {
    console.log('\n   ❌ ZenMux提供商未配置')
    return
  }

  console.log(`\n   使用提供商: ${zenmuxProvider.name}`)
  console.log(`   API Base: ${zenmuxProvider.baseURL}`)

  const testMessages = [
    {
      role: 'user',
      content: '你好，请用一句话介绍自己。',
    },
  ]

  const request = buildChatRequest(
    zenmuxProvider,
    process.env.ZENMUX_DEFAULT_MODEL || 'anthropic/claude-sonnet-4.5',
    testMessages,
    {
      max_tokens: 100,
      temperature: 0.7,
    }
  )

  console.log(`\n   请求URL: ${request.url}`)
  console.log(`   模型: ${request.body.model}`)

  try {
    console.log(`\n   ⏳ 发送请求...`)

    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
    })

    console.log(`\n   📥 响应:`)
    console.log(`      状态: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.log(`      错误: ${errorText}`)
      return
    }

    const result = await response.json()

    console.log(`\n   ✅ 请求成功！`)
    console.log(`      模型: ${result.model}`)
    console.log(`      回复内容:`)
    console.log(`      "${result.choices?.[0]?.message?.content || '无内容'}"`)

    if (result.usage) {
      console.log(`\n      Token使用:`)
      console.log(`      - 输入: ${result.usage.prompt_tokens}`)
      console.log(`      - 输出: ${result.usage.completion_tokens}`)
      console.log(`      - 总计: ${result.usage.total_tokens}`)
    }
  } catch (error) {
    console.log(`\n   ❌ 请求失败: ${error}`)
  }

  // 5. 总结
  console.log('\n' + '='.repeat(80))
  console.log('📊 测试总结:')
  console.log(`
✅ 配置检查: ${health.totalProviders > 0 ? '通过' : '失败'}
✅ ZenMux提供商: ${zenmuxProvider ? '已配置' : '未配置'}
✅ API调用: 见上方结果

💡 建议:
- 如果主提供商(302.AI)不可用，系统会自动切换到ZenMux
- ZenMux模型ID格式: anthropic/claude-sonnet-4.5
- 可在对话API中通过模型ID格式自动选择提供商
  `)
}

// 运行测试
testZenMuxProvider().catch(console.error)
