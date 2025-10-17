import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyMerchantAccess() {
  try {
    console.log('🔍 开始校验商家访问权限...\n')

    // 1. 统计用户数量
    const userCount = await prisma.user.count()
    console.log(`✓ 用户总数: ${userCount}`)

    // 2. 统计商家数量
    const merchantCount = await prisma.merchant.count()
    console.log(`✓ 商家总数: ${merchantCount}`)

    // 3. 统计成员关系数量
    const memberCount = await prisma.merchantMember.count()
    console.log(`✓ 成员关系记录数: ${memberCount}`)

    // 4. 计算期望的记录数
    const expectedCount = userCount * merchantCount
    console.log(`✓ 期望记录数: ${expectedCount} (${userCount} 用户 × ${merchantCount} 商家)`)

    // 5. 检查是否匹配
    if (memberCount === expectedCount) {
      console.log('\n✅ 校验通过！所有用户都可以访问所有商家。')
    } else {
      console.log(`\n⚠️  警告：记录数不匹配！`)
      console.log(`   实际记录: ${memberCount}`)
      console.log(`   期望记录: ${expectedCount}`)
      console.log(`   差异: ${expectedCount - memberCount}`)
    }

    // 6. 检查每个用户的商家访问数
    console.log('\n📊 用户商家访问统计:')
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        _count: {
          select: { merchantMemberships: true }
        }
      },
      orderBy: { email: 'asc' }
    })

    let allUsersHaveFullAccess = true
    for (const user of users) {
      const accessCount = user._count.merchantMemberships
      const hasFullAccess = accessCount === merchantCount
      const status = hasFullAccess ? '✓' : '✗'
      
      console.log(`  ${status} ${user.email}: ${accessCount}/${merchantCount} 商家`)
      
      if (!hasFullAccess) {
        allUsersHaveFullAccess = false
      }
    }

    // 7. 检查每个商家的成员数
    console.log('\n📊 商家成员统计（前10个）:')
    const merchants = await prisma.merchant.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: { members: true }
        }
      },
      orderBy: { name: 'asc' },
      take: 10
    })

    let allMerchantsHaveFullAccess = true
    for (const merchant of merchants) {
      const memberCountForMerchant = merchant._count.members
      const hasFullAccess = memberCountForMerchant === userCount
      const status = hasFullAccess ? '✓' : '✗'
      
      console.log(`  ${status} ${merchant.name}: ${memberCountForMerchant}/${userCount} 成员`)
      
      if (!hasFullAccess) {
        allMerchantsHaveFullAccess = false
      }
    }

    // 8. 最终结论
    console.log('\n' + '='.repeat(60))
    if (allUsersHaveFullAccess && allMerchantsHaveFullAccess && memberCount === expectedCount) {
      console.log('✅ 最终结论：所有用户可以访问所有商家！')
    } else {
      console.log('❌ 最终结论：访问权限配置不完整，需要修复。')
      
      if (!allUsersHaveFullAccess) {
        console.log('   - 部分用户缺少商家访问权限')
      }
      if (!allMerchantsHaveFullAccess) {
        console.log('   - 部分商家缺少成员关系')
      }
      if (memberCount !== expectedCount) {
        console.log('   - 成员关系记录数不足')
      }
    }
    console.log('='.repeat(60))

  } catch (error) {
    console.error('❌ 校验失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verifyMerchantAccess()
