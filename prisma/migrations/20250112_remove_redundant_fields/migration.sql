-- Migration: 移除冗余字段，添加显式字段
-- Date: 2025-01-12
-- Description: 
--   1. 删除 CreativeBatch.statusVersion 和 metadata 字段
--   2. 添加 CreativeBatch.targetSequence 和 appendPrompt 字段
--   3. 删除 CreativeBatchAsset.role 字段
--   4. 删除 MerchantPromptAsset.isActive 和 metadata 字段
--   5. 删除 CreativeAssetRole 枚举（Prisma会自动处理）

-- ============================================================================
-- Step 1: 添加新字段（如果不存在）
-- ============================================================================

-- 1.1 添加 CreativeBatch.targetSequence
-- 用于单条文案再生成，标识生成第几条（1-5）
ALTER TABLE "creative_batches" 
ADD COLUMN IF NOT EXISTS "targetSequence" INTEGER;

-- 1.2 添加 CreativeBatch.appendPrompt
-- 用于存储用户追加的提示词（再生成时使用）
ALTER TABLE "creative_batches" 
ADD COLUMN IF NOT EXISTS "appendPrompt" TEXT;

-- ============================================================================
-- Step 2: 数据迁移和回填
-- ============================================================================

-- 2.1 从 metadata 提取 targetSequence（如果存在）
-- SQLite不支持JSON操作，生产环境使用PostgreSQL时需要调整
-- UPDATE "creative_batches"
-- SET "targetSequence" = CAST(metadata->>'targetSequence' AS INTEGER)
-- WHERE metadata IS NOT NULL
--   AND metadata->>'targetSequence' IS NOT NULL;

-- 注意：SQLite环境下，metadata数据无法自动迁移
-- 如果有生产数据，需要手动脚本处理

-- 2.2 MerchantPromptAsset: 为每个 merchantId+type 组合生成 version
-- 如果version已存在且数据正确，跳过此步骤

-- 检查是否需要初始化version
-- WITH max_versions AS (
--   SELECT "merchantId", type, MAX(version) as max_ver
--   FROM "merchant_prompt_assets"
--   GROUP BY "merchantId", type
-- )
-- SELECT COUNT(*) FROM max_versions WHERE max_ver = 0;

-- 如果上述查询返回0，说明version已正确设置，无需迁移

-- ============================================================================
-- Step 3: 删除旧字段（谨慎操作！）
-- ============================================================================

-- 3.1 删除 CreativeBatch 的冗余字段
-- 注意：SQLite不支持 DROP COLUMN IF EXISTS
-- 生产环境（PostgreSQL）使用以下语法：

-- ALTER TABLE "creative_batches" 
-- DROP COLUMN IF EXISTS "statusVersion";

-- ALTER TABLE "creative_batches" 
-- DROP COLUMN IF EXISTS "metadata";

-- SQLite环境需要重建表（已通过db:push完成）

-- 3.2 删除 CreativeBatchAsset.role 字段
-- ALTER TABLE "creative_batch_assets" 
-- DROP COLUMN IF EXISTS "role";

-- 3.3 删除 MerchantPromptAsset 的冗余字段
-- ALTER TABLE "merchant_prompt_assets" 
-- DROP COLUMN IF EXISTS "isActive";

-- ALTER TABLE "merchant_prompt_assets" 
-- DROP COLUMN IF EXISTS "metadata";

-- ============================================================================
-- Step 4: 验证数据完整性
-- ============================================================================

-- 4.1 验证所有批次都有必需的关联资产
-- SELECT b.id, b."merchantId", COUNT(DISTINCT pa.type) as prompt_types
-- FROM "creative_batches" b
-- JOIN "creative_batch_assets" cba ON cba."batchId" = b.id
-- JOIN "merchant_prompt_assets" pa ON pa.id = cba."promptAssetId"
-- WHERE cba."promptAssetId" IS NOT NULL
-- GROUP BY b.id, b."merchantId"
-- HAVING COUNT(DISTINCT pa.type) < 2;
-- 
-- 如果上述查询有结果，说明存在缺少REPORT或PROMPT的批次，需要人工处理

-- 4.2 验证 MerchantPromptAsset 的 version 唯一性
-- SELECT "merchantId", type, version, COUNT(*) as cnt
-- FROM "merchant_prompt_assets"
-- GROUP BY "merchantId", type, version
-- HAVING COUNT(*) > 1;
--
-- 如果有结果，说明存在重复的版本号，需要重新生成

-- ============================================================================
-- Notes for Production Deployment
-- ============================================================================

-- 1. 备份数据库：
--    pg_dump -U user -d dbname > backup_before_migration.sql

-- 2. 在生产环境运行前，先在staging环境测试

-- 3. 如果有大量历史批次使用metadata存储业务数据：
--    - 导出所有 metadata 不为空的批次
--    - 人工检查是否有appendPrompt/parentCopyId等关键信息
--    - 编写脚本迁移到新字段或归档

-- 4. 回滚方案：
--    - 恢复备份
--    - 或者重新添加被删除的字段（数据将丢失）

-- 5. 监控事项：
--    - 批次创建成功率
--    - Worker生成成功率
--    - API错误日志（特别是isActive相关查询）
