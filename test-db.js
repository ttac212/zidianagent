import { PrismaClient } from '@prisma/client'

async function testConnection() {
  const prisma = new PrismaClient()

  try {
    // 测试连接
    await prisma.$connect()
    console.log('✅ Database connection successful')

    // 测试查询
    const userCount = await prisma.user.count()
    console.log(`✅ Found ${userCount} users`)

    const conversationCount = await prisma.conversation.count()
    console.log(`✅ Found ${conversationCount} conversations`)

    const messageCount = await prisma.message.count()
    console.log(`✅ Found ${messageCount} messages`)

    await prisma.$disconnect()
    console.log('✅ All database operations successful')
  } catch (error) {
    console.error('❌ Database error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

testConnection()