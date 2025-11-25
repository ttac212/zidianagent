#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'

async function verifyUsers() {
  const prisma = new PrismaClient()

  try {
    const count = await prisma.user.count()
    console.log(`✅ PostgreSQL中的用户总数: ${count}`)

    const users = await prisma.user.findMany({
      select: {
        email: true,
        displayName: true,
        role: true,
      },
      take: 10,
      orderBy: { createdAt: 'desc' }
    })

    console.log('\n📋 用户列表:')
    users.forEach((u, i) => {
      console.log(`${i + 1}. ${u.email} - ${u.displayName || '未设置'} (${u.role})`)
    })
  } finally {
    await prisma.$disconnect()
  }
}

verifyUsers()
