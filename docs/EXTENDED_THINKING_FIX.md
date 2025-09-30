# Extended Thinking 模式 API 错误修复报告

## 问题描述

**错误信息：**
```
API Error: 400
{
  "error": {
    "type": "<nil>",
    "message": "`max_tokens` must be greater than `thinking.budget_tokens`"
  },
  "type": "error"
}
```

**问题原因：**
- 使用 Claude Sonnet 4.5 Extended Thinking 模式时
- API 调用**缺少 `max_tokens` 参数**
- Extended Thinking 模式要求 `max_tokens` > `thinking.budget_tokens`（内部自动分配，通常10000）

## 根本原因分析

1. **app/api/chat/route.ts:171** - API 调用时未传递 `max_tokens`：
   ```typescript
   // ❌ 修复前
   body: JSON.stringify({
     model,
     messages: finalMessages,
     temperature,
     stream: true
   })
   ```

2. **lib/constants/message-limits.ts** - 模型配置中没有定义 `maxTokens`

3. **Extended Thinking 模式特殊要求：**
   - 必须明确指定 `max_tokens`
   - 值必须足够大（≥16000 推荐）
   - API 内部会自动分配 `thinking.budget_tokens`（通常5000-10000）

## 修复方案

### 1. 更新模型配置（lib/constants/message-limits.ts）

**添加 `maxTokens` 字段：**
```typescript
MODEL_CONFIGS: {
  'claude-sonnet-4-5-20250929-thinking': {
    contextWindow: 200000,
    reserveTokens: 8000,
    maxTokens: 16000  // ✅ Extended Thinking 专用
  },
  'claude-sonnet-4-5-20250929': {
    contextWindow: 200000,
    reserveTokens: 8000,
    maxTokens: 8000   // ✅ 标准模式
  },
  // ... 其他模型
}
```

**更新 `getModelContextConfig` 函数：**
```typescript
return {
  maxMessages: 120,
  maxTokens: contextMaxTokens,        // 上下文窗口token数
  reserveTokens: modelConfig.reserveTokens,
  modelWindow: modelConfig.contextWindow,
  outputMaxTokens: modelConfig.maxTokens || 8000,  // ✅ API max_tokens参数
  limitApplied: false
};
```

### 2. 更新 Chat API（app/api/chat/route.ts）

**添加导入：**
```typescript
import { getModelContextConfig } from "@/lib/constants/message-limits"
```

**修改 API 调用：**
```typescript
// ✅ 修复后
const modelConfig = getModelContextConfig(model)
const maxTokens = modelConfig.outputMaxTokens || 8000

const aiResponse = await fetch(`${API_BASE}/chat/completions`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    messages: finalMessages,
    temperature,
    max_tokens: maxTokens,  // ✅ 添加 max_tokens 参数
    stream: true
  })
})
```

## 验证结果

**测试脚本：** `scripts/test-thinking-config.ts`

```
✅ Extended Thinking max_tokens (16000) >= 16000
✅ 标准模式 max_tokens (8000) >= 4096
```

## 参数说明

### Extended Thinking 模式 API 参数

```json
{
  "model": "claude-sonnet-4-5-20250929-thinking",
  "max_tokens": 16000,
  "messages": [...],
  "temperature": 0.7,
  "stream": true
}
```

**参数解释：**
- `max_tokens: 16000` - 总输出限制
  - Thinking 阶段：~10000 tokens（API自动分配）
  - 实际输出：~6000 tokens
  - 满足 `max_tokens > thinking.budget_tokens` 要求

### 为什么选择 16000？

| 模式 | thinking_budget | output | total_required |
|------|----------------|---------|----------------|
| 轻度思考 | 5000 | 3000 | 8000+ |
| 中度思考 | 8000 | 4000 | 12000+ |
| **深度思考** | **10000** | **6000** | **16000+** |

**推荐配置：**
- Extended Thinking: 16000 (覆盖深度思考场景)
- 标准 Claude: 8000 (常规对话足够)
- GPT/Gemini: 4096-8000

## 影响范围

### 修复的文件
1. ✅ `lib/constants/message-limits.ts` - 添加 `maxTokens` 配置
2. ✅ `app/api/chat/route.ts` - 添加 `max_tokens` API 参数

### 不需要修改的文件
- `app/api/debug/ai-test/route.ts` - 已有 `max_tokens: 100`
- 前端代码 - 无需改动

## 测试验证清单

- [x] 配置文件更新
- [x] API 调用添加 max_tokens
- [x] 配置测试脚本通过
- [ ] **实际 API 调用测试**（需要重启服务器）
- [ ] Extended Thinking 模式对话测试
- [ ] 标准模式兼容性测试

## 后续操作

### 1. 重启开发服务器
```bash
# 停止当前服务器 (Ctrl+C)
pnpm dev
```

### 2. 测试 Extended Thinking 模式
访问聊天界面，选择 "Claude Sonnet 4.5 (Extended Thinking)" 模型，发送测试消息。

### 3. 检查 API 请求日志
确认请求中包含正确的 `max_tokens` 参数。

## 技术参考

### Anthropic 官方文档
- Extended Thinking: https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking
- API Reference: https://docs.anthropic.com/en/api/messages

### 关键要点
1. **Extended Thinking 必需参数：** `max_tokens` >= 16000（推荐）
2. **API 内部行为：** 自动分配 `thinking.budget_tokens`，无需手动指定
3. **错误处理：** 如果 `max_tokens` 太小，API 返回 400 错误

## 修复时间
- 发现问题：2025-09-30 12:52
- 完成修复：2025-09-30 13:15
- 测试验证：待重启服务器后进行

## 附录：Claude Code 配置

如果使用 Claude Code CLI 工具，确保配置正确：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-api-key",
    "ANTHROPIC_BASE_URL": "https://jp.duckcoding.com",  // 或官方API
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

**注意事项：**
- 第三方代理（如 duckcoding.com）可能有自己的限制
- 建议使用官方 API 或 302.AI 代理
- 检查代理服务是否支持 Extended Thinking 模式