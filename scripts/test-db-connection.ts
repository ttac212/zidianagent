import { PrismaClient } from '@prisma/client'
import path from 'path'

// 使用绝对路径确保数据库文件可以找到
process.env.DATABASE_URL = `file:${path.join(process.cwd(), 'prisma', 'dev.db')}`
console.log(`数据库路径: ${process.env.DATABASE_URL}`)

const prisma = new PrismaClient()

async function testConnection() {
  try {
    console.log('🔍 测试数据库连接...')

    // 测试基础连接
    await prisma.$connect()
    console.log('✅ 数据库连接成功')

    // 查询用户数量
    const userCount = await prisma.user.count()
    console.log(`\n📊 用户总数: ${userCount}`)

    // 查询对话数量
    const conversationCount = await prisma.conversation.count()
    console.log(`💬 对话总数: ${conversationCount}`)

    // 查询消息数量
    const messageCount = await prisma.message.count()
    console.log(`📝 消息总数: ${messageCount}`)

    // 查询商家数量
    const merchantCount = await prisma.merchant.count()
    console.log(`🏪 商家总数: ${merchantCount}`)

    // 查询商家内容数量
    const contentCount = await prisma.merchantContent.count()
    console.log(`📄 商家内容总数: ${contentCount}`)

    // 列出前5个用户
    const users = await prisma.user.findMany({
      take: 5,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        createdAt: true
      }
    })

    if (users.length > 0) {
      console.log('\n👥 用户列表（前5个）:')
      users.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.email} - ${user.displayName || '未设置'} (${user.role})`)
      })
    }

    console.log('\n✅ 数据库测试完成!')

  } catch (error) {
    console.error('❌ 数据库测试失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
