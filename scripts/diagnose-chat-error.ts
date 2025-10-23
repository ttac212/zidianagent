/**
 * 诊断聊天API 500错误
 */
import { prisma } from '@/lib/prisma'
import { selectApiKey, getKeyHealthStatus } from '@/lib/ai/key-manager'

async function diagnose() {
  console.log('=== 聊天API诊断工具 ===\n')

  // 1. 检查API Key配置
  console.log('1. API Key配置检查:')
  const keyHealth = getKeyHealthStatus()
  console.log('  - 有可用的API Key:', keyHealth.hasKey)
  console.log('  - API Base:', keyHealth.apiBase)
  console.log('  - 配置的Keys:', JSON.stringify(keyHealth.keys, null, 2))

  // 测试特定模型的Key选择
  const testModels = [
    'claude-3-5-haiku-20241022',
    'gemini-2.5-pro',
    'gpt-4'
  ]

  console.log('\n2. 模型Key选择测试:')
  for (const model of testModels) {
    const result = selectApiKey(model)
    console.log(`  - ${model}:`)
    console.log(`    Provider: ${result.provider}`)
    console.log(`    Has Key: ${!!result.apiKey}`)
  }

  // 3. 检查数据库连接
  console.log('\n3. 数据库连接检查:')
  try {
    const userCount = await prisma.user.count()
    console.log(`  ✓ 数据库连接正常，用户数: ${userCount}`)

    // 检查是否有用户
    if (userCount === 0) {
      console.log('  ⚠️  警告: 没有用户，请先创建用户')
    } else {
      // 获取一个用户的配额信息
      const user = await prisma.user.findFirst({
        select: {
          id: true,
          email: true,
          currentMonthUsage: true,
          monthlyTokenLimit: true
        }
      })

      if (user) {
        console.log(`\n  示例用户配额:`)
        console.log(`    Email: ${user.email}`)
        console.log(`    当前使用: ${user.currentMonthUsage} tokens`)
        console.log(`    月度限额: ${user.monthlyTokenLimit} tokens`)
        console.log(`    剩余额度: ${user.monthlyTokenLimit - user.currentMonthUsage} tokens`)
      }
    }
  } catch (error) {
    console.error('  ✗ 数据库连接失败:', error instanceof Error ? error.message : error)
  }

  // 4. 测试API调用
  console.log('\n4. AI API连接测试:')
  const { apiKey } = selectApiKey('claude-3-5-haiku-20241022')

  if (!apiKey) {
    console.log('  ✗ 缺少API Key，无法测试API连接')
  } else {
    const apiBase = process.env.LLM_API_BASE || 'https://api.302.ai/v1'
    console.log(`  测试端点: ${apiBase}/chat/completions`)

    try {
      const response = await fetch(`${apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10
        })
      })

      if (response.ok) {
        console.log('  ✓ API连接成功')
      } else {
        console.log(`  ✗ API返回错误: ${response.status} ${response.statusText}`)
        const text = await response.text()
        console.log(`    响应内容: ${text.substring(0, 200)}`)
      }
    } catch (error) {
      console.error('  ✗ API连接失败:', error instanceof Error ? error.message : error)
    }
  }

  // 5. 检查最近的错误记录
  console.log('\n5. 检查最近的消息记录:')
  try {
    const recentMessages = await prisma.message.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        role: true,
        createdAt: true,
        promptTokens: true,
        completionTokens: true,
        conversation: {
          select: {
            title: true
          }
        }
      }
    })

    if (recentMessages.length > 0) {
      console.log(`  找到 ${recentMessages.length} 条最近消息:`)
      recentMessages.forEach(msg => {
        console.log(`    - ${msg.role} in "${msg.conversation.title}" (${msg.createdAt.toISOString()})`)
        console.log(`      Tokens: ${msg.promptTokens} + ${msg.completionTokens}`)
      })
    } else {
      console.log('  没有找到消息记录')
    }
  } catch (error) {
    console.error('  ✗ 查询消息失败:', error instanceof Error ? error.message : error)
  }

  console.log('\n=== 诊断完成 ===')
  await prisma.$disconnect()
}

diagnose().catch(console.error)
