import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function checkTable() {
  try {
    // 尝试查询 merchant_members 表
    const result = await prisma.$queryRaw`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='merchant_members'
    `

    console.log('merchant_members 表存在:', result)

    if (Array.isArray(result) && result.length > 0) {
      // 检查表结构
      const tableInfo = await prisma.$queryRaw`
        PRAGMA table_info(merchant_members)
      `
      console.log('\n表结构:', tableInfo)

      // 检查记录数
      const count = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM merchant_members
      `
      console.log('\n记录数:', count[0]?.count)
    } else {
      console.log('\n❌ merchant_members 表不存在！')
      console.log('这就是 API 500 错误的原因。')
    }

  } catch (error) {
    console.error('❌ 错误:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkTable()
