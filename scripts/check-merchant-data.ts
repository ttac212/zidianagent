import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkMerchantData() {
  try {
    console.log('🔍 检查商家数据...\n')

    // 1. 检查商家数量
    const merchantCount = await prisma.merchant.count()
    console.log(`✓ 商家总数: ${merchantCount}`)

    // 2. 检查商家详情（前5个）
    const merchants = await prisma.merchant.findMany({
      take: 5,
      include: {
        category: true,
        _count: {
          select: {
            contents: true,
            members: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log('\n📊 商家详情示例（前5个）:')
    for (const merchant of merchants) {
      console.log(`\n  商家ID: ${merchant.id}`)
      console.log(`  名称: ${merchant.name}`)
      console.log(`  UID: ${merchant.uid}`)
      console.log(`  位置: ${merchant.location || '未设置'}`)
      console.log(`  分类: ${merchant.category?.name || '未分类'}`)
      console.log(`  业务类型: ${merchant.businessType}`)
      console.log(`  状态: ${merchant.status}`)
      console.log(`  内容数量: ${merchant._count.contents}`)
      console.log(`  成员数量: ${merchant._count.members}`)
      console.log(`  总点赞数: ${merchant.totalDiggCount}`)
      console.log(`  总评论数: ${merchant.totalCommentCount}`)
      console.log(`  总收藏数: ${merchant.totalCollectCount}`)
      console.log(`  总分享数: ${merchant.totalShareCount}`)
      console.log(`  创建时间: ${merchant.createdAt}`)
    }

    // 3. 检查商家内容
    console.log('\n📝 检查商家内容数据...')
    const contentCount = await prisma.merchantContent.count()
    console.log(`  总内容数: ${contentCount}`)

    if (contentCount > 0) {
      const sampleContent = await prisma.merchantContent.findFirst({
        include: {
          merchant: {
            select: { name: true }
          }
        }
      })
      
      if (sampleContent) {
        console.log('\n  内容示例:')
        console.log(`    标题: ${sampleContent.title}`)
        console.log(`    商家: ${sampleContent.merchant.name}`)
        console.log(`    类型: ${sampleContent.contentType}`)
        console.log(`    点赞: ${sampleContent.diggCount}`)
        console.log(`    评论: ${sampleContent.commentCount}`)
        console.log(`    发布时间: ${sampleContent.publishedAt}`)
      }
    }

    // 4. 检查成员关系
    console.log('\n👥 检查成员关系...')
    const memberCount = await prisma.merchantMember.count()
    console.log(`  总成员记录: ${memberCount}`)

    // 5. 检查每个商家的成员数
    const merchantsWithMembers = await prisma.merchant.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: { members: true }
        }
      },
      take: 10,
      orderBy: { name: 'asc' }
    })

    console.log('\n  商家成员统计（前10个）:')
    for (const merchant of merchantsWithMembers) {
      console.log(`    ${merchant.name}: ${merchant._count.members} 个成员`)
    }

    // 6. 统计分析
    console.log('\n📈 统计分析:')
    const stats = await prisma.merchant.aggregate({
      _sum: {
        totalContentCount: true,
        totalDiggCount: true,
        totalCommentCount: true,
        totalCollectCount: true,
        totalShareCount: true
      },
      _avg: {
        totalContentCount: true,
        totalDiggCount: true,
        totalCommentCount: true
      }
    })

    console.log(`  总内容数: ${stats._sum.totalContentCount || 0}`)
    console.log(`  总点赞数: ${stats._sum.totalDiggCount || 0}`)
    console.log(`  总评论数: ${stats._sum.totalCommentCount || 0}`)
    console.log(`  总收藏数: ${stats._sum.totalCollectCount || 0}`)
    console.log(`  总分享数: ${stats._sum.totalShareCount || 0}`)
    console.log(`  平均内容数/商家: ${Math.round(stats._avg.totalContentCount || 0)}`)
    console.log(`  平均点赞数/商家: ${Math.round(stats._avg.totalDiggCount || 0)}`)
    console.log(`  平均评论数/商家: ${Math.round(stats._avg.totalCommentCount || 0)}`)

    console.log('\n✅ 数据检查完成！')

  } catch (error) {
    console.error('❌ 检查失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkMerchantData()
