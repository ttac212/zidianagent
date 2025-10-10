-- 批量文案生成模块 - 正向迁移
-- 创建商家资产、批次、文案、异常等核心表与约束

PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

-- 1. 附件资源表
CREATE TABLE IF NOT EXISTS "reference_assets" (
  "id" TEXT PRIMARY KEY,
  "merchantId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sourceMeta" TEXT,
  "originalText" TEXT NOT NULL,
  "ocrText" TEXT,
  "summary" TEXT,
  "isDefaultEnabled" INTEGER NOT NULL DEFAULT 1,
  "createdBy" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "reference_assets_kind_created_idx"
  ON "reference_assets"("merchantId", "kind", "createdAt");

-- 2. 商家提示/报告资产表
CREATE TABLE IF NOT EXISTS "merchant_prompt_assets" (
  "id" TEXT PRIMARY KEY,
  "merchantId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "parentId" TEXT,
  "content" TEXT,
  "referenceAssetId" TEXT,
  "metadata" TEXT,
  "isActive" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE,
  FOREIGN KEY ("parentId") REFERENCES "merchant_prompt_assets"("id") ON DELETE SET NULL,
  FOREIGN KEY ("referenceAssetId") REFERENCES "reference_assets"("id") ON DELETE SET NULL,
  CONSTRAINT "merchant_prompt_assets_content_chk" CHECK (
    (("type" IN ('REPORT','PROMPT')) AND "content" IS NOT NULL AND "referenceAssetId" IS NULL)
    OR
    (("type" = 'ATTACHMENT') AND "content" IS NULL AND "referenceAssetId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS "merchant_prompt_assets_type_version_key"
  ON "merchant_prompt_assets"("merchantId", "type", "version");

CREATE UNIQUE INDEX IF NOT EXISTS "merchant_prompt_assets_active_unique"
  ON "merchant_prompt_assets"("merchantId", "type")
  WHERE "isActive" = 1;

CREATE INDEX IF NOT EXISTS "merchant_prompt_assets_type_created_idx"
  ON "merchant_prompt_assets"("merchantId", "type", "createdAt");

-- 3. 批次表
CREATE TABLE IF NOT EXISTS "creative_batches" (
  "id" TEXT PRIMARY KEY,
  "merchantId" TEXT NOT NULL,
  "parentBatchId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "modelId" TEXT NOT NULL DEFAULT 'claude-sonnet-4-5-20250929',
  "statusVersion" INTEGER NOT NULL DEFAULT 1,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "triggeredBy" TEXT NOT NULL,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "tokenUsage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" DATETIME,
  FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE,
  FOREIGN KEY ("parentBatchId") REFERENCES "creative_batches"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "creative_batches_merchant_created_idx"
  ON "creative_batches"("merchantId", "createdAt");

CREATE INDEX IF NOT EXISTS "creative_batches_status_created_idx"
  ON "creative_batches"("status", "createdAt");

-- 4. 批次素材关联表
CREATE TABLE IF NOT EXISTS "creative_batch_assets" (
  "id" TEXT PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "promptAssetId" TEXT,
  "referenceAssetId" TEXT,
  "isEnabled" INTEGER NOT NULL DEFAULT 1,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY ("batchId") REFERENCES "creative_batches"("id") ON DELETE CASCADE,
  FOREIGN KEY ("promptAssetId") REFERENCES "merchant_prompt_assets"("id") ON DELETE SET NULL,
  FOREIGN KEY ("referenceAssetId") REFERENCES "reference_assets"("id") ON DELETE SET NULL,
  CONSTRAINT "creative_batch_assets_asset_chk" CHECK (
    (("promptAssetId" IS NOT NULL) <> ("referenceAssetId" IS NOT NULL))
  ),
  CONSTRAINT "creative_batch_assets_role_chk" CHECK (
    (("role" IN ('REPORT','PROMPT')) AND "promptAssetId" IS NOT NULL)
    OR
    (("role" IN ('ATTACHMENT','TOPIC','BENCHMARK')) AND "referenceAssetId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS "creative_batch_assets_report_unique"
  ON "creative_batch_assets"("batchId")
  WHERE "role" = 'REPORT';

CREATE UNIQUE INDEX IF NOT EXISTS "creative_batch_assets_prompt_unique"
  ON "creative_batch_assets"("batchId")
  WHERE "role" = 'PROMPT';

CREATE INDEX IF NOT EXISTS "creative_batch_assets_role_order_idx"
  ON "creative_batch_assets"("batchId", "role", "sortOrder");

CREATE INDEX IF NOT EXISTS "creative_batch_assets_prompt_idx"
  ON "creative_batch_assets"("promptAssetId");

CREATE INDEX IF NOT EXISTS "creative_batch_assets_reference_idx"
  ON "creative_batch_assets"("referenceAssetId");

-- 5. 文案表
CREATE TABLE IF NOT EXISTS "creative_copies" (
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

CREATE INDEX IF NOT EXISTS "creative_copies_batch_sequence_idx"
  ON "creative_copies"("batchId", "sequence");

CREATE INDEX IF NOT EXISTS "creative_copies_regenerated_idx"
  ON "creative_copies"("regeneratedFromId");

-- 6. 文案版本表
CREATE TABLE IF NOT EXISTS "creative_copy_revisions" (
  "id" TEXT PRIMARY KEY,
  "copyId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "note" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("copyId") REFERENCES "creative_copies"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "creative_copy_revisions_unique"
  ON "creative_copy_revisions"("copyId", "version");

-- 7. 异常记录表
CREATE TABLE IF NOT EXISTS "generation_exceptions" (
  "id" TEXT PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "copyId" TEXT,
  "errorCode" TEXT,
  "errorDetail" TEXT,
  "requestPayload" TEXT,
  "responsePayload" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("batchId") REFERENCES "creative_batches"("id") ON DELETE CASCADE,
  FOREIGN KEY ("copyId") REFERENCES "creative_copies"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "generation_exceptions_batch_status_idx"
  ON "generation_exceptions"("batchId", "status");

COMMIT;

PRAGMA foreign_keys=ON;
