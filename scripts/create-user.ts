/**
 * 手动创建用户账户
 * 管理员工具 - 用于添加新用户到系统
 */

import { prisma } from '@/lib/prisma'
import * as dt from '@/lib/utils/date-toolkit'

async function createUser(
  email: string,
  options: {
    displayName?: string
    role?: 'USER' | 'ADMIN'
    monthlyTokenLimit?: number
  } = {}
) {
  console.log('👤 手动创建用户账户\n')

  try {
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.error('❌ 无效的邮箱格式:', email)
      return
    }

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      console.log('⚠️  用户已存在:')
      console.log(`  邮箱: ${existingUser.email}`)
      console.log(`  显示名: ${existingUser.displayName}`)
      console.log(`  角色: ${existingUser.role}`)
      console.log(`  状态: ${existingUser.status}`)
      console.log(`  创建时间: ${new Date(existingUser.createdAt).toLocaleString('zh-CN')}`)
      return
    }

    // 创建新用户
    const username = email.split('@')[0]
    const displayName = options.displayName || username
    const role = options.role || 'USER'
    const monthlyTokenLimit = options.monthlyTokenLimit || 100000 // 默认100k tokens/月

    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        displayName,
        role,
        status: 'ACTIVE',
        emailVerified: dt.now(),
        monthlyTokenLimit
      }
    })

    console.log('✅ 用户创建成功!')
    console.log('\n📋 用户信息:')
    console.log(`  ID: ${newUser.id}`)
    console.log(`  邮箱: ${newUser.email}`)
    console.log(`  用户名: ${newUser.username}`)
    console.log(`  显示名: ${newUser.displayName}`)
    console.log(`  角色: ${newUser.role}`)
    console.log(`  月度Token限额: ${newUser.monthlyTokenLimit.toLocaleString()} tokens`)
    console.log(`  状态: ${newUser.status}`)

    console.log('\n🔑 登录信息:')
    console.log(`  登录页面: http://localhost:3007/login`)
    console.log(`  邮箱: ${newUser.email}`)
    console.log(`  密码: 使用环境变量 ADMIN_LOGIN_PASSWORD 或 DEV_LOGIN_CODE`)

  } catch (error) {
    console.error('❌ 创建用户失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 命令行参数解析
const args = process.argv.slice(2)

if (args.length === 0) {
  console.log('📖 使用方法:')
  console.log('  npx tsx scripts/create-user.ts <email> [displayName] [role] [monthlyTokenLimit]')
  console.log('\n示例:')
  console.log('  npx tsx scripts/create-user.ts user@example.com')
  console.log('  npx tsx scripts/create-user.ts admin@example.com "管理员" ADMIN 1000000')
  console.log('  npx tsx scripts/create-user.ts test@example.com "测试用户" USER 50000')
  console.log('\n参数说明:')
  console.log('  email: 必需 - 用户邮箱')
  console.log('  displayName: 可选 - 显示名称（默认使用邮箱用户名部分）')
  console.log('  role: 可选 - 角色 (USER/ADMIN, 默认USER)')
  console.log('  monthlyTokenLimit: 可选 - 月度Token限额（默认100000）')
  process.exit(1)
}

const [email, displayName, role, monthlyTokenLimit] = args

createUser(email, {
  displayName,
  role: (role as 'USER' | 'ADMIN') || 'USER',
  monthlyTokenLimit: monthlyTokenLimit ? parseInt(monthlyTokenLimit) : undefined
})
