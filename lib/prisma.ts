import { PrismaClient } from '@prisma/client'

// 全局变量声明（避免开发环境多次实例化）
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// SQLite优化配置（修复版 - 区分查询和执行类型）
const sqliteOptimizations = [
  { sql: 'PRAGMA journal_mode=WAL', type: 'query', desc: 'WAL模式' },
  { sql: 'PRAGMA cache_size=-16000', type: 'execute', desc: '缓存大小' },
  { sql: 'PRAGMA synchronous=NORMAL', type: 'execute', desc: '同步模式' },
  { sql: 'PRAGMA busy_timeout=30000', type: 'query', desc: '繁忙超时' },
  { sql: 'PRAGMA temp_store=memory', type: 'execute', desc: '临时表存储' },
  { sql: 'PRAGMA wal_autocheckpoint=1000', type: 'query', desc: 'WAL检查点' },
  { sql: 'PRAGMA foreign_keys=ON', type: 'execute', desc: '外键约束' }
]

// 创建 Prisma 客户端实例
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  // 日志配置：开发环境显示查询，生产环境只显示错误
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'warn', 'error'] 
    : ['error'],
  
  // 数据源配置
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },

  // 事务优化配置（优化超时设置）
  transactionOptions: {
    maxWait: 5000,         // 最大等待时间：5秒（减少锁等待）
    timeout: 45000         // 事务超时：45秒（匹配API超时）
    // 移除isolationLevel - SQLite不支持ReadCommitted
  }
})

// 数据库连接初始化和优化
async function initializeDatabase() {
  try {
    // 执行SQLite优化配置（区分查询和执行类型）
    for (const opt of sqliteOptimizations) {
      try {
        if (opt.type === 'query') {
          await prisma.$queryRawUnsafe(opt.sql)
        } else {
          await prisma.$executeRawUnsafe(opt.sql)
        }
      } catch (pragmaError) {
        console.warn(`⚠️  ${opt.desc} 配置失败:`, (pragmaError as Error).message)
      }
    }

    // ✅ 数据库优化配置已应用
  } catch (error) {
    console.warn('⚠️  数据库优化配置失败，使用默认设置:', error)
  }
}

// 开发环境缓存实例
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  // 开发环境立即初始化
  initializeDatabase().catch(console.warn)
} else {
  // 生产环境延迟初始化
  setTimeout(() => initializeDatabase().catch(console.warn), 1000)
}