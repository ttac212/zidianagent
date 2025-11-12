# MerchantProfile Schema 迁移说明

## 迁移目的

删除 MerchantProfile 中不再使用的爆款分析和创作指南字段，简化数据模型。

## 被删除的字段

### Part 2: 爆款分析
- `topContentAnalysis` - TOP10爆款分析
- `goldenThreeSeconds` - 黄金3秒开头建议
- `emotionalTriggers` - 情绪点分析
- `contentFormats` - 内容形式偏好

### Part 3: 创作指南
- `trendingTopics` - 热门话题和标签
- `tagStrategy` - 标签组合策略
- `publishingTips` - 发布策略

## 执行方式

### 开发环境（SQLite）

SQLite 不支持 `DROP COLUMN`，使用 Prisma 自动迁移：

```bash
# 1. Schema 文件已更新（已完成）
# 2. 生成新的 Prisma Client
pnpm db:generate

# 3. 同步数据库结构（Prisma 会自动重建表）
pnpm db:push
```

### 生产环境（PostgreSQL）

**重要：执行前先备份数据库！**

```bash
# 1. 备份数据库
pg_dump -U postgres -d zhidianai > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 检查是否有代码引用这些字段
grep -r "topContentAnalysis\|goldenThreeSeconds\|emotionalTriggers\|contentFormats\|trendingTopics\|tagStrategy\|publishingTips" app/ lib/ components/

# 3. 在 staging 环境测试
psql -U postgres -d staging_db < migration.sql

# 4. 验证无误后，在生产环境执行
psql -U postgres -d zhidianai < migration.sql

# 5. 运行 Prisma 迁移
pnpm db:migrate deploy
```

## 回滚方案

如果需要回滚：

```bash
# 方案1：恢复数据库备份
psql -U postgres -d zhidianai < backup_YYYYMMDD_HHMMSS.sql

# 方案2：执行回滚脚本（数据将丢失）
psql -U postgres -d zhidianai < rollback.sql
```

## 验证步骤

```sql
-- 1. 检查表结构
\d+ merchant_profiles

-- 2. 确认核心字段存在
SELECT COUNT(*) FROM "merchant_profiles" WHERE "briefIntro" IS NOT NULL;

-- 3. 确认被删除的字段不存在
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'merchant_profiles'
  AND column_name IN ('topContentAnalysis', 'goldenThreeSeconds', 'emotionalTriggers', 'contentFormats', 'trendingTopics', 'tagStrategy', 'publishingTips');
-- 应该返回 0 行
```

## 注意事项

1. **数据保留**：如果需要保留这些字段的历史数据，请在执行迁移前先导出
2. **代码依赖**：确认没有代码仍在使用这些字段
3. **测试环境**：先在 staging 环境测试
4. **监控**：迁移后监控 MerchantProfile 相关功能是否正常

## 设计理念

这次迁移遵循 Linus Torvalds 的设计哲学："简单胜过复杂"

- **删除过度抽象**：爆款分析和创作指南字段在实际使用中过于复杂
- **聚焦核心**：保留 Brief 和用户自定义字段，满足核心需求
- **避免膨胀**：防止数据模型无限扩张

保留的核心字段已经足够支持商家档案功能，无需额外的分析字段。
