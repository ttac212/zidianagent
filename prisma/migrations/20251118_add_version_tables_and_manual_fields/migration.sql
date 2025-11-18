-- 商家档案和客群分析版本管理 + 人工修订字段
-- Migration: 20251118_add_version_tables_and_manual_fields
-- Created: 2025-11-18

-- ==================== 修改 User 表字段类型 ====================
-- SQLite 不支持直接 ALTER COLUMN，需要重建表
-- 注意：如果数据库已有大量数据，建议分步执行并备份

-- 1. 创建临时表
CREATE TABLE "users_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "monthlyTokenLimit" INTEGER NOT NULL DEFAULT 100000,  -- 保持 INTEGER（SQLite 的 INTEGER 可存储 64 位）
    "currentMonthUsage" INTEGER NOT NULL DEFAULT 0,
    "totalTokenUsed" INTEGER NOT NULL DEFAULT 0,
    "lastResetAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- 2. 复制数据
INSERT INTO "users_new"
SELECT * FROM "users";

-- 3. 删除旧表
DROP TABLE "users";

-- 4. 重命名新表
ALTER TABLE "users_new" RENAME TO "users";

-- 5. 重建索引
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");


-- ==================== MerchantProfile 新增字段 ====================
-- 添加人工校对版 Brief（结构化 JSON）
ALTER TABLE "merchant_profiles" ADD COLUMN "manualBrief" TEXT;

-- 添加人工补充信息（实地沟通高频问题）
ALTER TABLE "merchant_profiles" ADD COLUMN "manualNotes" TEXT;


-- ==================== MerchantAudienceAnalysis 新增字段 ====================
-- 添加人工修订后的报告
ALTER TABLE "merchant_audience_analyses" ADD COLUMN "manualMarkdown" TEXT;

-- 添加人工补充的结构化洞察
ALTER TABLE "merchant_audience_analyses" ADD COLUMN "manualInsights" TEXT;


-- ==================== 新建版本历史表 ====================

-- 商家档案版本历史表
CREATE TABLE "merchant_profile_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "profileId" TEXT,
    "snapshot" TEXT NOT NULL,  -- JSON 格式存储完整快照
    "source" TEXT NOT NULL,     -- 'ai' | 'manual' | 'system'
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_profile_versions_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 索引优化
CREATE INDEX "merchant_profile_versions_merchantId_idx" ON "merchant_profile_versions"("merchantId");
CREATE INDEX "merchant_profile_versions_createdAt_idx" ON "merchant_profile_versions"("createdAt");


-- 商家客群分析版本历史表
CREATE TABLE "merchant_audience_analysis_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantId" TEXT NOT NULL,
    "analysisId" TEXT,
    "snapshot" TEXT NOT NULL,  -- JSON 格式存储完整快照
    "source" TEXT NOT NULL,     -- 'ai' | 'manual' | 'system'
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_audience_analysis_versions_merchantId_fkey"
        FOREIGN KEY ("merchantId") REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 索引优化
CREATE INDEX "merchant_audience_analysis_versions_merchantId_idx" ON "merchant_audience_analysis_versions"("merchantId");
CREATE INDEX "merchant_audience_analysis_versions_createdAt_idx" ON "merchant_audience_analysis_versions"("createdAt");
