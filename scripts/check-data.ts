/**
 * 检查数据库数据脚本
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkData() {
  try {
    // 检查商家分类
    const categories = await prisma.merchantCategory.findMany({
      include: {
        _count: {
          select: { merchants: true }
        }
      },
      orderBy: { sortOrder: 'asc' }
    })

    categories.forEach(category => {
      console.log(`分类: ${category.name}, 商家数量: ${category._count.merchants}`)
    })
    // 检查商家数据
    const merchants = await prisma.merchant.findMany({
      include: {
        category: true,
        _count: {
          select: { contents: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    merchants.forEach(merchant => {
      console.log(`商家: ${merchant.name}, 分类: ${merchant.category?.name || '未分类'}, 内容数: ${merchant._count.contents}`)
    })
    // 检查内容数据
    const contents = await prisma.merchantContent.findMany({
      include: {
        merchant: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    contents.forEach((content, index) => {
      console.log(`${index + 1}. ${content.merchant.name}: ${content.title.slice(0, 50)}${content.title.length > 50 ? '...' : ''}`)
    })

    // 总内容数量
    const totalContents = await prisma.merchantContent.count()
    // 统计信息
    const stats = await prisma.merchant.aggregate({
      _count: { id: true },
      _sum: {
        totalContentCount: true,
        totalDiggCount: true,
        totalCommentCount: true,
        totalCollectCount: true,
        totalShareCount: true
      }
    })

    console.log('\n=== 统计信息 ===');
    console.log(`总商家数: ${stats._count.id}`);
    console.log(`总内容数: ${totalContents}`);
    console.log(`总点赞数: ${stats._sum.totalDiggCount}`);
    console.log(`总评论数: ${stats._sum.totalCommentCount}`);
    console.log(`总收藏数: ${stats._sum.totalCollectCount}`);
    console.log(`总分享数: ${stats._sum.totalShareCount}`);

  } catch (error) {
    console.error('检查数据时出错:', error);
  } finally {
    await prisma.$disconnect()
  }
}

// 运行检查
if (require.main === module) {
  checkData()
}

export { checkData }