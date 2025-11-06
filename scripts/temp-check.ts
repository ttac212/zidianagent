import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const merchant = await prisma.merchant.findFirst({
    where: { 
      totalContentCount: { gt: 0 },
      status: 'ACTIVE'
    },
    include: {
      contents: {
        take: 3,
        orderBy: { diggCount: 'desc' }
      },
      profile: true
    }
  })
  
  if (merchant) {
    console.log('=== 商家信息 ===')
    console.log('名称:', merchant.name)
    console.log('内容总数:', merchant.totalContentCount)
    console.log('有档案:', merchant.profile ? '是' : '否')
    
    console.log('\n=== TOP3 内容 ===')
    merchant.contents.forEach((c, i) => {
      console.log(`\n[${i+1}]`, c.title.substring(0, 50))
      console.log('    互动: 赞', c.diggCount, '评', c.commentCount)
      console.log('    转录长度:', c.transcript?.length || 0)
    })
    
    if (merchant.profile) {
      console.log('\n=== 档案信息 ===')
      console.log('生成时间:', merchant.profile.aiGeneratedAt)
      console.log('模型:', merchant.profile.aiModelUsed)
      console.log('Token:', merchant.profile.aiTokenUsed)
    }
  }
  
  await prisma.$disconnect()
}

main().catch(console.error)
