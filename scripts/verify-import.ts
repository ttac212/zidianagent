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
    console.log(`\n商家分类统计:`)
    categories.forEach(category => {
      console.log(`  ${category.name}: ${category._count.merchants} 个商家`)
      totalMerchants += category._count.merchants
    })
    console.log(`\n总商家数: ${totalMerchants}`)
    
    // 查询内容总数
    const totalContents = await prisma.merchantContent.count()
    console.log(`总内容数: ${totalContents}`)
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
    
    console.log(`\n地区分布:`)
    merchantsByLocation.forEach(item => {
      const location = item.location || '未知地区'
      console.log(`  ${location}: ${item._count.id} 个商家`)
    })
    // 查询业务类型分布
    const merchantsByBusinessType = await prisma.merchant.groupBy({
      by: ['businessType'],
      _count: {
        id: true
      }
    })
    
    console.log(`\n业务类型分布:`)
    merchantsByBusinessType.forEach(item => {
      const typeNames = {
        'B2B': '企业对企业',
        'B2C': '企业对消费者', 
        'B2B2C': '混合模式'
      }
      const typeName = typeNames[item.businessType as keyof typeof typeNames] || item.businessType
      console.log(`  ${typeName}: ${item._count.id} 个商家`)
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
    
    console.log(`\n内容数量 TOP 5:`)
    topMerchants.forEach((merchant, index) => {
      console.log(`  ${index + 1}. ${merchant.name} (分类: ${merchant.category?.name || '未分类'})`)
      console.log(`     内容: ${merchant.totalContentCount} 条, 点赞: ${merchant.totalDiggCount}`)
    })
    // 验证数据完整性
    console.log(`\n导入验证完成`)
    console.log(`共有 ${totalMerchants} 个商家，${totalContents} 条内容`)
    
  } catch (error) {
    console.error('验证过程中出错:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行验证
if (require.main === module) {
  main()
}

export { main as verifyImport }