import { PrismaClient } from '@prisma/client'

// 全局变量声明（避免开发环境多次实例化）
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 检测数据库类型
const isDatabasePostgres = () => {
  const url = process.env.DATABASE_URL || ''
  return url.startsWith('postgres://') || url.startsWith('postgresql://')
}

// SQLite优化配置（仅在SQLite数据库时使用）
const sqliteOptimizations = [
  { sql: 'PRAGMA journal_mode=WAL', type: 'query', desc: 'WAL模式' },
  { sql: 'PRAGMA cache_size=-16000', type: 'execute', desc: '缓存大小' },
  { sql: 'PRAGMA synchronous=NORMAL', type: 'execute', desc: '同步模式' },
  { sql: 'PRAGMA busy_timeout=30000', type: 'query', desc: '繁忙超时' },
  { sql: 'PRAGMA temp_store=memory', type: 'execute', desc: '临时表存储' },
  { sql: 'PRAGMA wal_autocheckpoint=1000', type: 'query', desc: 'WAL检查点' },
  { sql: 'PRAGMA foreign_keys=ON', type: 'execute', desc: '外键约束' }
]

// 构建数据库URL（添加Serverless优化参数）
const getDatabaseUrl = () => {
  const baseUrl = process.env.DATABASE_URL || ''

  // 如果是PostgreSQL且未配置连接池参数，添加Serverless优化参数
  if (isDatabasePostgres() && !baseUrl.includes('connection_limit')) {
    const separator = baseUrl.includes('?') ? '&' : '?'
    // Serverless环境优化：
    // - connection_limit=1: 每个Serverless实例只保持1个连接
    // - pool_timeout=20: 连接池等待超时20秒
    // - connect_timeout=15: 建立连接超时15秒
    return `${baseUrl}${separator}connection_limit=1&pool_timeout=20&connect_timeout=15`
  }

  return baseUrl
}

// 创建 Prisma 客户端实例
// PostgreSQL 连接池配置通过 DATABASE_URL 参数控制
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  // 日志配置：开发环境显示查询，生产环境只显示错误
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'warn', 'error']
    : ['error'],

  // 数据源配置
  datasources: {
    db: {
      url: getDatabaseUrl()
    }
  },

  // 事务优化配置（增加超时时间适应Serverless冷启动）
  transactionOptions: {
    maxWait: 20000,        // 最大等待时间：20秒（适应冷启动）
    timeout: 120000        // 事务超时：120秒（适应长事务）
  }
})

// 数据库连接初始化和优化
async function initializeDatabase() {
  try {
    // 确保连接已建立
    await prisma.$connect()

    // 只在SQLite数据库时执行PRAGMA优化
    if (!isDatabasePostgres()) {
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
    } else {
      console.info('✅ PostgreSQL 数据库已连接')
    }

  } catch (error) {
    console.warn('⚠️  数据库初始化失败:', error)
  }
}

// 开发环境缓存实例
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// 延迟初始化数据库优化（避免阻塞模块加载）
// 使用 setImmediate 而不是 setTimeout，确保在事件循环的下一个tick执行
if (typeof setImmediate !== 'undefined') {
  setImmediate(() => initializeDatabase().catch(console.warn))
} else {
  setTimeout(() => initializeDatabase().catch(console.warn), 0)
}
