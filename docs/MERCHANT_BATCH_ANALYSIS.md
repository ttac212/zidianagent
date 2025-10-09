# 商家批量分析系统

批量分析商家数据,为短视频文案创作提供数据支持。

## 功能概览

本系统包含两种分析模式:

1. **基础统计分析** - 快速统计商家的内容数量、互动数据、内容类型分布等
2. **AI深度分析** - 基于短视频转录文本，通过LLM生成详细的商家分析报告（内容策略、营销手法、受众画像、爆款文案结构等）

## 快速开始

### 1. 导出商家数据

```bash
# 导出所有活跃商家（包含转录文本）
npx tsx scripts/export-merchant-data.ts

# 导出前20个商家
npx tsx scripts/export-merchant-data.ts 20

# 导出到指定路径
npx tsx scripts/export-merchant-data.ts 50 ACTIVE data/my-merchants.json
```

**参数说明:**
- `limit` (可选): 导出数量,不指定则导出全部
- `status` (可选): 商家状态,默认 ACTIVE
- `outputPath` (可选): 输出路径,默认 data/merchants-export.json

### 2. 基础统计分析

```bash
# 分析导出的商家数据（快速统计）
npx tsx scripts/analyze-merchants-batch.ts

# 指定输入输出路径
npx tsx scripts/analyze-merchants-batch.ts data/merchants-export.json data/reports

# 指定批次大小
npx tsx scripts/analyze-merchants-batch.ts data/merchants-export.json data/reports 20
```

### 3. AI深度分析

**前提条件**: 确保已配置 `LLM_API_KEY` 环境变量

```bash
# 测试AI分析功能
npx tsx scripts/run-ai-analysis.ts test

# 分析单个商家（从数据库）
npx tsx scripts/run-ai-analysis.ts merchant <merchantId>

# 批量AI分析（从导出文件）
npx tsx scripts/run-ai-analysis.ts batch data/merchants-export.json data/ai-reports

# 示例
npx tsx scripts/run-ai-analysis.ts merchant cmewpn33d02wowtns3dray1dn
```

**注意**: AI分析会消耗API tokens，建议先测试单个商家，确认效果后再批量处理。

**参数说明:**
- `inputPath` (可选): 输入文件路径,默认 data/merchants-export.json
- `outputDir` (可选): 报告输出目录,默认 data/analysis-reports
- `batchSize` (可选): 每批处理数量,默认 10

### 4. 查看报告

**基础统计报告**:
```
data/analysis-reports/
├── summary.json           # 汇总报告
├── 1234567_商家A.json     # 单个商家报告
├── 1234568_商家B.json
└── ...
```

**AI深度分析报告**:
```
data/ai-analysis-reports/
├── ai-analysis-summary.json           # AI分析汇总
├── 1234567_商家A_AI.json              # AI深度报告
├── 1234568_商家B_AI.json
└── ...
```

## 报告内容说明

### 基础统计报告

每个商家的基础统计报告包含:

### 基本信息
- 商家名称、分类、地区
- 业务类型(B2B/B2C/B2B2C)
- 数据来源

### 内容统计
- 总内容数量
- 各类型内容分布(视频/文章/图片等)
- 内容类型占比

### 互动数据
- 总点赞/评论/收藏/分享数
- 平均每条内容的互动量
- 综合互动率评级

### 内容特点
- 最受欢迎的内容类型
- 发布频率估算
- 热门内容TOP 3

### 商家标签
自动生成的特征标签,如:
- B2C
- 餐饮美食
- 北京
- 视频为主
- 高互动

### 短视频文案建议
基于数据分析生成的文案创作建议,包括:
- 核心业务介绍角度
- 热门内容参考方向
- 互动优势突出点
- 内容类型延续建议
- 地域特色融入

### AI深度分析报告

AI深度分析报告基于短视频转录文本生成，包含以下维度:

#### 1. 基本信息
- 主营业务总结
- 核心产品/服务列表
- 业务模式描述

#### 2. 内容策略
- 视频内容类型（产品展示、工艺科普、客户案例等）
- 发布频率分析
- 表现形式（现场实拍、对比演示等）
- 核心主题提取

#### 3. 优势与保障
- 成本与价格优势
- 便捷性（一站式服务、全国配送等）
- 定制化能力
- 品质保障措施

#### 4. 营销策略
- 信任建立方式（官方授权展示、客户案例等）
- 差异化竞争点
- 转化路径（评论区留言、私信咨询等）
- 促销手段分析

#### 5. 内容表现手法
- 视觉呈现方式
- 语言风格特点
- 互动设计
- 情感诉求点

#### 6. 受众特点
- 主要地域分布
- 核心需求分析
- 消费心理洞察
- 用户痛点识别

#### 7. 爆款文案结构分析
- 文案类型（秀肌肉型、痛点解决型、价值科普型等）
- 结构拆解:
  - 钩子（0-3秒如何吸引注意）
  - 核心内容（3-20秒传递什么信息）
  - 行动号召（结尾如何引导转化）
- 实际案例分析
- 效果评估

#### 8. 关键洞察
- 优势分析
- 改进建议
- 内容创作建议
- 竞争优势总结

#### 9. 数据支持
- 分析的内容数量
- 平均互动量
- TOP内容及关键要点

#### 10. AI元数据
- 使用的AI模型
- 分析使用的token数
- 分析置信度
- 处理时间

### 基础统计 vs AI深度分析对比

| 维度 | 基础统计 | AI深度分析 |
|------|---------|-----------|
| 速度 | 快速（秒级） | 较慢（分钟级，取决于内容量） |
| 成本 | 免费 | 消耗LLM API tokens |
| 深度 | 数据统计 | 深度洞察 |
| 依赖 | 无 | 需要转录文本 + LLM API |
| 适用场景 | 快速概览、批量处理 | 深度分析、文案创作指导 |

## 使用示例

### 完整流程（基础分析）

```bash
# 1. 导出前100个商家
npx tsx scripts/export-merchant-data.ts 100

# 2. 批量分析
npx tsx scripts/analyze-merchants-batch.ts

# 3. 查看汇总报告
cat data/analysis-reports/summary.json

# 4. 查看单个商家报告
cat data/analysis-reports/1234567_某商家.json
```

### AI深度分析流程

```bash
# 1. 导出商家数据（包含转录文本）
npx tsx scripts/export-merchant-data.ts 10

# 2. 测试AI分析（推荐先测试）
npx tsx scripts/run-ai-analysis.ts test

# 3. 分析单个商家
npx tsx scripts/run-ai-analysis.ts merchant cmewpn33d02wowtns3dray1dn

# 4. 批量AI分析
npx tsx scripts/run-ai-analysis.ts batch

# 5. 查看AI分析报告
cat data/ai-analysis-reports/1234567_商家A_AI.json
```

### 按分类分析

```bash
# 导出特定状态的商家
npx tsx scripts/export-merchant-data.ts 50 ACTIVE

# 分析后可以根据 category 字段筛选
```

## 数据结构

### MerchantExportData (导出格式)

```typescript
{
  id: string
  uid: string
  name: string
  description: string | null
  category: string | null
  location: string | null
  businessType: "B2B" | "B2C" | "B2B2C"
  totalContentCount: number
  totalDiggCount: number
  videoCount: number
  articleCount: number
  recentContents: Array<{...}>
}
```

### AnalysisReport (分析报告格式)

```typescript
{
  merchantId: string
  merchantName: string
  analysisDate: string
  basicInfo: {...}
  contentStats: {...}
  engagementMetrics: {...}
  contentInsights: {...}
  tags: string[]
  videoScriptSuggestions: string[]
}
```

## 扩展使用

### 自定义分析逻辑

修改 `scripts/analyze-merchants-batch.ts` 中的以下函数:

- `analyzeMerchant()` - 主分析逻辑
- `generateTags()` - 标签生成规则
- `generateVideoScriptSuggestions()` - 文案建议生成

### 与 AI 集成

可以将生成的报告文件作为 prompt 输入给 AI:

```bash
# 示例: 使用 Claude Code 分析单个商家
claude "根据这份报告生成短视频文案: $(cat data/analysis-reports/1234567_商家A.json)"
```

## 注意事项

1. **数据库连接**: 确保 DATABASE_URL 已配置
2. **磁盘空间**: 大量商家可能生成较多文件
3. **性能**: 批次大小建议 10-20,避免内存溢出
4. **错误处理**: 脚本会自动跳过数据异常的商家

## 故障排查

### 导出失败

```bash
# 检查数据库连接
npx tsx scripts/test/verify-all-apis.js

# 查看商家数量
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM merchants;"
```

### 分析报告为空

检查导出文件是否存在:
```bash
ls -lh data/merchants-export.json
```

### 文件路径错误

Windows 用户注意使用反斜杠或引号:
```bash
npx tsx scripts/analyze-merchants-batch.ts "data\merchants-export.json"
```
