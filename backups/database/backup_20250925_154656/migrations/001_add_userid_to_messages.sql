-- Linus式优化：添加userId到Message表避免JOIN查询
-- 原因：配额检查每次都需要JOIN conversation表太慢了

-- 1. 添加userId字段到Message表（允许NULL，用于迁移现有数据）
ALTER TABLE messages ADD COLUMN userId TEXT;

-- 2. 填充现有记录的userId（从conversation表获取）
UPDATE messages
SET userId = (
  SELECT conversations.userId
  FROM conversations
  WHERE conversations.id = messages.conversationId
);

-- 3. 设置非空约束（现在所有记录都有值了）
-- SQLite不支持直接添加NOT NULL约束，需要重建表
CREATE TABLE messages_new (
  id TEXT PRIMARY KEY,
  conversationId TEXT NOT NULL,
  userId TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  originalContent TEXT,
  promptTokens INTEGER DEFAULT 0,
  completionTokens INTEGER DEFAULT 0,
  totalTokens INTEGER DEFAULT 0,
  modelId TEXT NOT NULL,
  temperature REAL,
  finishReason TEXT,
  metadata TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- 复制数据
INSERT INTO messages_new SELECT
  id, conversationId, userId, role, content, originalContent,
  promptTokens, completionTokens, totalTokens, modelId, temperature,
  finishReason, metadata, createdAt
FROM messages;

-- 替换表
DROP TABLE messages;
ALTER TABLE messages_new RENAME TO messages;

-- 4. 创建必要的索引
CREATE INDEX idx_messages_conversation_created ON messages(conversationId, createdAt);
CREATE INDEX idx_messages_role_created ON messages(role, createdAt);
CREATE INDEX idx_messages_user_created ON messages(userId, createdAt); -- 新增：配额查询优化
CREATE INDEX idx_messages_user_model_created ON messages(userId, modelId, createdAt); -- 按模型统计优化