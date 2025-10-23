import { prisma } from '../lib/prisma'

async function main() {
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  )

  console.log('tables', tables)

  const merchants = await prisma.$queryRawUnsafe<Array<{ status: string, count: number }>>(
    "SELECT status, COUNT(1) as count FROM merchants GROUP BY status"
  ).catch(error => {
    console.error('merchant stats error', error)
    return []
  })

  console.log('merchant stats', merchants)

  await prisma.$disconnect()
}

main().catch(error => {
  console.error('fatal', error)
  prisma.$disconnect()
})
