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
      console.info(`分类: ${category.name}, 商家数量: ${category._count.merchants}`)
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
      console.info(`商家: ${merchant.name}, 分类: ${merchant.category?.name || '未分类'}, 内容数: ${merchant._count.contents}`)
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
      console.info(`${index + 1}. ${content.merchant.name}: ${content.title.slice(0, 50)}${content.title.length > 50 ? '...' : ''}`)
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

    console.info('\n=== 统计信息 ===');
    console.info(`总商家数: ${stats._count.id}`);
    console.info(`总内容数: ${totalContents}`);
    console.info(`总点赞数: ${stats._sum.totalDiggCount}`);
    console.info(`总评论数: ${stats._sum.totalCommentCount}`);
    console.info(`总收藏数: ${stats._sum.totalCollectCount}`);
    console.info(`总分享数: ${stats._sum.totalShareCount}`);

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