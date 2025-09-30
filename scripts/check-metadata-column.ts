import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkMetadataColumn() {
  try {
    // 尝试查询包含metadata的对话
    const conv = await prisma.conversation.findFirst({
      select: { id: true, metadata: true }
    })

    console.log('✅ metadata列存在且可访问')
    if (conv) {
      console.log('示例数据:', conv.metadata)
    } else {
      console.log('数据库中暂无对话数据')
    }
    process.exit(0)
  } catch (error: any) {
    if (error.message.includes('no such column: metadata')) {
      console.error('❌ metadata列不存在！')
      console.error('解决方案：运行 pnpm db:push')
    } else {
      console.error('❌ 检查失败:', error.message)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkMetadataColumn()