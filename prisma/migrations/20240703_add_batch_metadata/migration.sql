-- SQLite 不支持 JSONB，使用 TEXT 存储 JSON
ALTER TABLE "creative_batches" ADD COLUMN "metadata" TEXT;
