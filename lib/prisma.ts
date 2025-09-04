import { PrismaClient } from '@prisma/client'

// 全局变量声明（避免开发环境多次实例化）
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 创建 Prisma 客户端实例
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['query'], // 开发环境显示SQL查询日志
})

// 开发环境缓存实例
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma