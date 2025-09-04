import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 创建默认用户
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      username: 'testuser',
      displayName: '测试用户',
      role: 'USER',
      status: 'ACTIVE',
      monthlyTokenLimit: 1000000,
      currentMonthUsage: 0,
      totalTokenUsed: 0,
    },
  })
  
  // 创建一个初始对话
  const conversation = await prisma.conversation.create({
    data: {
      title: '欢迎对话',
      userId: user.id,
      modelId: 'claude-opus-4-1-20250805',
      temperature: 0.7,
      maxTokens: 2000,
      contextAware: true,
      messageCount: 0,
      totalTokens: 0,
    },
  })
  
  }

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    await prisma.$disconnect()
    process.exit(1)
  })