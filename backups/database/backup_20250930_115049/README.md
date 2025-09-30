# 数据库备份 - 2025年9月30日 11:50:49

## 备份原因
修复 Conversation.metadata 字段类型错误（String -> Json）

## 备份内容
- `main_dev.db` - prisma/dev.db (8.2MB)
- `prisma_dev.db` - prisma/prisma/dev.db (9.5MB)
- `prisma_dev.db-shm` - WAL共享内存文件 (32KB)
- `prisma_dev.db-wal` - WAL日志文件 (2.4MB)

## 修复计划
1. 修改 `prisma/schema.prisma` 中 metadata 类型：`String?` -> `Json?`
2. 创建数据库迁移文件：`003_add_metadata_column/migration.sql`
3. 执行 `pnpm db:generate` 重新生成 Prisma Client
4. 执行 `pnpm db:push` 同步到数据库
5. 测试验证固定对话和标签功能

## 恢复方法
如果需要恢复备份：
```bash
cp backups/database/backup_20250930_115049/main_dev.db prisma/dev.db
cp backups/database/backup_20250930_115049/prisma_dev.db prisma/prisma/dev.db
cp backups/database/backup_20250930_115049/prisma_dev.db-shm prisma/prisma/dev.db-shm
cp backups/database/backup_20250930_115049/prisma_dev.db-wal prisma/prisma/dev.db-wal
```
