-- 添加 metadata 列到 conversations 表
-- 使用 SQLite 表重建方案

-- 背景说明：
-- 1. SQLite 不支持 ALTER TABLE ADD COLUMN IF NOT EXISTS
-- 2. 开发环境可能通过 db:push 已创建 metadata 列（需手动标记迁移已应用）
-- 3. 生产环境（全新）执行迁移时 metadata 列不存在，必须通过此迁移创建
-- 4. 表重建是 SQLite 的标准安全方案

-- 注意：如果执行此迁移时 conversations 表已包含 metadata 列：
-- 解决方案：手动标记迁移为已应用
-- 命令：npx prisma migrate resolve --applied 003_add_metadata_column

PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

-- Step 1: 创建新表（包含所有列，确保 metadata 存在）
CREATE TABLE "conversations_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT '新对话',
    "userId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL DEFAULT 'gpt-3.5-turbo',
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 2000,
    "contextAware" BOOLEAN NOT NULL DEFAULT true,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT DEFAULT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastMessageAt" DATETIME DEFAULT NULL,
    CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Step 2: 从旧表复制数据
-- 假设 metadata 列不存在（生产环境场景）
-- 如果列已存在，下面的 INSERT 会包含 metadata 数据
INSERT INTO "conversations_new" ("id", "title", "userId", "modelId", "temperature", "maxTokens", "contextAware", "messageCount", "totalTokens", "createdAt", "updatedAt", "lastMessageAt")
SELECT "id", "title", "userId", "modelId", "temperature", "maxTokens", "contextAware", "messageCount", "totalTokens", "createdAt", "updatedAt", "lastMessageAt"
FROM "conversations";

-- Step 3: 删除旧表
DROP TABLE "conversations";

-- Step 4: 重命名新表
ALTER TABLE "conversations_new" RENAME TO "conversations";

-- Step 5: 重建索引（保留已有的索引）
CREATE INDEX "conversations_userId_lastMessageAt_idx" ON "conversations"("userId", "lastMessageAt" DESC);
CREATE INDEX "conversations_createdAt_idx" ON "conversations"("createdAt");
CREATE INDEX "conversations_modelId_idx" ON "conversations"("modelId");
CREATE INDEX "conversations_updatedAt_idx" ON "conversations"("updatedAt");

COMMIT;

PRAGMA foreign_keys=ON;

-- 验证（在应用层执行）：
-- SELECT COUNT(*) FROM pragma_table_info('conversations') WHERE name='metadata';
-- 应该返回 1
