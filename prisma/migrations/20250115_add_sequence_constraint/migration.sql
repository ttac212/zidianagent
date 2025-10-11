-- 添加 creative_copies.sequence 约束 (1-5)
-- SQLite 不支持 ALTER TABLE ADD CONSTRAINT，需要重建表

PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

-- 创建带约束的新表
CREATE TABLE IF NOT EXISTS "creative_copies_new" (
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
  FOREIGN KEY ("regeneratedFromId") REFERENCES "creative_copies"("id") ON DELETE SET NULL,
  CONSTRAINT "creative_copies_sequence_chk" CHECK ("sequence" >= 1 AND "sequence" <= 5)
);

-- 复制数据（如果存在）
INSERT INTO "creative_copies_new" 
SELECT * FROM "creative_copies"
WHERE "sequence" >= 1 AND "sequence" <= 5;

-- 删除旧表
DROP TABLE IF EXISTS "creative_copies";

-- 重命名新表
ALTER TABLE "creative_copies_new" RENAME TO "creative_copies";

-- 重建索引
CREATE INDEX IF NOT EXISTS "creative_copies_batch_sequence_idx"
  ON "creative_copies"("batchId", "sequence");

CREATE INDEX IF NOT EXISTS "creative_copies_regenerated_idx"
  ON "creative_copies"("regeneratedFromId");

COMMIT;

PRAGMA foreign_keys=ON;
