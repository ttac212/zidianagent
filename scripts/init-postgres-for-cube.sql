-- 初始化 PostgreSQL 数据库用于 Cube.dev
-- 创建基本表结构和测试数据

-- 创建 users 表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  "emailVerified" TIMESTAMP,
  username TEXT UNIQUE,
  "displayName" TEXT,
  avatar TEXT,
  role TEXT DEFAULT 'USER',
  status TEXT DEFAULT 'ACTIVE',
  "monthlyTokenLimit" INTEGER DEFAULT 100000,
  "currentMonthUsage" INTEGER DEFAULT 0,
  "totalTokenUsed" INTEGER DEFAULT 0,
  "lastResetAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "lastActiveAt" TIMESTAMP
);

-- 创建 conversations 表
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT DEFAULT '新对话',
  "userId" TEXT NOT NULL,
  "modelId" TEXT DEFAULT 'gpt-3.5-turbo',
  temperature REAL DEFAULT 0.7,
  "maxTokens" INTEGER DEFAULT 2000,
  "contextAware" BOOLEAN DEFAULT true,
  "messageCount" INTEGER DEFAULT 0,
  "totalTokens" INTEGER DEFAULT 0,
  metadata JSONB,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "lastMessageAt" TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- 创建 messages 表
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  "originalContent" TEXT,
  "promptTokens" INTEGER DEFAULT 0,
  "completionTokens" INTEGER DEFAULT 0,
  "modelId" TEXT NOT NULL,
  temperature REAL,
  "finishReason" TEXT,
  metadata JSONB,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("conversationId") REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
);

-- 创建 usage_stats 表（核心）
CREATE TABLE IF NOT EXISTS usage_stats (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  date TIMESTAMP NOT NULL,
  "modelId" TEXT DEFAULT '_total',
  "modelProvider" TEXT,
  "apiCalls" INTEGER DEFAULT 0,
  "successfulCalls" INTEGER DEFAULT 0,
  "failedCalls" INTEGER DEFAULT 0,
  "promptTokens" INTEGER DEFAULT 0,
  "completionTokens" INTEGER DEFAULT 0,
  "conversationsCreated" INTEGER DEFAULT 0,
  "messagesCreated" INTEGER DEFAULT 0,
  "totalActiveTime" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE ("userId", date, "modelId")
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_usage_stats_date ON usage_stats(date);
CREATE INDEX IF NOT EXISTS idx_usage_stats_user_date ON usage_stats("userId", date);
CREATE INDEX IF NOT EXISTS idx_usage_stats_model_date ON usage_stats("modelId", date);
CREATE INDEX IF NOT EXISTS idx_conversations_user_last_msg ON conversations("userId", "lastMessageAt" DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages("conversationId", "createdAt");

-- 插入测试用户
INSERT INTO users (id, email, "displayName", role, "monthlyTokenLimit", "currentMonthUsage", "createdAt")
VALUES
  ('test-user-1', 'test@example.com', '测试用户', 'USER', 100000, 25000, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 插入测试对话
INSERT INTO conversations (id, title, "userId", "modelId", "messageCount", "totalTokens", "createdAt", "lastMessageAt")
VALUES
  ('conv-1', '测试对话1', 'test-user-1', 'claude-sonnet-4', 10, 5000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 插入测试使用量数据（最近30天）
INSERT INTO usage_stats (
  id, "userId", date, "modelId", "modelProvider",
  "apiCalls", "successfulCalls", "failedCalls",
  "promptTokens", "completionTokens",
  "conversationsCreated", "messagesCreated",
  "createdAt"
)
SELECT
  'stat-' || to_char(d, 'YYYY-MM-DD') || '-' || m.model,
  'test-user-1',
  d::date,
  m.model,
  m.provider,
  (random() * 50 + 10)::integer,
  (random() * 45 + 10)::integer,
  (random() * 5)::integer,
  (random() * 2000 + 500)::integer,
  (random() * 3000 + 1000)::integer,
  (random() * 3)::integer,
  (random() * 20 + 5)::integer,
  d
FROM
  generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS d,
  (VALUES
    ('claude-sonnet-4', 'anthropic'),
    ('gpt-4', 'openai'),
    ('gemini-pro', 'google')
  ) AS m(model, provider)
ON CONFLICT ("userId", date, "modelId") DO NOTHING;

-- 验证数据
SELECT
  COUNT(*) as total_records,
  COUNT(DISTINCT "userId") as unique_users,
  COUNT(DISTINCT "modelId") as unique_models,
  SUM("promptTokens" + "completionTokens") as total_tokens
FROM usage_stats;
