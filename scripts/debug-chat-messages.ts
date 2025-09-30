/**
 * 聊天消息显示问题诊断脚本
 * 用于定位历史消息不显示的根本原因
 */

import { prisma } from '@/lib/prisma'

interface DiagnosticResult {
  issue: string
  severity: 'high' | 'medium' | 'low'
  description: string
  solution?: string
}

async function diagnoseChatMessages(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []

  try {
    console.log('🔍 开始诊断聊天消息显示问题...\n')

    // 1. 检查数据库中是否有消息数据
    console.log('1️⃣ 检查数据库消息数据...')
    const messageCount = await prisma.message.count()
    const conversationCount = await prisma.conversation.count()

    console.log(`   - 消息总数: ${messageCount}`)
    console.log(`   - 对话总数: ${conversationCount}`)

    if (messageCount === 0) {
      results.push({
        issue: 'NO_MESSAGES_IN_DB',
        severity: 'high',
        description: '数据库中没有消息数据',
        solution: '创建测试对话并发送消息'
      })
    }

    // 2. 检查最近的对话和消息
    if (conversationCount > 0) {
      console.log('\n2️⃣ 检查最近的对话数据...')
      const recentConversation = await prisma.conversation.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 5
          },
          _count: {
            select: { messages: true }
          }
        }
      })

      if (recentConversation) {
        console.log(`   - 最新对话ID: ${recentConversation.id}`)
        console.log(`   - 对话标题: ${recentConversation.title}`)
        console.log(`   - 消息数量: ${recentConversation._count.messages}`)
        console.log(`   - 获取到的消息: ${recentConversation.messages.length}`)

        // 检查消息字段完整性
        if (recentConversation.messages.length > 0) {
          const firstMessage = recentConversation.messages[0]
          console.log(`   - 第一条消息字段检查:`)
          console.log(`     * ID: ${firstMessage.id}`)
          console.log(`     * Role: ${firstMessage.role}`)
          console.log(`     * Content length: ${firstMessage.content.length}`)
          console.log(`     * ModelId: ${firstMessage.modelId}`)
          console.log(`     * CreatedAt: ${firstMessage.createdAt}`)

          // 检查必需字段
          if (!firstMessage.id || !firstMessage.role || !firstMessage.content) {
            results.push({
              issue: 'MISSING_REQUIRED_FIELDS',
              severity: 'high',
              description: '消息缺少必需字段 (id, role, content)',
              solution: '检查消息创建逻辑，确保所有必需字段都被设置'
            })
          }
        } else {
          results.push({
            issue: 'CONVERSATION_WITHOUT_MESSAGES',
            severity: 'medium',
            description: '对话存在但没有消息',
            solution: '检查消息创建和关联逻辑'
          })
        }
      }
    }

    // 3. 检查数据库schema一致性
    console.log('\n3️⃣ 检查数据结构一致性...')

    // 检查modelId字段映射
    const messagesWithModelId = await prisma.message.findMany({
      where: { modelId: { not: null } },
      take: 3,
      select: { id: true, modelId: true, role: true }
    })

    console.log(`   - 有modelId的消息数量: ${messagesWithModelId.length}`)
    if (messagesWithModelId.length > 0) {
      console.log(`   - 示例modelId: ${messagesWithModelId[0].modelId}`)
    }

    // 4. 检查API响应格式问题
    console.log('\n4️⃣ 模拟API调用检查数据格式...')
    if (conversationCount > 0) {
      // 模拟API调用获取对话详情
      const conversation = await prisma.conversation.findFirst({
        where: {},
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              role: true,
              content: true,
              promptTokens: true,
              completionTokens: true,
              modelId: true,
              createdAt: true,
            }
          },
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              status: true,
            }
          }
        }
      })

      if (conversation) {
        // 模拟字段映射
        const mappedConversation = {
          ...conversation,
          model: conversation.modelId, // 这是关键映射
          messages: conversation.messages?.map((msg: any) => ({
            ...msg,
            model: msg.modelId, // 消息中的映射
            tokens: (msg.promptTokens || 0) + (msg.completionTokens || 0)
          }))
        }

        console.log(`   - 映射后的对话模型: ${mappedConversation.model}`)
        console.log(`   - 映射后的消息数量: ${mappedConversation.messages?.length || 0}`)

        if (mappedConversation.messages && mappedConversation.messages.length > 0) {
          const firstMsg = mappedConversation.messages[0]
          console.log(`   - 第一条消息映射检查:`)
          console.log(`     * 原始modelId: ${firstMsg.modelId}`)
          console.log(`     * 映射后model: ${firstMsg.model}`)
          console.log(`     * tokens计算: ${firstMsg.tokens}`)
        }
      }
    }

    // 5. 前端类型兼容性检查
    console.log('\n5️⃣ 前端类型兼容性检查...')

    // 检查必需的status字段
    console.log('   - 检查消息status字段要求...')
    console.log('   - 新架构要求每个ChatMessage都有status字段')
    console.log('   - API转换函数应该设置 status: "completed"')

    if (results.length === 0) {
      results.push({
        issue: 'NO_OBVIOUS_ISSUES',
        severity: 'low',
        description: '数据库层面未发现明显问题',
        solution: '问题可能在前端组件层面或状态管理中'
      })
    }

  } catch (error) {
    results.push({
      issue: 'DIAGNOSTIC_ERROR',
      severity: 'high',
      description: `诊断过程出错: ${error instanceof Error ? error.message : String(error)}`,
      solution: '检查数据库连接和权限'
    })
  }

  return results
}

async function main() {
  const results = await diagnoseChatMessages()

  console.log('\n📋 诊断结果总结:')
  console.log('='*50)

  results.forEach((result, index) => {
    const emoji = result.severity === 'high' ? '🔴' : result.severity === 'medium' ? '🟡' : '🟢'
    console.log(`\n${index + 1}. ${emoji} ${result.issue} (${result.severity.toUpperCase()})`)
    console.log(`   描述: ${result.description}`)
    if (result.solution) {
      console.log(`   解决方案: ${result.solution}`)
    }
  })

  console.log('\n🎯 推荐的修复步骤:')
  console.log('1. 运行此脚本检查数据库层面问题')
  console.log('2. 在浏览器开发者工具中检查API响应')
  console.log('3. 在SmartChatCenter组件中添加调试日志')
  console.log('4. 检查React Query缓存状态')
  console.log('5. 验证消息状态同步逻辑')

  await prisma.$disconnect()
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error)
}

export { diagnoseChatMessages }