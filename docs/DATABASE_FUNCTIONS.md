# 数据库函数完整文档

## 目录
1. [核心连接管理函数](#核心连接管理函数)
2. [数据库CRUD操作函数](#数据库crud操作函数)
3. [事务和统计函数](#事务和统计函数)
4. [数据完整性检查函数](#数据完整性检查函数)
5. [数据导入导出函数](#数据导入导出函数)
6. [安全和认证函数](#安全和认证函数)
7. [维护和诊断函数](#维护和诊断函数)
8. [备份恢复函数](#备份恢复函数)

## 核心连接管理函数

### 1. Prisma客户端初始化 (`lib/prisma.ts`)

#### `initializeDatabase()`
- **功能**: 初始化数据库连接并应用SQLite优化
- **位置**: `lib/prisma.ts:42-61`
- **异步**: 是
- **参数**: 无
- **返回**: Promise<void>
- **特点**:
  - 应用7个SQLite PRAGMA优化配置
  - 区分query和execute类型执行
  - 错误容错处理，单个配置失败不影响其他

```typescript
async function initializeDatabase() {
  // 执行SQLite优化配置
  for (const opt of sqliteOptimizations) {
    if (opt.type === 'query') {
      await prisma.$queryRawUnsafe(opt.sql)
    } else {
      await prisma.$executeRawUnsafe(opt.sql)
    }
  }
}
```

## 数据库CRUD操作函数

### 2. 用户管理函数 (`app/api/users/route.ts`)

#### `GET /api/users` 处理函数
- **功能**: 获取用户列表，支持分页和搜索
- **参数**: 
  - `page`: 页码
  - `limit`: 每页数量
  - `search`: 搜索关键词
- **返回**: 用户列表及分页信息
- **Prisma操作**:
  - `findMany()` - 查询用户
  - `count()` - 统计总数
  - `_count` - 关联计数

#### `POST /api/users` 处理函数
- **功能**: 创建新用户
- **参数**: 
  - `email`: 邮箱（必填）
  - `username`: 用户名
  - `displayName`: 显示名
  - `role`: 角色
  - `monthlyTokenLimit`: 月度配额
- **Prisma操作**:
  - `findUnique()` - 检查唯一性
  - `create()` - 创建用户

### 3. 对话管理函数 (`app/api/conversations/route.ts`)

#### `GET /api/conversations` 处理函数
- **功能**: 获取用户对话列表
- **特点**: 
  - 自动按lastMessageAt排序
  - 过滤已删除用户的对话
  - 包含用户基本信息

#### `POST /api/conversations` 处理函数
- **功能**: 创建新对话
- **默认值**:
  - `title`: '新对话'
  - `modelId`: 'gpt-3.5-turbo'
  - `temperature`: 0.7
  - `maxTokens`: 2000

### 4. 对话详情函数 (`app/api/conversations/[id]/route.ts`)

#### `GET /api/conversations/[id]` 处理函数
- **功能**: 获取对话详情，可选包含消息
- **参数**: `includeMessages` - 是否包含消息
- **Prisma操作**:
  - `include` - 关联查询
  - `orderBy` - 消息排序

#### `DELETE /api/conversations/[id]` 处理函数
- **功能**: 删除对话
- **特点**: 级联删除所有关联消息

### 5. 聊天消息处理函数 (`app/api/chat/route.ts`)

#### `saveAssistantMessage()`
- **功能**: 异步保存AI响应消息
- **位置**: `app/api/chat/route.ts:314-379`
- **数据库操作**:
  1. 创建助手消息记录
  2. 更新用户用量统计（currentMonthUsage, totalTokenUsed）
  3. 更新对话统计（messageCount, totalTokens）
  4. 调用异步使用量记录
- **特点**: 
  - 非阻塞异步执行
  - 错误静默处理不影响用户体验

#### 消息保存流程
```typescript
// 1. 保存用户消息
await prisma.message.create({
  data: {
    conversationId,
    role: 'USER',
    content: userContent,
    modelId,
    temperature
  }
})

// 2. 保存AI响应（流结束后）
await prisma.message.create({
  data: {
    conversationId,
    role: 'ASSISTANT',
    content: assistantContent,
    modelId,
    promptTokens,
    completionTokens,
    totalTokens,
    finishReason: 'stop'
  }
})

// 3. 更新用户统计
await prisma.user.update({
  where: { id: userId },
  data: {
    currentMonthUsage: { increment: tokens },
    totalTokenUsed: { increment: tokens },
    lastActiveAt: new Date()
  }
})

// 4. 更新对话统计
await prisma.conversation.update({
  where: { id: conversationId },
  data: {
    messageCount: { increment: 2 },
    totalTokens: { increment: tokens },
    lastMessageAt: new Date()
  }
})
```

### 6. 商家管理函数 (`app/api/merchants/route.ts`)

#### `GET /api/merchants` 处理函数
- **功能**: 获取商家列表，支持复杂筛选
- **筛选参数**:
  - `search`: 搜索关键词（名称、描述、地区）
  - `categoryId`: 分类ID
  - `location`: 地区
  - `businessType`: 业务类型
  - `status`: 状态
  - `sortBy`: 排序字段
  - `sortOrder`: 排序方向
- **Prisma操作**:
  - 复杂OR条件组合
  - include关联分类信息
  - 动态排序配置
- **特点**: 默认只显示ACTIVE状态商家

### 7. 邀请码管理函数 (`app/api/invite-codes/route.ts`)

#### `GET /api/invite-codes` 处理函数
- **功能**: 获取邀请码列表
- **参数**:
  - `active`: 筛选活跃/非活跃邀请码
  - `page`: 分页
  - `limit`: 每页数量
- **查询逻辑**:
  - 活跃邀请码: isActive=true 且 (无过期时间 或 未过期)
  - 非活跃邀请码: isActive=false 或 已过期
- **返回数据**: 包含使用计数（_count）

## 事务和统计函数

### 8. 使用量统计函数 (`lib/utils/usage-stats-helper.ts`)

#### `recordUsageAsync()`
- **功能**: 异步记录使用量统计（发送即忘模式）
- **位置**: `lib/utils/usage-stats-helper.ts:23-39`
- **参数**:
```typescript
interface UsageRecord {
  userId: string
  modelId: string
  modelProvider?: string | null
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  messagesCreated?: number
  success?: boolean
}
```
- **特点**:
  - 不阻塞主流程
  - 失败静默处理
  - Promise.resolve()异步执行

#### `recordUsageInternal()`
- **功能**: 内部记录函数，处理实际数据库写入
- **位置**: `lib/utils/usage-stats-helper.ts:44-141`
- **特点**:
  - 验证用户存在性，避免外键约束违反
  - 使用事务同时更新总量和按模型统计
  - 事务配置：15秒等待，45秒超时，Serializable隔离级别

#### `getTodayUTC()`
- **功能**: 获取UTC日期（0点）
- **位置**: `lib/utils/usage-stats-helper.ts:146-150`
- **返回**: Date对象（UTC 0点）

## 数据完整性检查函数

### 9. 数据库完整性检查类 (`scripts/db-integrity-check.ts`)

#### `DatabaseIntegrityChecker` 类
- **功能**: 综合数据库完整性检查
- **位置**: `scripts/db-integrity-check.ts:35-465`

##### 主要方法：

#### `checkConnection()`
- **功能**: 检查数据库连接
- **测试**: 执行 `SELECT 1` 查询

#### `checkTableStructure()`
- **功能**: 检查表结构和数据计数
- **检查表**:
  - user
  - conversation
  - message
  - usageStats
  - account
  - session
  - inviteCode

#### `checkConversationMessageConsistency()`
- **功能**: 检查对话消息计数一致性
- **比较**: `conversation.messageCount` vs 实际消息数
- **返回**: 不一致的对话列表

#### `checkTokenConsistency()`
- **功能**: 检查Token统计一致性
- **容差**: 1个token
- **比较**: `conversation.totalTokens` vs 消息总和

#### `checkUserUsageConsistency()`
- **功能**: 检查用户配额统计一致性
- **容差**: 10个token
- **比较**: `user.currentMonthUsage` vs usageStats总和

#### `checkOrphanRecords()`
- **功能**: 检查孤儿记录
- **检查项**:
  - 无对话的消息
  - 无用户的对话
  - 无用户的统计

#### `checkConstraintsAndIndexes()`
- **功能**: 检查数据约束
- **检查项**:
  - 重复邮箱
  - 重复邀请码
- **使用**: 原始SQL查询

#### `runAllChecks()`
- **功能**: 执行所有检查并生成报告
- **评分**: 通过率百分比
- **建议**: 根据失败项提供修复建议

## 数据导入导出函数

### 10. 商家数据导入函数 (`scripts/import-merchant-data.ts`)

#### `initializeCategories()`
- **功能**: 初始化商家分类数据
- **位置**: `scripts/import-merchant-data.ts:205-226`
- **操作**: `upsert` - 存在则更新，不存在则创建

#### `importMerchantData()`
- **功能**: 导入单个商家数据
- **位置**: `scripts/import-merchant-data.ts:229-371`
- **步骤**:
  1. 解析CSV数据
  2. 判断商家分类
  3. 计算统计数据
  4. upsert商家记录
  5. 批量导入内容

#### `parseCSV()`
- **功能**: 解析CSV文件
- **位置**: `scripts/import-merchant-data.ts:175-202`
- **使用**: csv-parse库

#### `categorizeByName()`
- **功能**: 根据商家名称判断分类
- **位置**: `scripts/import-merchant-data.ts:103-114`
- **算法**: 关键词匹配

#### `getBusinessType()`
- **功能**: 判断业务类型（B2B/B2C/B2B2C）
- **位置**: `scripts/import-merchant-data.ts:117-126`

#### `extractLocation()`
- **功能**: 提取地区信息
- **位置**: `scripts/import-merchant-data.ts:129-133`
- **使用**: 正则表达式匹配

### 11. 外部资源导入类 (`lib/import/external-resource-importer.ts`)

#### `ExternalResourceImporter` 类
- **功能**: 支持多格式外部资源导入
- **支持格式**: CSV, JSON, Excel, TXT, MD

##### 主要方法：

#### `import()`
- **功能**: 执行导入主函数
- **流程**:
  1. 读取文件
  2. 解析内容
  3. 导入记录
- **返回**: ImportResult

#### `readFile()`
- **功能**: 读取文件内容
- **限制**: 50MB文件大小
- **验证**: 文件存在性检查

#### `parseFile()`
- **功能**: 根据文件类型解析内容
- **分发**: 调用对应的解析函数

#### `parseCsv()`
- **功能**: 解析CSV文件
- **配置**: 分隔符、跳过空行、去除空白

#### `parseJson()`
- **功能**: 解析JSON文件

#### `parseExcel()`
- **功能**: 解析Excel文件
- **使用**: xlsx库

#### `importRecords()`
- **功能**: 批量导入记录到数据库
- **特点**:
  - 分块处理
  - 支持更新已存在记录
  - 错误收集

## 安全和认证函数

### 12. 邀请码安全函数 (`lib/security/invite-code-security.ts`)

#### `generateSecureInviteCode()`
- **功能**: 生成安全的邀请码
- **位置**: `lib/security/invite-code-security.ts:38-59`
- **特点**:
  - 24位随机字符
  - 扩展字符集
  - SHA256校验和

#### `validateInviteCodeFormat()`
- **功能**: 验证邀请码格式和校验和
- **位置**: `lib/security/invite-code-security.ts:64-81`
- **验证**:
  - 长度检查
  - 校验和验证

#### `getClientIP()`
- **功能**: 获取客户端IP并哈希处理
- **位置**: `lib/security/invite-code-security.ts:86-93`
- **隐私**: SHA256哈希保护

#### `isIPLocked()`
- **功能**: 检查IP是否被锁定
- **位置**: `lib/security/invite-code-security.ts:98-111`
- **锁定时长**: 15分钟

#### `recordFailedAttempt()`
- **功能**: 记录失败尝试
- **位置**: `lib/security/invite-code-security.ts:116-135`
- **锁定条件**: 5次失败尝试

#### `clearAttempts()`
- **功能**: 清除成功验证后的记录
- **位置**: `lib/security/invite-code-security.ts:140-143`

#### `checkRateLimit()`
- **功能**: 检查速率限制
- **位置**: `lib/security/invite-code-security.ts:148-167`
- **限制**: 1分钟内3次请求

#### `generateTemporaryToken()`
- **功能**: 生成时效性令牌
- **位置**: `lib/security/invite-code-security.ts:172-180`
- **格式**: Base64编码

#### `validateTemporaryToken()`
- **功能**: 验证时效性令牌
- **位置**: `lib/security/invite-code-security.ts:185-216`
- **有效期**: 默认5分钟

#### `logVerificationAttempt()`
- **功能**: 记录验证尝试（审计）
- **位置**: `lib/security/invite-code-security.ts:221-249`
- **隐私**: 仅记录前4位邀请码

## 维护和诊断函数

### 13. 数据库诊断脚本

#### `diagnose-usage-stats.ts`
- **功能**: 诊断使用量统计问题
- **检查项**:
  - 用户存在性
  - 统计记录一致性
  - 数据完整性

#### `fix-usage-tracking.ts`
- **功能**: 修复使用量跟踪问题
- **操作**:
  - 重新计算统计
  - 修复不一致数据
  - 清理异常记录

#### `check-data.ts`
- **功能**: 检查数据完整性
- **检查**:
  - 数据格式
  - 必填字段
  - 关联完整性

## 备份恢复函数

### 14. 数据库备份类 (`scripts/db/backup-database.js`)

#### `DatabaseBackup` 类
- **功能**: 数据库备份管理

##### 主要方法：

#### `execute()`
- **功能**: 执行备份主流程
- **步骤**:
  1. 创建备份目录
  2. 执行备份
  3. 验证备份
  4. 清理过期文件
  5. 生成报告

#### `performBackup()`
- **功能**: 执行实际备份
- **分发**: SQLite或PostgreSQL

#### `backupSQLite()`
- **功能**: SQLite数据库备份
- **类型**:
  - full: 完整备份
  - schema: 结构备份
  - data: 数据备份

#### `backupPostgreSQL()`
- **功能**: PostgreSQL备份
- **工具**: pg_dump

#### `verifyBackup()`
- **功能**: 验证备份文件完整性
- **检查**:
  - 文件大小
  - SQLite可打开性

#### `cleanupOldBackups()`
- **功能**: 清理过期备份
- **默认**: 保留7天

#### `compressFile()`
- **功能**: 压缩备份文件
- **格式**: gzip

#### `generateBackupReport()`
- **功能**: 生成备份报告
- **内容**:
  - 备份类型
  - 文件大小
  - 时间戳

## 辅助工具函数

### 15. 数据库工具函数

#### `formatFileSize()` (`scripts/db/backup-database.js`)
- **功能**: 格式化文件大小显示
- **位置**: `scripts/db/backup-database.js:423-431`

#### `getTodayDate()` (`lib/ai/model-stats-helper.ts`)
- **功能**: 获取今天的日期（用于统计）
- **格式**: YYYY-MM-DD

#### `getModelProvider()` (`lib/ai/model-stats-helper.ts`)
- **功能**: 根据模型ID判断提供商
- **返回**: Claude/Google/OpenAI

## 函数调用示例

### 基本CRUD操作
```typescript
// 创建用户
const user = await prisma.user.create({
  data: { email, username, role }
})

// 查询带分页
const users = await prisma.user.findMany({
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' }
})

// 更新统计
await prisma.user.update({
  where: { id },
  data: {
    currentMonthUsage: { increment: tokens }
  }
})
```

### 事务操作
```typescript
await prisma.$transaction([
  prisma.usageStats.upsert({...}),
  prisma.usageStats.upsert({...})
], {
  maxWait: 15000,
  timeout: 45000,
  isolationLevel: 'Serializable'
})
```

### 异步统计记录
```typescript
recordUsageAsync(prisma, {
  userId: 'user123',
  modelId: 'gpt-4',
  totalTokens: 1000,
  success: true
})
```

### 完整性检查
```typescript
const checker = new DatabaseIntegrityChecker()
await checker.runAllChecks()
```

### 数据导入
```typescript
const importer = new ExternalResourceImporter({
  userId: 'user123',
  filePath: '/path/to/file.csv',
  fileType: 'csv',
  source: 'IMPORTED'
})
const result = await importer.import()
```

## 注意事项

1. **外键约束**: 所有操作需要确保外键完整性
2. **事务隔离**: 根据操作类型选择合适的隔离级别
3. **异步处理**: 非关键统计使用异步模式
4. **错误处理**: 数据库操作需要 try-catch 包裹
5. **性能优化**: 使用 select 限制返回字段
6. **批量操作**: 大量数据使用批量处理
7. **连接管理**: 开发环境使用单例模式

## 性能建议

1. 使用 `select` 减少数据传输
2. 添加适当的索引优化查询
3. 批量操作使用 `createMany`
4. 长事务设置合理超时
5. 使用 `include` 避免 N+1 查询
6. 异步记录非关键数据