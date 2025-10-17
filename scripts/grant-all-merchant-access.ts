#!/usr/bin/env tsx
/**
 * 将所有现有用户授予所有商家的访问权限。
 *
 * - 遍历 users × merchants
 * - 若尚未存在成员记录，则通过 ensureMerchantMembership 创建
 * - 输出统计信息，便于核对执行结果
 *
 * 说明：
 * - WSL/网络盘环境下 SQLite WAL 会引发 IO 错误，因此执行前显式禁用 WAL。
 */

async function main() {
  process.env.DISABLE_SQLITE_WAL = process.env.DISABLE_SQLITE_WAL ?? 'true'
  process.env.DISABLE_SQLITE_OPTIMIZATIONS =
    process.env.DISABLE_SQLITE_OPTIMIZATIONS ?? 'true'

  const [{ prisma }, { ensureMerchantMembership }] = await Promise.all([
    import('@/lib/prisma'),
    import('@/lib/auth/merchant-access')
  ])

  try {
    await ensureMerchantMembersTable(prisma)

    const [users, merchants] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, email: true, role: true }
      }),
      prisma.merchant.findMany({
        select: { id: true, name: true, status: true }
      })
    ])

    console.log('=== 批量授予商家访问权限 ===')
    console.log(`  用户数量: ${users.length}`)
    console.log(`  商家数量: ${merchants.length}`)

    if (!users.length || !merchants.length) {
      console.log('⚠️  缺少用户或商家，提前退出')
      return
    }

    const existingMemberships = await prisma.merchantMember.findMany({
      select: { merchantId: true, userId: true }
    })
    const membershipSet = new Set(
      existingMemberships.map(({ merchantId, userId }) => `${merchantId}:${userId}`)
    )

    console.log(`  已存在成员关系: ${membershipSet.size}`)

    let created = 0
    let skipped = membershipSet.size

    for (const merchant of merchants) {
      for (const user of users) {
        const key = `${merchant.id}:${user.id}`
        if (membershipSet.has(key)) {
          continue
        }

        await ensureMerchantMembership(user.id, merchant.id)
        membershipSet.add(key)
        created += 1
      }
    }

    const totalMemberships = membershipSet.size
    skipped = totalMemberships - created

    console.log('=== 授予完成 ===')
    console.log(`  新增成员记录: ${created}`)
    console.log(`  已存在的成员记录: ${skipped}`)
    console.log(`  总成员记录: ${totalMemberships}`)
  } finally {
    await prisma.$disconnect()
  }
}

async function ensureMerchantMembersTable(prisma: import('@prisma/client').PrismaClient) {
  const columns = (await prisma.$queryRawUnsafe<
    { name: string }[]
  >(`PRAGMA table_info('merchant_members')`)) || []

  const hasCreatedAt = columns.some((col) => col.name === 'createdAt')
  const hasUpdatedAt = columns.some((col) => col.name === 'updatedAt')

  if (hasCreatedAt && hasUpdatedAt) {
    return
  }

  console.log('  检测到 merchant_members 表结构落后，执行修复...')

  await prisma.$executeRawUnsafe(`PRAGMA foreign_keys=OFF`)

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "merchant_members" RENAME TO "merchant_members_legacy"`)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE "merchant_members" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "merchantId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'EDITOR',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "merchant_member_unique" UNIQUE("merchantId","userId"),
        FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)

    await prisma.$executeRawUnsafe(`
      INSERT INTO "merchant_members" ("id","merchantId","userId","role")
      SELECT "id","merchantId","userId","role" FROM "merchant_members_legacy"
    `)

    await prisma.$executeRawUnsafe(`DROP TABLE "merchant_members_legacy"`)

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "merchant_member_user_idx"
      ON "merchant_members"("userId")
    `)
  } finally {
    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys=ON`)
  }

  console.log('  表结构修复完成')
}

main()
  .catch(error => {
    console.error('❌ 授予失败:', error)
    process.exit(1)
  })
