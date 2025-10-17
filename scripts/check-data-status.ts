import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDataStatus() {
  try {
    console.log('🔍 检查数据库状态...\n')

    // 统计数据
    const users = await prisma.user.count()
    const conversations = await prisma.conversation.count()
    const messages = await prisma.message.count()
    const merchants = await prisma.merchant.count()
    const merchantContents = await prisma.merchantContent.count()

    console.log('📊 数据统计:')
    console.log(`  用户数: ${users}`)
    console.log(`  对话数: ${conversations}`)
    console.log(`  消息数: ${messages}`)
    console.log(`  商家数: ${merchants}`)
    console.log(`  商家内容数: ${merchantContents}\n`)

    // 检查对话数据
    if (conversations > 0) {
      const sampleConv = await prisma.conversation.findFirst({
        include: {
          messages: {
            take: 2,
            orderBy: { createdAt: 'desc' }
          },
          user: {
            select: {
              email: true,
              displayName: true,
              role: true
            }
          }
        }
      })
      console.log('💬 样本对话数据:')
      console.log(JSON.stringify(sampleConv, null, 2))
      console.log()
    } else {
      console.log('⚠️  没有对话数据\n')
    }

    // 检查商家数据
    if (merchants > 0) {
      const sampleMerchant = await prisma.merchant.findFirst({
        include: {
          contents: {
            take: 2,
            orderBy: { createdAt: 'desc' }
          },
          category: true,
          members: {
            include: {
              user: {
                select: {
                  email: true,
                  displayName: true
                }
              }
            }
          }
        }
      })
      console.log('🏢 样本商家数据:')
      console.log(JSON.stringify(sampleMerchant, null, 2))
      console.log()
    } else {
      console.log('⚠️  没有商家数据\n')
    }

    // 检查用户列表
    if (users > 0) {
      const userList = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          status: true,
          _count: {
            select: {
              conversations: true,
              messages: true,
              merchantMemberships: true
            }
          }
        }
      })
      console.log('👥 用户列表:')
      userList.forEach(user => {
        console.log(`  - ${user.email} (${user.displayName || '未命名'})`)
        console.log(`    角色: ${user.role}, 状态: ${user.status}`)
        console.log(`    对话: ${user._count.conversations}, 消息: ${user._count.messages}, 商家成员: ${user._count.merchantMemberships}`)
      })
      console.log()
    } else {
      console.log('⚠️  没有用户数据\n')
    }

  } catch (error) {
    console.error('❌ 错误:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDataStatus()
