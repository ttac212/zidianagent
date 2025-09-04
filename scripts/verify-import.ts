/**
 * 验证商家数据导入结果
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    // 查询商家分类统计
    const categories = await prisma.merchantCategory.findMany({
      include: {
        _count: {
          select: { merchants: true }
        }
      },
      orderBy: { sortOrder: 'asc' }
    })
    
    let totalMerchants = 0
    categories.forEach(category => {
      totalMerchants += category._count.merchants
    })
    // 查询内容总数
    const totalContents = await prisma.merchantContent.count()
    // 查询按地区分布的商家
    const merchantsByLocation = await prisma.merchant.groupBy({
      by: ['location'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    })
    
    merchantsByLocation.forEach(item => {
      })
    // 查询业务类型分布
    const merchantsByBusinessType = await prisma.merchant.groupBy({
      by: ['businessType'],
      _count: {
        id: true
      }
    })
    
    merchantsByBusinessType.forEach(item => {
      const typeNames = {
        'B2B': '企业对企业',
        'B2C': '企业对消费者', 
        'B2B2C': '混合模式'
      }
      })
    // 查询内容最多的前5家商家
    const topMerchants = await prisma.merchant.findMany({
      select: {
        name: true,
        totalContentCount: true,
        totalDiggCount: true,
        category: {
          select: { name: true }
        }
      },
      orderBy: { totalContentCount: 'desc' },
      take: 5
    })
    
    topMerchants.forEach((merchant, index) => {
      `)
      })
    // 验证数据完整性
    } catch (error) {
    } finally {
    await prisma.$disconnect()
  }
}

// 运行验证
if (require.main === module) {
  main()
}

export { main as verifyImport }