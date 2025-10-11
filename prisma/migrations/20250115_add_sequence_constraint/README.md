# Migration: Add sequence constraint to creative_copies

## 目的
为 `creative_copies.sequence` 字段添加 CHECK 约束，确保值在 [1, 5] 范围内。

## 修改内容
- 添加约束：`CHECK (sequence >= 1 AND sequence <= 5)`
- 由于 SQLite 不支持 ALTER TABLE ADD CONSTRAINT，需要重建表

## 数据处理
- 迁移时会过滤掉 sequence 越界的数据（如果存在）
- 回滚时恢复无约束表结构，保留所有数据

## 执行
```bash
# 应用迁移
sqlite3 prisma/dev.db < prisma/migrations/20250115_add_sequence_constraint/migration.sql

# 回滚
sqlite3 prisma/dev.db < prisma/migrations/20250115_add_sequence_constraint/rollback.sql
```

## 风险
- **低风险**：当前数据库无 creative_copies 数据，重建表不影响生产
- 未来如有数据，越界记录会被过滤（应提前清理）
