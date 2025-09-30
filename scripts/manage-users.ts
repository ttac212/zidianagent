/**
 * 用户管理工具
 * 列出、查看、更新、删除用户账户
 */

import { prisma } from '@/lib/prisma'

async function listUsers() {
  console.log('👥 用户列表\n')

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      status: true,
      monthlyTokenLimit: true,
      createdAt: true,
      _count: {
        select: {
          conversations: true,
          messages: true
        }
      }
    }
  })

  if (users.length === 0) {
    console.log('⚠️  没有找到用户')
    return
  }

  console.log(`共 ${users.length} 个用户:\n`)

  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email}`)
    console.log(`   ID: ${user.id}`)
    console.log(`   显示名: ${user.displayName || '(未设置)'}`)
    console.log(`   角色: ${user.role} | 状态: ${user.status}`)
    console.log(`   Token限额: ${user.monthlyTokenLimit.toLocaleString()} tokens/月`)
    console.log(`   对话: ${user._count.conversations} | 消息: ${user._count.messages}`)
    console.log(`   创建时间: ${new Date(user.createdAt).toLocaleString('zh-CN')}`)
    console.log()
  })
}

async function getUserByEmail(email: string) {
  console.log(`🔍 查找用户: ${email}\n`)

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      _count: {
        select: {
          conversations: true,
          messages: true
        }
      }
    }
  })

  if (!user) {
    console.log('❌ 用户不存在')
    return
  }

  console.log('📋 用户详情:')
  console.log(`  ID: ${user.id}`)
  console.log(`  邮箱: ${user.email}`)
  console.log(`  用户名: ${user.username}`)
  console.log(`  显示名: ${user.displayName || '(未设置)'}`)
  console.log(`  角色: ${user.role}`)
  console.log(`  状态: ${user.status}`)
  console.log(`  月度Token限额: ${user.monthlyTokenLimit.toLocaleString()} tokens`)
  console.log(`  对话数: ${user._count.conversations}`)
  console.log(`  消息数: ${user._count.messages}`)
  console.log(`  创建时间: ${new Date(user.createdAt).toLocaleString('zh-CN')}`)
  console.log(`  更新时间: ${new Date(user.updatedAt).toLocaleString('zh-CN')}`)
  console.log(`  邮箱验证: ${user.emailVerified ? new Date(user.emailVerified).toLocaleString('zh-CN') : '未验证'}`)
}

async function updateUserRole(email: string, role: 'USER' | 'ADMIN') {
  console.log(`🔧 更新用户角色: ${email} → ${role}\n`)

  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role }
    })

    console.log('✅ 角色更新成功')
    console.log(`  ${user.email}: ${user.role}`)
  } catch (error) {
    console.error('❌ 更新失败:', error)
  }
}

async function updateUserTokenLimit(email: string, limit: number) {
  console.log(`🔧 更新用户Token限额: ${email} → ${limit.toLocaleString()} tokens/月\n`)

  try {
    const user = await prisma.user.update({
      where: { email },
      data: { monthlyTokenLimit: limit }
    })

    console.log('✅ Token限额更新成功')
    console.log(`  ${user.email}: ${user.monthlyTokenLimit.toLocaleString()} tokens/月`)
  } catch (error) {
    console.error('❌ 更新失败:', error)
  }
}

async function deleteUser(email: string) {
  console.log(`🗑️  删除用户: ${email}\n`)

  try {
    // 先检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        _count: {
          select: {
            conversations: true,
            messages: true
          }
        }
      }
    })

    if (!user) {
      console.log('❌ 用户不存在')
      return
    }

    console.log('⚠️  警告: 即将删除用户及其所有数据:')
    console.log(`  邮箱: ${user.email}`)
    console.log(`  对话: ${user._count.conversations} 个`)
    console.log(`  消息: ${user._count.messages} 条`)

    // 实际删除（级联删除关联数据）
    await prisma.user.delete({
      where: { email }
    })

    console.log('\n✅ 用户已删除')
  } catch (error) {
    console.error('❌ 删除失败:', error)
  }
}

// 命令行参数解析
const args = process.argv.slice(2)
const command = args[0]

async function main() {
  try {
    switch (command) {
      case 'list':
      case 'ls':
        await listUsers()
        break

      case 'get':
      case 'show':
        if (!args[1]) {
          console.log('❌ 缺少邮箱参数')
          console.log('用法: npx tsx scripts/manage-users.ts get <email>')
          process.exit(1)
        }
        await getUserByEmail(args[1])
        break

      case 'update-role':
        if (!args[1] || !args[2]) {
          console.log('❌ 缺少参数')
          console.log('用法: npx tsx scripts/manage-users.ts update-role <email> <USER|ADMIN>')
          process.exit(1)
        }
        await updateUserRole(args[1], args[2] as 'USER' | 'ADMIN')
        break

      case 'update-limit':
        if (!args[1] || !args[2]) {
          console.log('❌ 缺少参数')
          console.log('用法: npx tsx scripts/manage-users.ts update-limit <email> <limit>')
          process.exit(1)
        }
        await updateUserTokenLimit(args[1], parseInt(args[2]))
        break

      case 'delete':
      case 'rm':
        if (!args[1]) {
          console.log('❌ 缺少邮箱参数')
          console.log('用法: npx tsx scripts/manage-users.ts delete <email>')
          process.exit(1)
        }
        await deleteUser(args[1])
        break

      default:
        console.log('📖 用户管理工具\n')
        console.log('用法: npx tsx scripts/manage-users.ts <command> [options]\n')
        console.log('命令:')
        console.log('  list, ls                        列出所有用户')
        console.log('  get <email>                     查看用户详情')
        console.log('  update-role <email> <role>      更新用户角色 (USER/ADMIN)')
        console.log('  update-limit <email> <limit>    更新Token限额')
        console.log('  delete <email>                  删除用户（谨慎操作）')
        console.log('\n示例:')
        console.log('  npx tsx scripts/manage-users.ts list')
        console.log('  npx tsx scripts/manage-users.ts get test@example.com')
        console.log('  npx tsx scripts/manage-users.ts update-role test@example.com ADMIN')
        console.log('  npx tsx scripts/manage-users.ts update-limit test@example.com 500000')
    }
  } finally {
    await prisma.$disconnect()
  }
}

main()
