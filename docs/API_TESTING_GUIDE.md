# API模型测试指南

## 概述

本指南描述了如何测试和验证新添加的AI模型是否正常工作。

## 已验证的模型

### ✅ Claude Opus 4.1 
- **模型ID**: `claude-opus-4-1-20250805`
- **API Key**: `sk-9mlBbEdFEt26NBVIVGXVNzMeBgMeUYvgnk3J1kydUddl8BtE`
- **状态**: 测试通过 ✅
- **响应**: 正常返回预期内容
- **Token使用**: 35 (prompt: 29, completion: 6)

### ✅ Gemini 2.5 Pro
- **模型ID**: `gemini-2.5-pro` 
- **API Key**: `sk-MkU5p0ggCQvf1Cq3hJVFzV28xwyeudo2AvkLk7Rh4l0QFKMM`
- **状态**: 测试通过 ✅
- **响应**: API连接正常
- **Token使用**: 18 (prompt: 9, completion: 9)

## 快速测试

### 1. 运行快速验证脚本

```bash
node scripts/test-models.js
```

### 2. 运行完整测试套件

```bash
pnpm test tests/api-model-validation.test.ts
```

### 3. 手动测试单个模型

```javascript
// 在Node.js环境中
const { manualTestModel } = require('./tests/api-model-validation.test.ts');

// 测试Claude模型
await manualTestModel(
  'claude-opus-4-1-20250805', 
  'sk-9mlBbEdFEt26NBVIVGXVNzMeBgMeUYvgnk3J1kydUddl8BtE'
);

// 测试Gemini模型  
await manualTestModel(
  'gemini-2.5-pro',
  'sk-MkU5p0ggCQvf1Cq3hJVFzV28xwyeudo2AvkLk7Rh4l0QFKMM'
);
```

## 环境配置

### 1. 更新 .env 文件

```env
# 主要API Key (推荐使用Claude)
LLM_API_KEY=sk-9mlBbEdFEt26NBVIVGXVNzMeBgMeUYvgnk3J1kydUddl8BtE

# 或使用Gemini
# LLM_API_KEY=sk-MkU5p0ggCQvf1Cq3hJVFzV28xwyeudo2AvkLk7Rh4l0QFKMM

# 模型白名单
MODEL_ALLOWLIST=claude-opus-4-1-20250805,gemini-2.5-pro,gemini-2.5-pro-preview-06-05
```

### 2. 验证配置

```bash
# 启动开发服务器
pnpm dev

# 访问测试页面
http://localhost:3007/dev/test-model
```

## 集成测试

### 1. 本地API端点测试

测试 `/api/chat` 端点是否正确处理新模型：

```bash
curl -X POST http://localhost:3007/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-session-token" \
  -d '{
    "model": "claude-opus-4-1-20250805",
    "messages": [
      {"role": "user", "content": "Hello, test message"}
    ],
    "temperature": 0.7
  }'
```

### 2. 前端集成测试

1. 打开应用 `http://localhost:3007/workspace`
2. 选择新模型（Claude Opus 4.1 或 Gemini 2.5 Pro）
3. 发送测试消息
4. 验证响应是否正常

## 故障排除

### 常见问题

#### 1. API Key 无效 (401错误)
- **原因**: API Key过期或无效
- **解决**: 检查302.ai控制台确认Key状态

#### 2. 模型未找到 (404错误)  
- **原因**: 模型名称变更或不支持
- **解决**: 检查302.ai支持的模型列表

#### 3. 请求限制 (429错误)
- **原因**: 请求过于频繁
- **解决**: 增加请求间隔或升级配额

### 调试工具

#### 1. 开发者控制台调试

在浏览器中打开开发者工具，运行：

```javascript
// 导出模型状态
window.ModelDebugTools.exportModelStates()

// 强制设置模型
window.ModelDebugTools.forceSetModel('claude-opus-4-1-20250805')

// 重置模型状态
window.ModelDebugTools.resetModelStates()
```

#### 2. 服务器日志

启动开发服务器时查看控制台日志：

```bash
pnpm dev
# 查看模型验证日志
# 查看API请求日志
```

## 生产部署注意事项

### 1. API Key 安全

- ✅ API Keys已配置为服务端使用
- ✅ 不会暴露到前端代码
- ✅ 支持环境变量配置

### 2. 模型选择建议

- **日常对话**: 使用 `gemini-2.5-pro` (性价比高)
- **复杂分析**: 使用 `claude-opus-4-1-20250805` (质量更高)
- **兼容性**: 保留 `gemini-2.5-pro-preview-06-05` 作为回退

### 3. 监控和限制

- 配置合适的 `monthlyTokenLimit`
- 监控API调用量和成本
- 设置适当的请求频率限制

## 测试结果

最近测试时间: ${new Date().toISOString()}

| 模型 | 状态 | 响应时间 | Token使用 | 备注 |
|------|------|----------|-----------|------|
| claude-opus-4-1-20250805 | ✅ 正常 | ~2s | 35 tokens | 响应准确 |  
| gemini-2.5-pro | ✅ 正常 | ~1s | 18 tokens | 速度快 |

## 下一步

1. ✅ 模型白名单已更新
2. ✅ API连接已验证  
3. ✅ 测试套件已创建
4. 🔄 生产环境配置（待用户确认）
5. 🔄 用户培训和文档（按需）

---

*如需帮助，请参考项目的 CLAUDE.md 文件或联系开发团队。*