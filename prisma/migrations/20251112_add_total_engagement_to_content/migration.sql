-- 添加 totalEngagement 字段到 merchant_contents 表
-- 用于优化按互动量排序的查询性能

-- 1. 添加字段（默认值为0）
ALTER TABLE merchant_contents ADD COLUMN totalEngagement INTEGER NOT NULL DEFAULT 0;

-- 2. 回填现有数据的 totalEngagement
UPDATE merchant_contents
SET totalEngagement = diggCount + commentCount + collectCount + shareCount;

-- 3. 创建索引以优化排序查询
CREATE INDEX idx_merchant_contents_merchant_engagement
ON merchant_contents(merchantId, totalEngagement DESC);
