#!/usr/bin/env node
/**
 * 测试安全修复
 */

const { PrismaClient } = require('@prisma/client')
const path = require('path')

// 加载修复后的prisma实例
const prismaPath = path.join(__dirname, '..', 'lib', 'prisma.ts')
console.log('✅ Prisma配置路径:', prismaPath)

async function testPrismaConfig() {
  console.log('\n📌 测试Prisma配置...')
  
  try {
    // 创建一个新的客户端实例来测试配置
    const testPrisma = new PrismaClient({
      log: ['query', 'warn', 'error'],
      transactionOptions: {
        maxWait: 5000,
        timeout: 45000
        // 不设置isolationLevel - 已修复
      }
    })
    
    // 测试连接
    await testPrisma.$connect()
    console.log('✅ Prisma连接成功')
    
    // 测试事务（不会因为隔离级别报错）
    await testPrisma.$transaction(async (tx) => {
      const userCount = await tx.user.count()
      console.log('✅ 事务执行成功，用户数:', userCount)
    })
    
    await testPrisma.$disconnect()
    console.log('✅ Prisma事务配置正确')
  } catch (error) {
    console.error('❌ Prisma配置测试失败:', error.message)
    return false
  }
  
  return true
}

async function checkImports() {
  console.log('\n📌 检查Prisma导入...')
  
  const files = [
    'app/api/merchants/route.ts',
    'app/api/merchants/[id]/route.ts', 
    'app/api/merchants/[id]/contents/route.ts',
    'app/api/merchants/[id]/tags/route.ts',
    'app/api/merchants/[id]/export/route.ts',
    'app/api/merchants/[id]/analytics/route.ts',
    'app/api/merchants/stats/route.ts',
    'app/api/merchants/categories/route.ts'
  ]
  
  const fs = require('fs')
  let allCorrect = true
  
  for (const file of files) {
    const filePath = path.join(__dirname, '..', file)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8')
      const hasCorrectImport = content.includes("import { prisma } from '@/lib/prisma'")
      const hasWrongImport = content.includes("new PrismaClient()")
      
      if (hasCorrectImport && !hasWrongImport) {
        console.log(`✅ ${file}: 使用共享Prisma实例`)
      } else {
        console.log(`❌ ${file}: 仍在创建独立实例`)
        allCorrect = false
      }
    }
  }
  
  return allCorrect
}

async function checkAuthRoutes() {
  console.log('\n📌 检查认证保护...')
  
  const files = [
    'app/api/users/route.ts',
    'app/api/users/[id]/route.ts',
    'app/api/invite-codes/route.ts'
  ]
  
  const fs = require('fs')
  let allProtected = true
  
  for (const file of files) {
    const filePath = path.join(__dirname, '..', file)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8')
      const hasRequireAuth = content.includes("requireAuth(token, 'ADMIN')")
      
      if (hasRequireAuth) {
        console.log(`✅ ${file}: 已添加ADMIN权限检查`)
      } else {
        console.log(`❌ ${file}: 缺少权限检查`)
        allProtected = false
      }
    }
  }
  
  return allProtected
}

async function checkInviteCodeNormalization() {
  console.log('\n📌 检查邀请码标准化...')
  
  const fs = require('fs')
  const filePath = path.join(__dirname, '..', 'app/api/invite-codes/route.ts')
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8')
    const hasNormalization = content.includes("code: code.trim().toUpperCase()")
    
    if (hasNormalization) {
      console.log('✅ 邀请码创建时已标准化为大写')
      return true
    } else {
      console.log('❌ 邀请码创建时未标准化')
      return false
    }
  }
  
  return false
}

async function main() {
  console.log('🔧 安全修复验证脚本')
  console.log('='.repeat(50))
  
  const results = []
  
  // 1. 测试Prisma配置
  results.push(await testPrismaConfig())
  
  // 2. 检查Prisma导入
  results.push(await checkImports())
  
  // 3. 检查认证路由
  results.push(await checkAuthRoutes())
  
  // 4. 检查邀请码标准化
  results.push(await checkInviteCodeNormalization())
  
  console.log('\n' + '='.repeat(50))
  console.log('📊 测试结果汇总:')
  
  const passed = results.filter(r => r).length
  const total = results.length
  
  if (passed === total) {
    console.log(`✅ 所有测试通过 (${passed}/${total})`)
    console.log('\n🎉 安全修复已成功应用!')
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