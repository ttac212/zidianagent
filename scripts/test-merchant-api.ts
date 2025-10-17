import { MerchantStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { hasMerchantAccess } from '@/lib/auth/merchant-access'

async function testMerchantAPI() {
  try {
    console.log('🔍 测试商家API权限...\n')

    // 1. 获取一个测试用户
    const user = await prisma.user.findFirst({
      where: {
        status: 'ACTIVE'
      },
      select: {
        id: true,
        email: true,
        role: true
      }
    })

    if (!user) {
      console.log('❌ 没有找到活跃用户')
      return
    }

    console.log(`✓ 测试用户: ${user.email} (${user.role})`)
    console.log(`  用户ID: ${user.id}\n`)

    // 2. 获取一个商家
    const merchant = await prisma.merchant.findFirst({
      where: {
        status: MerchantStatus.ACTIVE,
        totalContentCount: { gt: 0 }
      },
      select: {
        id: true,
        name: true,
        totalContentCount: true,
        _count: {
          select: { members: true }
        }
      }
    })

    if (!merchant) {
      console.log('❌ 没有找到活跃商家')
      return
    }

    console.log(`✓ 测试商家: ${merchant.name}`)
    console.log(`  商家ID: ${merchant.id}`)
    console.log(`  内容数: ${merchant.totalContentCount}`)
    console.log(`  成员数: ${merchant._count.members}\n`)

    // 3. 检查用户是否有访问权限
    const hasAccess = await hasMerchantAccess(user.id, merchant.id, user.role)
    console.log(`✓ 权限检查: ${hasAccess ? '✅ 有权限' : '❌ 无权限'}\n`)

    // 4. 检查成员记录
    const membership = await prisma.merchantMember.findUnique({
      where: {
        merchantId_userId: {
          merchantId: merchant.id,
          userId: user.id
        }
      },
      select: {
        id: true,
        role: true,
        createdAt: true
      }
    })

    if (membership) {
      console.log('✓ 成员记录存在:')
      console.log(`  角色: ${membership.role}`)
      console.log(`  创建时间: ${membership.createdAt}\n`)
    } else {
      console.log('❌ 成员记录不存在\n')
    }

    // 5. 模拟API查询条件（非管理员）
    if (user.role !== 'ADMIN') {
      console.log('📊 模拟API查询（非管理员用户）...')
      const where = {
        status: { in: [MerchantStatus.ACTIVE] },
        members: {
          some: {
            userId: user.id
          }
        }
      }

      const merchants = await prisma.merchant.findMany({
        where,
        select: {
          id: true,
          name: true,
          totalContentCount: true
        },
        take: 5
      })

      console.log(`✓ 可访问的商家数: ${merchants.length}`)
      merchants.forEach(m => {
        console.log(`  - ${m.name} (${m.totalContentCount}条内容)`)
      })
    } else {
      console.log('📊 管理员用户，可访问所有商家')
    }

    // 6. 测试商家详情查询
    console.log('\n📝 测试商家详情查询...')
    const merchantDetail = await prisma.merchant.findUnique({
      where: { id: merchant.id },
      include: {
        category: true,
        contents: {
          orderBy: {
            publishedAt: 'desc'
          },
          take: 3
        },
        _count: {
          select: { contents: true }
        }
      }
    })

    if (merchantDetail) {
      console.log('✓ 商家详情查询成功:')
      console.log(`  名称: ${merchantDetail.name}`)
      console.log(`  分类: ${merchantDetail.category?.name || '未分类'}`)
      console.log(`  总内容数: ${merchantDetail._count.contents}`)
      console.log(`  返回内容数: ${merchantDetail.contents.length}`)
      
      if (merchantDetail.contents.length > 0) {
        console.log(`  第一条内容: ${merchantDetail.contents[0].title || '无标题'}`)
      }
    }

    console.log('\n✅ 测试完成！')

  } catch (error) {
    console.error('❌ 测试失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testMerchantAPI()
