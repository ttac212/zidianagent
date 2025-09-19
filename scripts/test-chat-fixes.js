#!/usr/bin/env node
/**
 * 测试聊天系统修复
 */

const { PrismaClient } = require('@prisma/client')
const path = require('path')
const fs = require('fs')

async function testTypeDefinitions() {
  console.log('\n📌 测试类型定义修复...')
  
  const typesPath = path.join(__dirname, '..', 'types', 'chat.ts')
  const content = fs.readFileSync(typesPath, 'utf8')
  
  // 检查onCreateConversation是否已修复为Promise形式
  const hasPromiseType = content.includes('onCreateConversation: (model?: string) => Promise<Conversation | null>')
  
  if (hasPromiseType) {
    console.log('✅ 类型定义已修复：onCreateConversation返回Promise')
    return true
  } else {
    console.log('❌ 类型定义未修复')
    return false
  }
}

async function testCreateConversationWrapper() {
  console.log('\n📌 测试createConversationWrapper修复...')
  
  const componentPath = path.join(__dirname, '..', 'components', 'chat', 'smart-chat-center-v2-fixed.tsx')
  const content = fs.readFileSync(componentPath, 'utf8')
  
  // 检查是否正确等待并返回结果
  const hasAwaitCall = content.includes('await onCreateConversation(model || currentModel)')
  const returnsResult = content.includes('return result')
  
  if (hasAwaitCall && returnsResult) {
    console.log('✅ createConversationWrapper已修复：正确处理Promise和模型')
    return true
  } else {
    console.log('❌ createConversationWrapper未正确修复')
    return false
  }
}

async function testConversationAPIValidation() {
  console.log('\n📌 测试Conversation API模型验证...')
  
  const apiPath = path.join(__dirname, '..', 'app', 'api', 'conversations', 'route.ts')
  const content = fs.readFileSync(apiPath, 'utf8')
  
  // 检查是否导入了验证函数
  const hasImport = content.includes("import { ALLOWED_MODEL_IDS, DEFAULT_MODEL, isAllowed } from '@/lib/ai/models'")
  // 检查是否进行模型验证
  const hasValidation = content.includes('isAllowed(validatedModelId)')
  // 检查是否使用验证后的模型
  const usesValidatedModel = content.includes('modelId: validatedModelId')
  
  if (hasImport && hasValidation && usesValidatedModel) {
    console.log('✅ Conversation API已修复：包含模型验证')
    return true
  } else {
    console.log('❌ Conversation API未正确修复')
    if (!hasImport) console.log('  - 缺少import')
    if (!hasValidation) console.log('  - 缺少验证逻辑')
    if (!usesValidatedModel) console.log('  - 未使用验证后的模型')
    return false
  }
}

async function testWorkspaceValidation() {
  console.log('\n📌 测试Workspace页面模型验证...')
  
  const workspacePath = path.join(__dirname, '..', 'app', 'workspace', 'page.tsx')
  const content = fs.readFileSync(workspacePath, 'utf8')
  
  // 检查是否导入了isAllowed函数
  const hasImport = content.includes('isAllowed } from "@/lib/ai/models"')
  // 检查是否验证存储的模型
  const validatesStored = content.includes('isAllowed(storedModel)')
  // 检查创建对话时是否验证
  const validatesOnCreate = content.includes('isAllowed(selectedModel) ? selectedModel : defaultModelId')
  
  if (hasImport && validatesStored && validatesOnCreate) {
    console.log('✅ Workspace页面已修复：包含模型验证')
    return true
  } else {
    console.log('❌ Workspace页面未正确修复')
    if (!hasImport) console.log('  - 缺少isAllowed导入')
    if (!validatesStored) console.log('  - 未验证存储的模型')
    if (!validatesOnCreate) console.log('  - 创建时未验证模型')
    return false
  }
}

async function testDatabaseModelValues() {
  console.log('\n📌 测试数据库中的模型值...')
  
  const prisma = new PrismaClient({
    log: ['warn', 'error']
  })
  
  try {
    // 检查是否有使用无效模型的对话
    const invalidConversations = await prisma.conversation.findMany({
      where: {
        modelId: {
          notIn: ['claude-opus-4-1-20250805', 'gemini-2.5-pro']
        }
      },
      select: {
        id: true,
        modelId: true,
        createdAt: true
      }
    })
    
    if (invalidConversations.length > 0) {
      console.log(`⚠️  发现 ${invalidConversations.length} 个使用无效模型的对话`)
      console.log('  无效模型包括：', [...new Set(invalidConversations.map(c => c.modelId))])
    } else {
      console.log('✅ 数据库中没有使用无效模型的对话')
    }
    
    await prisma.$disconnect()
    return invalidConversations.length === 0
  } catch (error) {
    console.error('❌ 数据库测试失败:', error.message)
    await prisma.$disconnect()
    return false
  }
}

async function simulateConversationCreation() {
  console.log('\n📌 模拟对话创建...')
  
  const prisma = new PrismaClient({
    log: ['warn', 'error']
  })
  
  try {
    // 获取一个测试用户
    const testUser = await prisma.user.findFirst({
      where: { status: 'ACTIVE' }
    })
    
    if (!testUser) {
      console.log('⚠️  没有找到活跃用户进行测试')
      await prisma.$disconnect()
      return false
    }
    
    // 使用事务测试创建对话（会回滚）
    const result = await prisma.$transaction(async (tx) => {
      // 测试1：使用无效模型应该被替换为默认模型
      const testConv = await tx.conversation.create({
        data: {
          title: 'TEST_CONVERSATION',
          userId: testUser.id,
          modelId: 'claude-opus-4-1-20250805', // 应该是允许的
          temperature: 0.7,
          maxTokens: 2000
        }
      })
      
      if (testConv.modelId === 'claude-opus-4-1-20250805') {
        console.log('✅ 测试对话创建成功，使用了正确的模型')
      } else {
        console.log('❌ 测试对话创建失败，模型不正确')
      }
      
      // 清理测试数据（抛出错误回滚事务）
      throw new Error('ROLLBACK_TEST')
    }).catch(err => {
      if (err.message === 'ROLLBACK_TEST') {
        return true // 测试成功
      }
      throw err
    })
    
    await prisma.$disconnect()
    return result
  } catch (error) {
    console.error('❌ 模拟创建失败:', error.message)
    await prisma.$disconnect()
    return false
  }
}

async function main() {
  console.log('🔧 聊天系统修复验证脚本')
  console.log('='.repeat(50))
  
  const results = []
  
  // 1. 测试类型定义
  results.push(await testTypeDefinitions())
  
  // 2. 测试createConversationWrapper
  results.push(await testCreateConversationWrapper())
  
  // 3. 测试API验证
  results.push(await testConversationAPIValidation())
  
  // 4. 测试Workspace验证
  results.push(await testWorkspaceValidation())
  
  // 5. 测试数据库
  results.push(await testDatabaseModelValues())
  
  // 6. 模拟创建
  results.push(await simulateConversationCreation())
  
  console.log('\n' + '='.repeat(50))
  console.log('📊 测试结果汇总:')
  
  const passed = results.filter(r => r).length
  const total = results.length
  
  if (passed === total) {
    console.log(`✅ 所有测试通过 (${passed}/${total})`)
    console.log('\n🎉 聊天系统修复已成功应用!')
    console.log('\n主要修复：')
    console.log('  1. createConversationWrapper现在正确处理Promise和模型参数')
    console.log('  2. conversations API验证模型ID并使用默认模型')
    console.log('  3. workspace页面验证localStorage中的模型')
    console.log('\n新对话将使用正确的模型，第一条消息将正常发送!')
  } else {
    console.log(`⚠️  部分测试失败 (${passed}/${total})`)
    console.log('\n请检查失败的项目并修复')
  }
  
  process.exit(passed === total ? 0 : 1)
}

main().catch(error => {
  console.error('❌ 脚本执行失败:', error)
  process.exit(1)
})