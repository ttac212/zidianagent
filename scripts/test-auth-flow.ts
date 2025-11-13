/**
 * 测试 Next-Auth 认证流程
 * 诊断 CLIENT_FETCH_ERROR 问题
 */

require('dotenv').config({ path: '.env.local' })

import { prisma } from '@/lib/prisma'
import { authenticate } from '@/auth/strategies'

async function testAuthFlow() {
  console.log('\n=== Next-Auth 认证流程测试 ===\n')

  // 1. 测试数据库连接
  console.log('1️⃣  测试数据库连接...')
  try {
    await prisma.$connect()
    const userCount = await prisma.user.count()
    console.log(`   ✓ 数据库连接成功，用户数: ${userCount}`)
  } catch (error: any) {
    console.error('   ✗ 数据库连接失败:', error.message)
    return
  }

  // 2. 测试环境变量
  console.log('\n2️⃣  检查环境变量配置...')
  const envVars = {
    'NODE_ENV': process.env.NODE_ENV,
    'DEV_LOGIN_CODE': process.env.DEV_LOGIN_CODE ? '已设置' : '未设置',
    'NEXTAUTH_SECRET': process.env.NEXTAUTH_SECRET ? '已设置' : '未设置',
    'NEXTAUTH_URL': process.env.NEXTAUTH_URL,
    'DATABASE_URL': process.env.DATABASE_URL ? '已设置' : '未设置',
  }

  for (const [key, value] of Object.entries(envVars)) {
    console.log(`   ${key}: ${value}`)
  }

  // 3. 测试认证策略
  console.log('\n3️⃣  测试认证策略...')

  const testEmail = 'test@example.com'
  const testCode = process.env.DEV_LOGIN_CODE || ''

  console.log(`   测试邮箱: ${testEmail}`)
  console.log(`   测试登录码: ${testCode}`)

  try {
    const result = await authenticate({
      email: testEmail,
      code: testCode
    })

    if (result) {
      console.log('   ✓ 认证成功!')
      console.log(`   用户ID: ${result.id}`)
      console.log(`   邮箱: ${result.email}`)
      console.log(`   角色: ${result.role}`)
    } else {
      console.log('   ✗ 认证失败 (返回 null)')
    }
  } catch (error: any) {
    console.error('   ✗ 认证过程出错:', error.message)
    console.error('   堆栈:', error.stack)
  }

  // 4. 测试查询用户表
  console.log('\n4️⃣  测试用户表查询...')
  try {
    const users = await prisma.user.findMany({
      take: 5,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true
      }
    })
    console.log(`   ✓ 查询成功，前5个用户:`)
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.role}, ${user.status})`)
    })
  } catch (error: any) {
    console.error('   ✗ 查询失败:', error.message)
  }

  // 5. 测试 PrismaAdapter 需要的表
  console.log('\n5️⃣  检查 PrismaAdapter 表结构...')
  try {
    const tables = ['Account', 'Session', 'VerificationToken']
    for (const table of tables) {
      try {
        const count = await (prisma as any)[table.toLowerCase()].count()
        console.log(`   ✓ ${table} 表存在，记录数: ${count}`)
      } catch (error: any) {
        console.error(`   ✗ ${table} 表不存在或无法访问`)
      }
    }
  } catch (error: any) {
    console.error('   ✗ 表检查失败:', error.message)
  }

  // 清理
  await prisma.$disconnect()
  console.log('\n✅ 测试完成\n')
}

testAuthFlow().catch((error) => {
  console.error('测试过程中发生错误:', error)
  process.exit(1)
})
