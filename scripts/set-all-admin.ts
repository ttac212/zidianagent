/**
 * 将所有用户设置为管理员
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 查询当前所有用户...')

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
    },
  })

  console.log(`\n📊 当前用户列表 (共 ${users.length} 个):`)
  console.table(users)

  console.log('\n🔧 开始更新所有用户为管理员...')

  const result = await prisma.user.updateMany({
    data: {
      role: 'ADMIN',
    },
  })

  console.log(`\n✅ 成功更新 ${result.count} 个用户为管理员`)

  // 验证更新结果
  const updatedUsers = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
    },
  })

  console.log('\n📊 更新后的用户列表:')
  console.table(updatedUsers)
}

main()
  .catch((error) => {
    console.error('❌ 执行失败:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
