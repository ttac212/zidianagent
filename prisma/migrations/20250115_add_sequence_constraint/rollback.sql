-- 回滚 creative_copies.sequence 约束
-- 移除约束，恢复无约束表结构

PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

-- 创建无约束的旧表结构
CREATE TABLE IF NOT EXISTS "creative_copies_old" (
  "id" TEXT PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "markdownContent" TEXT NOT NULL,
  "rawModelOutput" TEXT,
  "userOverride" TEXT,
  "state" TEXT NOT NULL DEFAULT 'DRAFT',
  "regeneratedFromId" TEXT,
  "editedBy" TEXT,
  "editedAt" DATETIME,
  "contentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("batchId") REFERENCES "creative_batches"("id") ON DELETE CASCADE,
  FOREIGN KEY ("regeneratedFromId") REFERENCES "creative_copies"("id") ON DELETE SET NULL
);

-- 复制所有数据
INSERT INTO "creative_copies_old" 
SELECT * FROM "creative_copies";

-- 删除新表
DROP TABLE IF EXISTS "creative_copies";

-- 重命名旧表
ALTER TABLE "creative_copies_old" RENAME TO "creative_copies";

-- 重建索引
CREATE INDEX IF NOT EXISTS "creative_copies_batch_sequence_idx"
  ON "creative_copies"("batchId", "sequence");

CREATE INDEX IF NOT EXISTS "creative_copies_regenerated_idx"
  ON "creative_copies"("regeneratedFromId");

COMMIT;

PRAGMA foreign_keys=ON;
