# AI深度分析功能使用指南

## ✅ 功能已完成

AI深度分析系统现已完成开发和测试！该系统能够从商家的短视频转录文本中提取商家信息，生成详细的分析报告。

## 📋 生成的报告包含

### 1. 基本信息
- 主营业务总结
- 核心产品/服务列表
- 业务模式描述

### 2. 内容策略
- 视频内容类型（产品展示、工艺科普、客户案例等）
- 发布频率分析
- 表现形式（现场实拍、对比演示等）
- 核心主题提取

### 3. 优势与保障
- 成本与价格优势
- 便捷性（一站式服务、全国配送等）
- 定制化能力
- 品质保障措施

### 4. 营销策略
- 信任建立方式
- 差异化竞争点
- 转化路径
- 促销手段分析

### 5. 内容表现手法
- 视觉呈现方式
- 语言风格特点
- 互动设计
- 情感诉求点

### 6. 受众特点
- 主要地域分布
- 核心需求分析
- 消费心理洞察
- 用户痛点识别

### 7. 爆款文案结构分析
- 文案类型分类
- 结构拆解（钩子、核心内容、行动号召）
- 实际案例分析
- 效果评估

### 8. 关键洞察
- 优势分析
- 改进建议
- 内容创作建议
- 竞争优势总结

### 9. 数据支持
- 分析的内容数量
- 平均互动量
- TOP内容及关键要点

### 10. AI元数据
- 使用的AI模型
- Token消耗
- 分析置信度
- 处理时间

## 🚀 快速开始

### 1. 简单测试

```bash
# 使用模拟数据测试（推荐首次使用）
npx tsx scripts/test-ai-simple.ts
```

### 2. 分析单个商家（从数据库）

```bash
# 前提：需要知道商家ID
npx tsx scripts/run-ai-analysis.ts merchant <merchantId>

# 示例
npx tsx scripts/run-ai-analysis.ts merchant cmewpn33d02wowtns3dray1dn
```

### 3. 批量分析

```bash
# 步骤1: 导出商家数据（包含转录文本）
npx tsx scripts/export-merchant-data.ts 10

# 步骤2: 批量AI分析
npx tsx scripts/run-ai-analysis.ts batch data/merchants-export.json data/ai-reports
```

## ⚙️ 环境要求

### 必需配置

在 `.env.local` 中配置:

```env
# LLM API配置
LLM_API_BASE=https://api.302.ai/v1
LLM_API_KEY=<你的API Key>

# 数据库
DATABASE_URL=file:./prisma/dev.db
```

### 依赖安装

```bash
pnpm install
```

项目已自动安装所需依赖：
- `dotenv` - 环境变量加载
- `@prisma/client` - 数据库访问
- 其他Next.js依赖

## 📊 测试结果示例

```
✅ 测试成功!

📋 分析结果预览:
──────────────────────────────────────────────────
主营业务: 爱格板和可丽芙板材的生产加工与批发
核心产品: 爱格板, 可丽芙板, 激光封边加工服务

内容策略:
  - 视频类型: 工厂实力展示, 产品真伪验证, 设备工艺展示
  - 发布频率: 日均1-2条

营销策略:
  - 信任建立: 订单溯源系统公开查询; 工厂实景展示
  - 差异化: 源头工厂身份; 德国豪迈设备

爆款文案模式数: 1

AI元数据:
  - 模型: claude-3-5-sonnet-20241022
  - Tokens: 3695
  - 置信度: 0.85
  - 耗时: 26.89秒
──────────────────────────────────────────────────
```

## 💡 使用提示

### Token消耗

- **单个商家分析**: 约3000-5000 tokens（取决于内容量）
- **批量分析**: tokens消耗 = 单个商家 × 商家数量
- **建议**: 先测试单个商家确认效果，再批量处理

### 分析深度选项

```typescript
analysisDepth: 'basic' | 'detailed' | 'comprehensive'
```

- `basic` - 基础分析，快速概览
- `detailed` - 详细分析，覆盖主要维度
- `comprehensive` - 全面分析，包含所有维度（默认）

### 转录文本要求

- ✅ 必须有转录文本（`transcript`字段）
- ✅ 文本越详细，分析越准确
- ⚠️ 没有转录文本的商家会被自动跳过

## 📁 输出文件

### 单个商家分析

```
data/ai-analysis-reports/
└── <uid>_<商家名>_AI.json
```

### 批量分析

```
data/ai-analysis-reports/
├── ai-analysis-summary.json        # 汇总报告
├── 1234567_商家A_AI.json
├── 1234568_商家B_AI.json
└── ...
```

## 🔧 自定义配置

### 修改分析模型

编辑 `scripts/ai-deep-analysis.ts`:

```typescript
const modelId = 'claude-3-5-sonnet-20241022' // 修改为其他模型
```

### 自定义Prompt

修改 `buildAnalysisPrompt()` 函数中的提示词模板。

### 调整API超时

修改 `callLLMForAnalysis()` 函数中的参数：

```typescript
max_tokens: 8000,     // 最大token数
temperature: 0.3,     // 温度（越低越稳定）
```

## 🐛 故障排查

### 1. LLM_API_KEY未设置

**错误**: `LLM_API_KEY环境变量未设置`

**解决**: 在 `.env.local` 中添加 `LLM_API_KEY=<你的key>`

### 2. 没有转录文本

**错误**: `没有可分析的转录文本`

**解决**: 确保商家内容中有 `transcript` 字段且不为空

### 3. JSON解析失败

**错误**: `LLM返回的JSON格式无效`

**解决**:
- 检查API响应
- 尝试降低分析深度
- 减少单次分析的内容数量

### 4. API速率限制

**错误**: `429 Too Many Requests`

**解决**:
- 批量分析时自动延迟2秒
- 减少并发请求数
- 检查API配额

## 📚 相关文档

- [商家批量分析系统](./MERCHANT_BATCH_ANALYSIS.md) - 完整的分析系统文档
- [类型定义](../types/merchant-analysis.ts) - TypeScript类型定义
- [核心分析逻辑](../scripts/ai-deep-analysis.ts) - AI分析实现

## 🎯 下一步

1. ✅ 测试单个商家分析
2. ✅ 查看生成的报告
3. ✅ 根据需要调整Prompt
4. ✅ 批量处理商家数据
5. 📝 将分析结果用于文案创作

---

**注意**: 此功能依赖LLM API，会产生token消耗。建议在测试环境中先验证效果，确认满意后再在生产环境中使用。