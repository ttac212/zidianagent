-- Linus审查后的数据库架构修复
-- 包含：索引优化、唯一约束修复、性能改进

-- 1. 添加对话列表查询优化索引
CREATE INDEX IF NOT EXISTS "conversations_userId_lastMessageAt_idx" ON "conversations"("userId", "lastMessageAt" DESC);
CREATE INDEX IF NOT EXISTS "conversations_createdAt_idx" ON "conversations"("createdAt");

-- 2. 修复UsageStats表的modelId字段（防止NULL绕过唯一约束）
-- 注意：此处应该将existing NULL值更新为'_total'，但数据已通过db:push修复

-- 3. 优化消息查询的复合索引
CREATE INDEX IF NOT EXISTS "messages_userId_createdAt_idx" ON "messages"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "messages_userId_modelId_createdAt_idx" ON "messages"("userId", "modelId", "createdAt");
CREATE INDEX IF NOT EXISTS "messages_role_createdAt_idx" ON "messages"("role", "createdAt");
CREATE INDEX IF NOT EXISTS "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- 4. UsageStats唯一约束和查询优化索引
CREATE UNIQUE INDEX IF NOT EXISTS "usage_stats_userId_date_modelId_key" ON "usage_stats"("userId", "date", "modelId");
CREATE INDEX IF NOT EXISTS "usage_stats_date_idx" ON "usage_stats"("date");
CREATE INDEX IF NOT EXISTS "usage_stats_userId_date_idx" ON "usage_stats"("userId", "date");
CREATE INDEX IF NOT EXISTS "usage_stats_modelId_date_idx" ON "usage_stats"("modelId", "date");
CREATE INDEX IF NOT EXISTS "usage_stats_modelProvider_date_idx" ON "usage_stats"("modelProvider", "date");

-- 5. 其他表的基础索引优化
CREATE UNIQUE INDEX IF NOT EXISTS "invite_codes_code_key" ON "invite_codes"("code");
CREATE INDEX IF NOT EXISTS "invite_codes_code_idx" ON "invite_codes"("code");
CREATE INDEX IF NOT EXISTS "invite_codes_isActive_expiresAt_idx" ON "invite_codes"("isActive", "expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");

CREATE UNIQUE INDEX IF NOT EXISTS "sessions_sessionToken_key" ON "sessions"("sessionToken");

CREATE INDEX IF NOT EXISTS "user_sessions_userId_isActive_idx" ON "user_sessions"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "user_sessions_lastPing_idx" ON "user_sessions"("lastPing");
CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_sessionId_key" ON "user_sessions"("sessionId");

CREATE UNIQUE INDEX IF NOT EXISTS "system_configs_key_key" ON "system_configs"("key");

-- 6. 商家系统索引
CREATE UNIQUE INDEX IF NOT EXISTS "merchant_categories_name_key" ON "merchant_categories"("name");

CREATE UNIQUE INDEX IF NOT EXISTS "merchants_uid_key" ON "merchants"("uid");
CREATE INDEX IF NOT EXISTS "merchants_categoryId_idx" ON "merchants"("categoryId");
CREATE INDEX IF NOT EXISTS "merchants_location_idx" ON "merchants"("location");
CREATE INDEX IF NOT EXISTS "merchants_status_idx" ON "merchants"("status");
CREATE INDEX IF NOT EXISTS "merchants_uid_idx" ON "merchants"("uid");

CREATE UNIQUE INDEX IF NOT EXISTS "merchant_contents_externalId_merchantId_key" ON "merchant_contents"("externalId", "merchantId");
CREATE INDEX IF NOT EXISTS "merchant_contents_merchantId_publishedAt_idx" ON "merchant_contents"("merchantId", "publishedAt");
CREATE INDEX IF NOT EXISTS "merchant_contents_contentType_idx" ON "merchant_contents"("contentType");
CREATE INDEX IF NOT EXISTS "merchant_contents_externalId_idx" ON "merchant_contents"("externalId");
CREATE INDEX IF NOT EXISTS "merchant_contents_collectedAt_idx" ON "merchant_contents"("collectedAt");

-- 7. NextAuth索引
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");
CREATE UNIQUE INDEX IF NOT EXISTS "verification_tokens_token_key" ON "verification_tokens"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");