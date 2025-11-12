-- Migration: 移除 MerchantProfile 的爆款分析和创作指南字段
-- Date: 2025-11-12
-- Description:
--   删除 MerchantProfile 中不再使用的分析字段：
--   - topContentAnalysis (爆款分析)
--   - goldenThreeSeconds (黄金3秒开头)
--   - emotionalTriggers (情绪点分析)
--   - contentFormats (内容形式偏好)
--   - trendingTopics (热门话题)
--   - tagStrategy (标签组合策略)
--   - publishingTips (发布策略)
--
-- Reason: 简化商家档案模型，聚焦核心Brief信息，避免过度抽象

-- ============================================================================
-- Step 1: 备份数据（可选，建议在生产环境执行前先备份）
-- ============================================================================

-- 如果需要保留这些字段的历史数据，可以先导出：
-- SELECT id, "merchantId",
--        "topContentAnalysis", "goldenThreeSeconds", "emotionalTriggers",
--        "contentFormats", "trendingTopics", "tagStrategy", "publishingTips"
-- FROM "merchant_profiles"
-- WHERE "topContentAnalysis" IS NOT NULL
--    OR "goldenThreeSeconds" IS NOT NULL
--    OR "emotionalTriggers" IS NOT NULL
--    OR "contentFormats" IS NOT NULL
--    OR "trendingTopics" IS NOT NULL
--    OR "tagStrategy" IS NOT NULL
--    OR "publishingTips" IS NOT NULL;

-- ============================================================================
-- Step 2: 删除字段（PostgreSQL 语法）
-- ============================================================================

-- 注意：PostgreSQL 支持 DROP COLUMN IF EXISTS
-- SQLite 不支持此语法，需要通过 prisma db push 重建表

-- 2.1 删除爆款分析相关字段
ALTER TABLE "merchant_profiles"
DROP COLUMN IF EXISTS "topContentAnalysis";

ALTER TABLE "merchant_profiles"
DROP COLUMN IF EXISTS "goldenThreeSeconds";

ALTER TABLE "merchant_profiles"
DROP COLUMN IF EXISTS "emotionalTriggers";

ALTER TABLE "merchant_profiles"
DROP COLUMN IF EXISTS "contentFormats";

-- 2.2 删除创作指南相关字段
ALTER TABLE "merchant_profiles"
DROP COLUMN IF EXISTS "trendingTopics";

ALTER TABLE "merchant_profiles"
DROP COLUMN IF EXISTS "tagStrategy";

ALTER TABLE "merchant_profiles"
DROP COLUMN IF EXISTS "publishingTips";

-- ============================================================================
-- Step 3: 验证数据完整性
-- ============================================================================

-- 3.1 验证表结构
-- \d+ merchant_profiles  -- PostgreSQL命令

-- 3.2 验证核心字段仍然存在
-- SELECT COUNT(*) FROM "merchant_profiles"
-- WHERE "briefIntro" IS NOT NULL;

-- 3.3 确认没有依赖这些字段的查询
-- grep -r "topContentAnalysis\|goldenThreeSeconds\|emotionalTriggers" app/ lib/ components/

-- ============================================================================
-- Notes for SQLite (Development Environment)
-- ============================================================================

-- SQLite 不支持 DROP COLUMN 操作，需要：
-- 1. 修改 schema.prisma 文件（已完成）
-- 2. 运行 `pnpm db:push` 让 Prisma 重建表
-- 3. 数据会自动迁移到新表结构

-- ============================================================================
-- Notes for Production Deployment (PostgreSQL)
-- ============================================================================

-- 1. 备份数据库：
--    pg_dump -U postgres -d zhidianai > backup_before_profile_cleanup.sql

-- 2. 在生产环境运行前，先在 staging 环境测试

-- 3. 检查是否有代码仍在使用这些字段：
--    grep -r "topContentAnalysis" .
--    grep -r "goldenThreeSeconds" .
--    grep -r "emotionalTriggers" .
--    grep -r "contentFormats" .
--    grep -r "trendingTopics" .
--    grep -r "tagStrategy" .
--    grep -r "publishingTips" .

-- 4. 如果有历史数据需要保留，先导出到归档表

-- 5. 回滚方案：
--    - 恢复备份数据库
--    - 或者重新添加字段（数据将丢失）

-- 6. 监控事项：
--    - MerchantProfile 查询错误
--    - 商家档案生成功能是否正常
--    - Brief 字段的使用情况

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- 执行此迁移后，MerchantProfile 将只保留以下核心字段：
-- - Brief 部分（5个字段）：briefIntro, briefSellingPoints, briefUsageScenarios, briefAudienceProfile, briefBrandTone
-- - 用户编辑部分（4个字段）：customBackground, customOfflineInfo, customProductDetails, customDosAndDonts
-- - 元数据：aiGeneratedAt, aiModelUsed, aiTokenUsed

-- 这符合 "简单胜过复杂" 的设计原则，删除了不必要的抽象层
