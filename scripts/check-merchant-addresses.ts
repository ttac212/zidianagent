/**
 * 查询现有商家的地址信息
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 查询现有商家的地址信息...\n')

  const merchants = await prisma.merchant.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      location: true,
      address: true,
      contactInfo: true,
    },
  })

  console.log(`📊 找到 ${merchants.length} 个商家\n`)

  merchants.forEach((merchant, index) => {
    const contactInfo = merchant.contactInfo as any
    console.log(`${index + 1}. ${merchant.name}`)
    console.log(`   location: ${merchant.location || '(空)'}`)
    console.log(`   address: ${merchant.address || '(空)'}`)
    console.log(`   ip_location: ${contactInfo?.ip_location || '(空)'}`)
    console.log(`   province: ${contactInfo?.province || '(空)'}`)
    console.log(`   city: ${contactInfo?.city || '(空)'}`)
    console.log(`   district: ${contactInfo?.district || '(空)'}`)
    console.log('')
  })
}

main()
  .catch((error) => {
    console.error('❌ 查询失败:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
