# 数据库实现详细调研报告

## 目录
1. [数据库架构概述](#数据库架构概述)
2. [数据模型设计](#数据模型设计)
3. [数据库连接管理](#数据库连接管理)
4. [数据库操作模式](#数据库操作模式)
5. [事务处理策略](#事务处理策略)
6. [性能优化措施](#性能优化措施)
7. [数据备份与恢复](#数据备份与恢复)
8. [问题与建议](#问题与建议)

## 数据库架构概述

### 技术栈
- **ORM框架**: Prisma 6.14.0
- **开发数据库**: SQLite (文件模式)
- **生产数据库**: PostgreSQL (推荐)
- **查询构建**: Prisma Client
- **数据建模**: Prisma Schema

### 架构特点
1. **单例模式**: 通过全局变量避免开发环境多次实例化
2. **环境区分**: 开发环境与生产环境使用不同的优化策略
3. **异步初始化**: 生产环境延迟初始化，开发环境立即初始化
4. **日志配置**: 开发环境记录查询日志，生产环境仅记录错误

## 数据模型设计

### 核心模型结构

#### 1. 认证系统模型 (NextAuth)
```prisma
- Account: OAuth账户信息
- Session: 用户会话
- VerificationToken: 验证令牌
```

#### 2. 用户系统模型
```prisma
User {
  - 基本信息: id, email, username, displayName, avatar
  - 角色权限: role (ADMIN/USER/GUEST), status
  - 用量配额: monthlyTokenLimit, currentMonthUsage, totalTokenUsed
  - 邀请码: inviteCodeId (关联)
  - 时间戳: createdAt, updatedAt, lastActiveAt
}

InviteCode {
  - 邀请码信息: code (唯一), description
  - 使用限制: maxUses, usedCount, isActive, expiresAt
  - 权限配置: defaultRole, monthlyTokenLimit
  - 关联用户: usedBy[]
}
```

#### 3. 聊天系统模型
```prisma
Conversation {
  - 基本信息: id, title, userId
  - 模型配置: modelId, temperature, maxTokens, contextAware
  - 统计信息: messageCount, totalTokens
  - 时间戳: createdAt, updatedAt, lastMessageAt
  - 关联: messages[]
}

Message {
  - 消息内容: role, content, originalContent
  - Token统计: promptTokens, completionTokens, totalTokens
  - 模型信息: modelId, temperature, finishReason
  - 元数据: metadata (JSON)
}
```

#### 4. 文档管理模型
```prisma
Document {
  - 内容信息: title, content, excerpt
  - 分类标签: categoryId, tags (JSON)
  - 外部资源: source, externalUrl, fileUrl, fileType
  - 同步状态: syncStatus, lastSyncAt
  - 版本控制: version, isPublished, isDeleted
}

DocumentCategory {
  - 分类信息: name, description, color, sortOrder
  - 关联文档: documents[]
}
```

#### 5. 商家数据模型
```prisma
Merchant {
  - 商家信息: uid (唯一), name, description
  - 分类位置: categoryId, location, address
  - 业务类型: businessType (B2B/B2C/B2B2C)
  - 社交统计: totalDiggCount, totalCommentCount等
  - 数据采集: dataSource, lastCollectedAt
}

MerchantContent {
  - 内容信息: externalId, title, content, transcript
  - 内容类型: contentType (VIDEO/ARTICLE等)
  - 社交指标: diggCount, commentCount, collectCount
  - 标签: tags, textExtra (JSON)
}
```

#### 6. 统计与监控模型
```prisma
UsageStats {
  - 用户统计: userId, date
  - 模型统计: modelId, modelProvider
  - API统计: apiCalls, successfulCalls, failedCalls
  - Token统计: promptTokens, completionTokens, totalTokens
  - 唯一约束: @@unique([userId, date, modelId])
}

UserSession {
  - 会话信息: sessionId, ipAddress, userAgent
  - 活跃状态: isActive, lastPing
}
```

### 数据模型特点

1. **多租户设计**: 通过userId实现数据隔离
2. **软删除支持**: 使用status字段而非物理删除
3. **JSON字段使用**: 灵活存储元数据和标签
4. **唯一约束设计**: 防止数据重复，确保一致性
5. **索引优化**: 针对常用查询添加复合索引

## 数据库连接管理

### 连接池配置 (`lib/prisma.ts`)

```typescript
export const prisma = new PrismaClient({
  // 日志配置
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'warn', 'error'] 
    : ['error'],
  
  // 事务配置
  transactionOptions: {
    maxWait: 5000,              // 最大等待时间：5秒
    timeout: 45000,             // 事务超时：45秒
    isolationLevel: 'ReadCommitted'  // 隔离级别
  }
})
```

### SQLite优化配置

```javascript
const sqliteOptimizations = [
  { sql: 'PRAGMA journal_mode=WAL', type: 'query', desc: 'WAL模式' },
  { sql: 'PRAGMA cache_size=-16000', type: 'execute', desc: '缓存大小' },
  { sql: 'PRAGMA synchronous=NORMAL', type: 'execute', desc: '同步模式' },
  { sql: 'PRAGMA busy_timeout=30000', type: 'query', desc: '繁忙超时' },
  { sql: 'PRAGMA temp_store=memory', type: 'execute', desc: '临时表存储' },
  { sql: 'PRAGMA wal_autocheckpoint=1000', type: 'query', desc: 'WAL检查点' },
  { sql: 'PRAGMA foreign_keys=ON', type: 'execute', desc: '外键约束' }
]
```

### 连接管理特点

1. **单例模式**: 防止开发环境热重载导致连接泄漏
2. **延迟初始化**: 生产环境延迟1秒初始化，开发环境立即初始化
3. **错误容错**: 单个PRAGMA配置失败不影响其他优化，整体失败使用默认设置
4. **WAL模式**: 提高SQLite并发性能
5. **区分查询类型**: $queryRawUnsafe和$executeRawUnsafe根据PRAGMA类型分别使用

## 数据库操作模式

### 1. 基本CRUD操作

#### 查询操作示例 (`app/api/users/route.ts`)
```typescript
// 分页查询
const users = await prisma.user.findMany({
  where: {
    OR: [
      { email: { contains: search } },
      { displayName: { contains: search } }
    ]
  },
  select: {
    id: true,
    email: true,
    _count: {
      select: { conversations: true }
    }
  },
  orderBy: { createdAt: 'desc' },
  skip: (page - 1) * limit,
  take: limit,
})
```

#### 创建操作示例
```typescript
const user = await prisma.user.create({
  data: {
    email,
    username,
    role,
    monthlyTokenLimit,
  },
  select: {
    id: true,
    email: true,
    // 选择性返回字段
  }
})
```

### 2. 关联查询

```typescript
// 包含关联数据
const conversation = await prisma.conversation.findFirst({
  where: { 
    id: conversationId,
    userId: userId 
  },
  include: {
    user: {
      select: {
        id: true,
        status: true,
        currentMonthUsage: true,
        monthlyTokenLimit: true
      }
    }
  }
})
```

### 3. 批量操作

#### Upsert批量更新 (`scripts/import-merchant-data.ts`)
```typescript
const merchant = await prisma.merchant.upsert({
  where: { uid: merchantUID },
  update: {
    name: merchantName,
    totalContentCount: csvData.length,
    // 增量更新统计
  },
  create: {
    uid: merchantUID,
    name: merchantName,
    // 初始创建数据
  }
})
```

### 4. 异步非阻塞操作

#### 使用量统计异步记录 (`lib/utils/usage-stats-helper.ts`)
```typescript
export function recordUsageAsync(
  prisma: PrismaClient,
  record: UsageRecord
): void {
  // Promise异步执行，不等待结果
  Promise.resolve().then(async () => {
    try {
      await recordUsageInternal(prisma, record)
    } catch (error) {
      // 静默处理错误，不影响主流程
      if (process.env.NODE_ENV === 'development') {
        console.warn('使用量统计记录失败:', error)
      }
    }
  })
}
```

## 事务处理策略

### 1. 显式事务处理

#### 使用量统计事务 (`lib/utils/usage-stats-helper.ts`)
```typescript
await prisma.$transaction(
  [
    // 1. 更新总量统计
    prisma.usageStats.upsert({
      where: { userId_date_modelId: { /* ... */ } },
      update: { /* 增量更新 */ },
      create: { /* 初始创建 */ }
    }),
    
    // 2. 更新按模型统计
    prisma.usageStats.upsert({
      where: { userId_date_modelId: { /* ... */ } },
      update: { /* 增量更新 */ },
      create: { /* 初始创建 */ }
    })
  ],
  {
    maxWait: 15000,  // 15秒等待
    timeout: 45000,  // 45秒超时
    isolationLevel: 'Serializable'  // SQLite下序列化隔离
  }
)
```

### 2. 隐式事务（单操作）

```typescript
// Prisma自动将单个操作包装在事务中
await prisma.message.create({
  data: {
    conversationId,
    role: 'ASSISTANT',
    content: assistantContent,
    // ...
  }
})
```

### 3. 事务策略特点

1. **长超时设置**: 45秒超时匹配API超时
2. **隔离级别选择**: 
   - 全局默认: ReadCommitted（提升并发性能）
   - 使用量统计: Serializable（SQLite下确保一致性）
   - 可根据具体事务需求覆盖默认配置
3. **批量操作优化**: 使用事务批量处理相关更新
4. **错误隔离**: 事务失败不影响主流程

## 性能优化措施

### 1. 数据库级优化

#### SQLite优化
- **WAL模式**: 写前日志，提高并发性能，允许读写并发
- **内存缓存**: 16MB缓存（-16000 pages，负值表示KB）
- **内存临时表**: 减少磁盘IO，加速临时操作
- **异步同步**: NORMAL模式平衡性能与安全
- **繁忙超时**: 30秒超时避免锁竞争导致的快速失败

#### 索引优化
```prisma
// 复合索引示例
@@index([userId, updatedAt])
@@index([isActive, expiresAt])
@@unique([userId, date, modelId])
```

### 2. 应用级优化

#### 查询优化
```typescript
// 使用select减少数据传输
select: {
  id: true,
  email: true,
  _count: {
    select: { conversations: true }
  }
}

// 避免N+1查询问题
include: {
  user: true,  // 一次性加载关联数据
}
```

#### 异步处理
```typescript
// 非关键操作异步执行
recordUsageAsync(prisma, {
  userId: userId,
  modelId: useModel,
  // 不阻塞主响应
})
```

### 3. 缓存策略

#### 连接缓存
```typescript
// 开发环境缓存Prisma实例
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

### 4. 批处理优化

```typescript
// 批量upsert减少数据库往返
const operations = data.map(item => 
  prisma.model.upsert({
    where: { /* ... */ },
    update: { /* ... */ },
    create: { /* ... */ }
  })
)
await prisma.$transaction(operations)
```

## 数据备份与恢复

### 备份系统架构 (`scripts/db/backup-database.js`)

#### 备份类型
1. **完整备份**: 数据+结构
2. **结构备份**: 仅数据库schema
3. **数据备份**: 仅数据内容

#### 备份特性
- **自动时间戳**: `sqlite_full_2024-01-01T12-00-00`
- **可选压缩**: gzip压缩减少存储空间
- **自动清理**: 默认保留7天备份
- **验证机制**: 备份后自动验证完整性

#### 备份流程
```javascript
class DatabaseBackup {
  async execute() {
    // 1. 创建备份目录
    await this.ensureBackupDirectory()
    
    // 2. 执行备份
    const backupFile = await this.performBackup()
    
    // 3. 验证备份
    await this.verifyBackup(backupFile)
    
    // 4. 清理过期备份
    await this.cleanupOldBackups()
    
    // 5. 生成备份报告
    const report = await this.generateBackupReport(backupFile)
  }
}
```

### 恢复策略

1. **SQLite恢复**: 直接替换.db文件
2. **PostgreSQL恢复**: 使用pg_restore
3. **增量恢复**: 基于时间戳的增量数据恢复

**注意**: 备份脚本（`scripts/db/backup-database.js`）中存在代码格式问题，使用前需要检查和修复

## 问题与建议

### 当前问题

1. **缺少数据库迁移历史**
   - 现状: 项目主要使用`db push`直接同步，`prisma/migrations`目录不存在
   - 风险: 生产环境难以追踪schema变更历史
   - 建议: 启用Prisma Migrate创建和管理迁移文件

2. **事务隔离级别不一致**
   - 现状: SQLite使用Serializable，其他使用ReadCommitted
   - 影响: 可能导致不同环境行为差异
   - 建议: 统一事务隔离级别配置

3. **缺少数据库监控**
   - 现状: 无连接池监控、慢查询监控
   - 建议: 添加数据库性能监控指标

4. **批量操作优化不足**
   - 现状: 商家数据导入逐条处理
   - 建议: 使用createMany批量插入

### 优化建议

#### 1. 启用Prisma Migrate
```bash
# 初始化迁移
npx prisma migrate dev --name init

# 生产部署
npx prisma migrate deploy
```

#### 2. 添加查询性能监控
```typescript
prisma.$use(async (params, next) => {
  const before = Date.now()
  const result = await next(params)
  const after = Date.now()
  
  if (after - before > 1000) {
    console.warn(`慢查询: ${params.model}.${params.action} 耗时 ${after - before}ms`)
  }
  
  return result
})
```

#### 3. 实现连接池监控
```typescript
// 定期检查连接状态
setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (error) {
    console.error('数据库连接异常:', error)
  }
}, 30000)
```

#### 4. 批量操作优化
```typescript
// 使用createMany替代循环create
await prisma.merchantContent.createMany({
  data: contents,
  skipDuplicates: true
})
```

#### 5. 添加读写分离支持
```typescript
// 为读操作使用只读副本
const readPrisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_READ_URL }
  }
})
```

## 总结

项目数据库实现具有以下特点：

### 优势
1. **完善的数据模型设计**: 覆盖认证、聊天、文档、商家等业务
2. **性能优化充分**: SQLite优化配置、索引设计合理
3. **事务处理规范**: 明确的事务边界和隔离级别
4. **备份机制完善**: 自动化备份和恢复流程
5. **异步处理设计**: 非关键操作异步化，提升响应速度

### 待改进
1. 缺少迁移版本管理
2. 批量操作可进一步优化
3. 需要添加数据库监控
4. 考虑引入缓存层（Redis）
5. 生产环境需要读写分离

### 技术债务
1. 直接使用`db push`而非迁移
2. 部分API缺少事务保护
3. 错误处理不够统一
4. 缺少数据库性能基准测试
5. 备份脚本存在代码格式问题需要修复

### 数据完整性保障
1. **外键约束**: 通过PRAGMA foreign_keys=ON启用
2. **唯一约束**: 防止数据重复（如userId_date_modelId组合）
3. **级联删除**: onDelete: Cascade确保关联数据一致性
4. **数据验证**: 应用层进行输入验证，数据库层通过约束保证

通过以上调研，项目数据库架构基本合理，但在生产环境部署前需要重点关注迁移管理、性能监控和高可用性配置。