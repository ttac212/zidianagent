# Metadata字段覆盖顺序修复补充

## 新发现的致命问题3

### 问题描述
**文件**: `hooks/api/use-conversations-query.ts:156-167`
**问题**: `transformApiConversation` 函数先设置实时统计字段，再展开 `conv.metadata`，导致 metadata 中的旧值覆盖了数据库的最新值

**影响**:
- 用户固定对话后，metadata 中会被写入当时的 `messageCount`、`totalTokens`、`lastActivity`
- 刷新页面时，这些旧值会覆盖数据库的最新统计
- 即使对话有新消息，列表仍显示旧的消息数和时间
- 功能等于失效

### 问题根源分析

```typescript
// ❌ 旧代码（错误的字段覆盖顺序）
metadata: {
  totalTokens: conv.totalTokens || 0,          // 最新值：3条消息
  messageCount: conv.messageCount || 0,        // 最新值：3
  lastActivity: safeParseTimestamp(conv.updatedAt),
  lastMessage: conv.lastMessage ? {...} : null,
  ...(conv.metadata ? conv.metadata : {})      // 展开旧值：messageCount=2 覆盖！
}
```

当用户固定对话时，`toggleConversationPinned` 会将当时的统计数据写入 metadata：

```typescript
// ❌ 旧代码（错误地保存实时统计字段）
return {
  metadata: {
    ...conversation.metadata,
    tags: newTags,
    totalTokens: conversation.metadata?.totalTokens || 0,      // 写入旧值
    messageCount: conversation.metadata?.messageCount || 0,    // 写入旧值
    lastActivity: dt.timestamp()                               // 写入旧值
  }
}
```

结果：
1. 对话有2条消息时用户固定 → metadata 保存 `messageCount: 2`
2. 对话新增消息变成3条 → 数据库 `messageCount` 列更新为 3
3. 刷新页面查询 → API 返回 `conv.messageCount = 3` 和 `conv.metadata = {messageCount: 2}`
4. 前端合并数据 → 旧值覆盖新值，最终显示 `messageCount: 2` ❌

---

## 修复方案

### 修复3.1：调整字段覆盖顺序

**文件**: `hooks/api/use-conversations-query.ts:156-169`
**策略**: 先展开 metadata（保留用户字段），再用数据库列覆盖统计字段

```typescript
// ✅ 新代码（正确的字段覆盖顺序）
metadata: {
  // 先展开数据库中的 metadata（包含用户自定义字段如 tags、pinned 等）
  ...(conv.metadata && typeof conv.metadata === 'object' ? conv.metadata : {}),
  // 然后用服务端的实时统计字段覆盖（确保统计数据是最新的）
  totalTokens: conv.totalTokens || 0,
  messageCount: conv.messageCount || 0,
  lastActivity: safeParseTimestamp(conv.updatedAt),
  lastMessage: conv.lastMessage ? {
    id: conv.lastMessage.id,
    role: conv.lastMessage.role as 'user' | 'assistant',
    content: conv.lastMessage.content,
    timestamp: safeParseTimestamp(conv.lastMessage.createdAt)
  } : null
}
```

### 修复3.2：清理 metadata 中的实时统计字段

**文件**: `lib/utils/conversation-list.ts:305-316`
**策略**: `toggleConversationPinned` 只保存用户自定义字段，排除实时统计字段

```typescript
// ✅ 新代码（只保存用户自定义字段）
export function toggleConversationPinned(conversation: DerivedConversation): {
  metadata: Conversation['metadata']
} {
  const currentTags = conversation.metadata?.tags || []
  const isPinned = currentTags.includes('pinned')

  let newTags: string[]
  if (isPinned) {
    newTags = currentTags.filter(tag => tag !== 'pinned')
  } else {
    newTags = [...currentTags, 'pinned']
  }

  // 只提取用户自定义字段，排除实时统计字段
  const { totalTokens, messageCount, lastActivity, lastMessage, ...customFields } = conversation.metadata || {}

  return {
    metadata: {
      ...customFields,  // 保留其他用户自定义字段
      tags: newTags     // 更新 tags
      // 注意：不包含 totalTokens、messageCount、lastActivity、lastMessage
      // 这些字段由服务端从数据库表列计算，不应该存储在 metadata JSON 中
    }
  }
}
```

---

## 测试验证

### 测试脚本: scripts/test-field-override-order.ts

```bash
npx tsx scripts/test-field-override-order.ts
```

**测试场景**:
1. 创建对话，初始 messageCount=2
2. 固定对话，metadata 中写入旧值 messageCount=2
3. 新增消息，数据库 messageCount 更新为 3
4. 模拟 API 查询和前端数据转换
5. 验证字段覆盖顺序

**测试结果**:
```
旧代码问题：
  ❌ metadata中的旧值覆盖了数据库的最新值
  ❌ 用户固定对话后，刷新看到的仍是旧统计数据
  ❌ messageCount、totalTokens、lastActivity 全部陈旧

新代码修复：
  ✅ 先展开metadata（保留用户字段如tags）
  ✅ 再用数据库列覆盖统计字段（确保最新）
  ✅ toggleConversationPinned不再写入统计字段

修复验证：
  ✅ 旧代码确实会被覆盖（messageCount=2）
  ✅ 新代码使用最新值（messageCount=3）
  ✅ 用户自定义字段保留（tags=['pinned']）
```

---

## 架构原则

### metadata 字段使用规范

**metadata JSON 应该存储的内容**：
- ✅ 用户自定义字段：`tags`、`pinned`、`archived`、`favorite` 等
- ✅ 业务元数据：`source`、`category`、`priority` 等
- ✅ 扩展配置：自定义设置、用户偏好等

**metadata JSON 不应该存储的内容**：
- ❌ 实时统计字段：`messageCount`、`totalTokens`、`lastActivity`
- ❌ 聚合计算结果：这些应该由数据库列或视图计算
- ❌ 关联数据：`lastMessage` 应该由 API 查询时动态计算

**原因**：
1. **数据一致性**：实时统计字段由数据库触发器/应用层自动更新，不应该手动写入
2. **避免陈旧数据**：JSON 中的值不会自动更新，容易过时
3. **简化更新逻辑**：只更新用户操作相关的字段，减少出错可能

### 字段覆盖顺序原则

```typescript
// ✅ 正确模式：先展开可能包含旧值的对象，再覆盖需要保证最新的字段
const merged = {
  ...potentiallyStaleData,  // 可能包含旧值的数据源
  ...freshData              // 保证最新的数据源
}

// ❌ 错误模式：先设置新值，再展开可能覆盖的对象
const wrong = {
  ...freshData,             // 设置最新值
  ...potentiallyStaleData   // 旧值覆盖！
}
```

---

## 相关文件

### 修改的文件
- `hooks/api/use-conversations-query.ts` - 调整 transformApiConversation 字段覆盖顺序
- `lib/utils/conversation-list.ts` - toggleConversationPinned 移除实时统计字段

### 新增的文件
- `scripts/test-field-override-order.ts` - 字段覆盖顺序测试脚本

---

## 完整修复清单

### 已修复的三个致命问题

1. ✅ **API漏metadata字段** (`app/api/conversations/route.ts:70`)
   - 列表查询 select 块缺少 `metadata: true`
   - 导致 pinned 状态刷新后丢失

2. ✅ **003迁移缺少ADD COLUMN** (`prisma/migrations/003_add_metadata_column/migration.sql`)
   - 迁移文件只有 UPDATE，没有创建 metadata 列
   - 全新环境会报 "no such column: metadata"

3. ✅ **字段覆盖顺序错误** (`hooks/api/use-conversations-query.ts:156-169`)
   - 先设置新值，再展开 metadata 导致旧值覆盖新值
   - 固定对话后统计数据陈旧

### 部署前验证

```bash
# 1. 检查 metadata 列存在
npx tsx scripts/check-metadata-column.ts

# 2. 测试 metadata 持久化
npx tsx scripts/test-metadata-persistence.ts

# 3. 测试字段覆盖顺序
npx tsx scripts/test-field-override-order.ts

# 预期：所有测试通过
```

---

## 总结

本次修复解决了 metadata 功能的三个关键问题：

1. **数据不返回** → API select 块添加 metadata 字段
2. **列不存在** → 迁移文件添加表重建方案（实际使用 db:push）
3. **数据被覆盖** → 调整字段合并顺序，清理 metadata 中的实时字段

修复后，`pinned`/`tags` 等用户自定义字段可以正确持久化，且不会覆盖实时统计数据。

**修复状态**: ✅ 所有问题已修复，测试全部通过，可以部署
