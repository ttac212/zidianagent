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
      `)
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
      }\n`)
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

    :')
    contents.forEach((content, index) => {
      }${content.title.length > 50 ? '...' : ''}`)
      }\n`)
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

    } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

// 运行检查
if (require.main === module) {
  checkData()
}

export { checkData }