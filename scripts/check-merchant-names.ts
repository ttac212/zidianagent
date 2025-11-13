/**
 * 查询商家名称
 */

import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { prisma } from '@/lib/prisma'

async function main() {
  const merchantIds = [
    'cmhx9w1mp0008wtqsfj71nzn1',
    'cmhd4efw40000wtccoq115f0p'
  ]

  for (const id of merchantIds) {
    const merchant = await prisma.merchant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        uid: true
      }
    })

    if (merchant) {
      console.log(`\n商家ID: ${merchant.id}`)
      console.log(`商家名称: ${merchant.name}`)
      console.log(`商家UID: ${merchant.uid}`)
    } else {
      console.log(`\n商家ID ${id} 不存在`)
    }
  }

  await prisma.$disconnect()
}

main()
  .then(() => {
    console.log('\n✅ 查询完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 查询失败:', error)
    process.exit(1)
  })
