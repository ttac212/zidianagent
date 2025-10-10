-- 批量文案生成模块 - 回滚脚本

PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

DROP INDEX IF EXISTS "generation_exceptions_batch_status_idx";
DROP TABLE IF EXISTS "generation_exceptions";

DROP INDEX IF EXISTS "creative_copy_revisions_unique";
DROP TABLE IF EXISTS "creative_copy_revisions";

DROP INDEX IF EXISTS "creative_copies_regenerated_idx";
DROP INDEX IF EXISTS "creative_copies_batch_sequence_idx";
DROP TABLE IF EXISTS "creative_copies";

DROP INDEX IF EXISTS "creative_batch_assets_reference_idx";
DROP INDEX IF EXISTS "creative_batch_assets_prompt_idx";
DROP INDEX IF EXISTS "creative_batch_assets_role_order_idx";
DROP INDEX IF EXISTS "creative_batch_assets_prompt_unique";
DROP INDEX IF EXISTS "creative_batch_assets_report_unique";
DROP TABLE IF EXISTS "creative_batch_assets";

DROP INDEX IF EXISTS "creative_batches_status_created_idx";
DROP INDEX IF EXISTS "creative_batches_merchant_created_idx";
DROP TABLE IF EXISTS "creative_batches";

DROP INDEX IF EXISTS "merchant_prompt_assets_type_created_idx";
DROP INDEX IF EXISTS "merchant_prompt_assets_active_unique";
DROP INDEX IF EXISTS "merchant_prompt_assets_type_version_key";
DROP TABLE IF EXISTS "merchant_prompt_assets";

DROP INDEX IF EXISTS "reference_assets_kind_created_idx";
DROP TABLE IF EXISTS "reference_assets";

COMMIT;

PRAGMA foreign_keys=ON;
