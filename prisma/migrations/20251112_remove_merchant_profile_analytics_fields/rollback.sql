-- Rollback: 恢复 MerchantProfile 的爆款分析和创作指南字段
-- Date: 2025-11-12
-- Description:
--   如果需要回滚，重新添加这些字段（数据将丢失）

-- ============================================================================
-- Step 1: 重新添加爆款分析字段
-- ============================================================================

ALTER TABLE "merchant_profiles"
ADD COLUMN IF NOT EXISTS "topContentAnalysis" TEXT;

ALTER TABLE "merchant_profiles"
ADD COLUMN IF NOT EXISTS "goldenThreeSeconds" TEXT;

ALTER TABLE "merchant_profiles"
ADD COLUMN IF NOT EXISTS "emotionalTriggers" TEXT;

ALTER TABLE "merchant_profiles"
ADD COLUMN IF NOT EXISTS "contentFormats" TEXT;

-- ============================================================================
-- Step 2: 重新添加创作指南字段
-- ============================================================================

ALTER TABLE "merchant_profiles"
ADD COLUMN IF NOT EXISTS "trendingTopics" TEXT;

ALTER TABLE "merchant_profiles"
ADD COLUMN IF NOT EXISTS "tagStrategy" TEXT;

ALTER TABLE "merchant_profiles"
ADD COLUMN IF NOT EXISTS "publishingTips" TEXT;

-- ============================================================================
-- Step 3: 恢复数据（如果有备份）
-- ============================================================================

-- 如果在迁移前导出了数据，可以使用以下语句恢复：
-- UPDATE "merchant_profiles" mp
-- SET "topContentAnalysis" = backup."topContentAnalysis",
--     "goldenThreeSeconds" = backup."goldenThreeSeconds",
--     "emotionalTriggers" = backup."emotionalTriggers",
--     "contentFormats" = backup."contentFormats",
--     "trendingTopics" = backup."trendingTopics",
--     "tagStrategy" = backup."tagStrategy",
--     "publishingTips" = backup."publishingTips"
-- FROM merchant_profiles_backup backup
-- WHERE mp.id = backup.id;

-- ============================================================================
-- Step 4: 更新 Prisma Schema
-- ============================================================================

-- 别忘了同时恢复 schema.prisma 中的字段定义：
--
-- // === PART 2: 爆款分析 ===
-- topContentAnalysis String? // TOP10爆款分析(JSON: 标题、开头、情绪点、互动数据)
-- goldenThreeSeconds String? // 黄金3秒开头建议(基于历史数据的有效开头模板)
-- emotionalTriggers  String? // 情绪点分析(笑点/痛点/爽点的分布)
-- contentFormats     String? // 内容形式偏好(口播/剧情/对比/教程的占比)
--
-- // === PART 3: 创作指南 ===
-- trendingTopics String? // 热门话题和标签(当前适合的热点)
-- tagStrategy    String? // 标签组合策略(高效标签组合建议)
-- publishingTips String? // 发布策略(最佳时段、内容频率,JSON格式)

-- 然后运行: pnpm db:generate
