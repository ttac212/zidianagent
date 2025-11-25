#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'

async function checkEmailVerified() {
  const prisma = new PrismaClient()

  try {
    const users = await prisma.user.findMany({
      select: {
        email: true,
        emailVerified: true,
        displayName: true,
        role: true,
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log('📊 用户邮箱验证状态:\n')

    const verified = users.filter(u => u.emailVerified !== null)
    const unverified = users.filter(u => u.emailVerified === null)

    console.log(`✅ 已验证: ${verified.length}`)
    console.log(`❌ 未验证: ${unverified.length}\n`)

    if (unverified.length > 0) {
      console.log('未验证的用户列表:')
      unverified.forEach((u, i) => {
        console.log(`${i + 1}. ${u.email} - ${u.displayName || '未设置'} (${u.role})`)
      })
    }
  } finally {
    await prisma.$disconnect()
  }
}

checkEmailVerified()
