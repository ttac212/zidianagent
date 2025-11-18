# TikHub API 热门内容词测试工具

## 功能说明

这个测试工具用于测试 TikHub API 的热门内容词接口，获取抖音平台的热门关键词和话题趋势数据。

### API 信息
- **端点**: `/api/v1/douyin/billboard/fetch_hot_total_hot_word_list`
- **方法**: POST
- **认证**: Bearer Token (使用 `TIKHUB_API_KEY`)
- **参数**:
  - `page_num`: 页码，默认1
  - `page_size`: 每页数量，默认10
  - `date_window`: 时间窗口，1按小时 2按天，默认24
  - `keyword`: 搜索关键字（可选）
- **返回**: 热门内容词列表（按热度排序）

### 什么是热门内容词？

热门内容词是指在抖音平台上当前最受关注的关键词和话题，包括：
- 热门事件关键词（如"金鸡奖"、"全运会"）
- 热门人物名称（如明星、运动员、网红）
- 热门话题标签
- 流行文化关键词
- 社会热点关键词

这些数据对于以下场景非常有价值：
- **内容创作者**: 发现热门话题，优化创作方向
- **营销人员**: 制定基于热词的推广策略
- **数据分析师**: 研究用户兴趣和内容趋势
- **品牌运营**: 监控品牌相关热词和舆情

## 使用方法

### 1. 基本使用 - 获取全部热门内容词

```bash
npx tsx scripts/test-hot-word-list.ts
```

**输出内容包括**:
- 内容词标题
- 热度值（score）
- 上升比例（rising_ratio）
- 上升速度（rising_speed）
- 趋势数据（trends）
- 完整数据导出到 JSON 文件

**示例输出**:
```
╔══════════════════════════════════════════════════╗
║     TikHub API - 热门内容词测试工具              ║
╚══════════════════════════════════════════════════╝

=== 测试获取热门内容词列表（全部）===

查询参数:
  时间窗口: 按天
  每页数量: 10
  关键词筛选: 无

正在获取热门内容词...

✅ 成功获取热门内容词
本页数量: 10
总数: 10000
有更多数据: 是

=== 热门内容词列表 ===

1. 楚秉杰
   热度值: 1241.0万
   最新趋势: 20251115 - 329.2万

2. 中国电影金鸡奖
   热度值: 391.9万
   最新趋势: 20251115 - 100.7万

📄 完整数据已保存到: ./hot-word-list-output.json
```

### 2. 搜索特定关键词的热门内容词

```bash
# 搜索包含"美食"的热门内容词
npx tsx scripts/test-hot-word-list.ts --keyword=美食

# 搜索包含"科技"的热门内容词
npx tsx scripts/test-hot-word-list.ts --keyword=科技 --size=20

# 搜索包含"金鸡"的热门内容词
npx tsx scripts/test-hot-word-list.ts --keyword=金鸡 --size=5
```

**示例输出**:
```
=== 测试搜索热门内容词（关键词: 金鸡）===

查询参数:
  时间窗口: 按天
  每页数量: 5
  搜索关键词: 金鸡

正在搜索热门内容词...

✅ 成功获取热门内容词
本页数量: 5
总数: 1805
有更多数据: 是

=== 包含"金鸡"的热门内容词列表 ===

1. 金鸡
   热度值: 82.3万
   最新趋势: 20251115 - 61.0万

2. 金鸡奖
   热度值: 368.1万
   最新趋势: 20251115 - 218.3万

📄 完整数据已保存到: ./hot-word-list-金鸡-output.json
```

### 3. 自定义时间窗口和数量

```bash
# 查询按小时窗口的数据，每页50条
npx tsx scripts/test-hot-word-list.ts --window=1 --size=50

# 按天窗口，每页20条，搜索"美食"
npx tsx scripts/test-hot-word-list.ts --keyword=美食 --window=24 --size=20
```

## 请求参数结构

### 全部热门内容词查询
```json
{
  "page_num": 1,
  "page_size": 10,
  "date_window": 24,
  "keyword": ""
}
```

### 关键词搜索查询
```json
{
  "page_num": 1,
  "page_size": 10,
  "date_window": 24,
  "keyword": "美食"
}
```

### 按小时窗口查询
```json
{
  "page_num": 1,
  "page_size": 50,
  "date_window": 1,
  "keyword": ""
}
```

## 响应数据结构

### 热门内容词对象
```typescript
interface HotWordInfo {
  title: string              // 内容词/关键词
  score: number              // 热度值
  rising_ratio: number       // 上升比例
  rising_speed: string       // 上升速度
  id: string                 // 唯一标识
  query_day: string          // 查询日期
  is_favorite: boolean       // 是否收藏
  favorite_id: number        // 收藏ID
  trends: HotWordTrend[]     // 趋势数据
}

interface HotWordTrend {
  date: string               // 日期（格式：YYYYMMDD）
  value: number              // 该日期的热度值
}
```

### 示例响应
```json
{
  "code": 0,
  "data": {
    "word_list": [
      {
        "title": "楚秉杰",
        "is_favorite": false,
        "favorite_id": 0,
        "score": 12409547,
        "rising_ratio": 0,
        "rising_speed": "",
        "id": "tk0di5oBZnPpx23qm8YH",
        "query_day": "20251115",
        "trends": [
          {
            "date": "20251012",
            "value": 109252.52686296726
          },
          {
            "date": "20251115",
            "value": 3292128.910899843
          }
        ]
      }
    ],
    "total_count": 10000
  },
  "extra": {
    "now": 1763349790000
  },
  "message": ""
}
```

## 前置条件

### 1. 环境变量配置

确保 `.env.local` 文件中配置了以下变量:

```env
# TikHub API 配置
TIKHUB_API_BASE_URL=https://api.tikhub.dev  # 中国大陆
# TIKHUB_API_BASE_URL=https://api.tikhub.io  # 其他地区
TIKHUB_API_KEY=your_tikhub_api_key_here
```

### 2. 获取 API Key

1. 访问 [TikHub 用户中心](https://user.tikhub.io)
2. 注册并登录账户
3. 在用户中心创建 API Token
4. 复制 API Key 并配置到 `.env.local` 文件

### 3. 确认依赖安装

```bash
pnpm install
```

## 命令行参数详解

| 参数 | 说明 | 类型 | 默认值 | 示例 |
|------|------|------|--------|------|
| `--keyword` | 搜索关键字 | string | 无（全部） | `--keyword=美食` |
| `--window` | 时间窗口（1=按小时，24=按天） | number | 24 | `--window=1` |
| `--size` | 每页数量 | number | 10 | `--size=50` |

### 参数组合示例

```bash
# 搜索"美食"关键词，按小时窗口，每页20条
npx tsx scripts/test-hot-word-list.ts --keyword=美食 --window=1 --size=20

# 搜索"科技"关键词，按天窗口，每页30条
npx tsx scripts/test-hot-word-list.ts --keyword=科技 --window=24 --size=30

# 获取全部热门词，按天窗口，每页50条
npx tsx scripts/test-hot-word-list.ts --window=24 --size=50
```

## 输出文件

测试工具会自动生成JSON文件:

### 全部热门内容词
`hot-word-list-output.json`:
```json
{
  "queryParams": {
    "dateWindow": 24,
    "pageSize": 10,
    "keyword": "无"
  },
  "total": 10000,
  "count": 10,
  "hasMore": true,
  "data": {
    "code": 0,
    "data": {
      "word_list": [...],
      "total_count": 10000
    }
  }
}
```

### 关键词搜索结果
`hot-word-list-{关键词}-output.json`:
```json
{
  "queryParams": {
    "dateWindow": 24,
    "pageSize": 5,
    "keyword": "金鸡"
  },
  "total": 1805,
  "count": 5,
  "hasMore": true,
  "data": {...}
}
```

## 应用场景

### 1. 内容创作优化
- 发现当前热门话题和关键词
- 优化视频标题和描述
- 选择合适的话题标签
- 把握内容创作时机

**使用示例**:
```bash
# 每日获取TOP 30热门词，指导内容创作
npx tsx scripts/test-hot-word-list.ts --size=30

# 监控特定领域热词（如美食）
npx tsx scripts/test-hot-word-list.ts --keyword=美食 --size=20
```

### 2. 趋势分析和预测
- 跟踪关键词热度变化
- 分析趋势数据（trends字段）
- 发现新兴话题
- 预测内容趋势走向

**使用示例**:
```bash
# 按小时窗口监控实时热词变化
npx tsx scripts/test-hot-word-list.ts --window=1 --size=50

# 导出数据进行趋势分析
# 数据中的trends字段包含历史热度值
```

### 3. 营销策略制定
- 基于热词制定推广计划
- 选择合适的投放关键词
- 监控竞品相关热词
- 优化广告文案

**使用示例**:
```bash
# 搜索品牌相关热词
npx tsx scripts/test-hot-word-list.ts --keyword=品牌名 --size=20

# 搜索行业相关热词
npx tsx scripts/test-hot-word-list.ts --keyword=行业关键词 --size=30
```

### 4. 舆情监控
- 监控品牌相关话题
- 跟踪负面关键词
- 及时发现舆情风险
- 分析用户关注点

**使用示例**:
```bash
# 监控品牌关键词
npx tsx scripts/test-hot-word-list.ts --keyword=品牌名

# 监控行业热点
npx tsx scripts/test-hot-word-list.ts --keyword=行业术语 --size=50
```

### 5. 竞品分析
- 监控竞品相关热词
- 分析竞品话题热度
- 发现市场机会
- 优化竞争策略

**使用示例**:
```bash
# 监控多个竞品（多次运行）
npx tsx scripts/test-hot-word-list.ts --keyword=竞品A
npx tsx scripts/test-hot-word-list.ts --keyword=竞品B
npx tsx scripts/test-hot-word-list.ts --keyword=竞品C
```

### 6. 数据分析和研究
- 导出JSON数据进行深度分析
- 构建热词数据库
- 研究用户兴趣变化
- 生成分析报告

**使用示例**:
```bash
# 导出大量数据进行分析
npx tsx scripts/test-hot-word-list.ts --size=100

# 定期采集数据（配合Cron任务）
# 每小时采集一次实时热词
npx tsx scripts/test-hot-word-list.ts --window=1 --size=50
```

## 数据字段详解

### 热度值（score）
- **定义**: 综合指标，反映关键词的热度
- **计算**: 基于搜索量、使用频率、互动量等多维度数据
- **范围**: 通常在几万到几千万之间
- **格式化**: 自动显示为万/亿单位

### 上升比例（rising_ratio）
- **定义**: 相对于前一时段的增长率
- **范围**: 0 - 1（0表示无增长，1表示100%增长）
- **应用**: 发现快速上升的新兴话题

### 上升速度（rising_speed）
- **定义**: 文本描述的上升速度
- **可能值**: "快速上升"、"稳定上升"、空字符串等
- **应用**: 快速判断话题热度趋势

### 趋势数据（trends）
- **定义**: 历史热度值数组
- **结构**: `[{ date: "20251115", value: 3292128 }, ...]`
- **应用**:
  - 绘制热度曲线图
  - 分析热度波动
  - 预测未来趋势

### 查询日期（query_day）
- **格式**: YYYYMMDD（如 "20251115"）
- **应用**: 确定数据的时效性

## API 费用

根据 TikHub API 定价:
- **每次请求**: $0.001 USD
- **计费条件**: 仅在返回状态码 200 时计费
- **数据缓存**: 不缓存，实时获取最新数据
- **免费额度**: 根据账户套餐，可能有每日免费请求额度

### 费用优化建议
1. 使用合适的 `page_size` 避免多次请求
2. 利用关键词搜索精准获取所需数据
3. 缓存导出的JSON数据进行离线分析
4. 合理设置定时任务频率

## 故障排查

### 1. 连接失败

**错误**: `TikHub API连接失败`

**解决方法**:
- 检查 `TIKHUB_API_KEY` 是否正确配置
- 确认 API Key 是否有效（访问 https://user.tikhub.io 检查）
- 检查网络连接是否正常
- 确认 `TIKHUB_API_BASE_URL` 是否正确
  - 中国大陆: `https://api.tikhub.dev`
  - 其他地区: `https://api.tikhub.io`

### 2. 401 认证错误

**错误**: `错误码: 401`

**解决方法**:
- API Key 无效或已过期
- 重新生成 API Key 并更新 `.env.local`
- 检查 Authorization 头格式是否正确

### 3. 响应数据格式错误

**错误**: `响应数据格式错误`

**解决方法**:
- 检查 API 端点是否正确
- 查看完整响应内容（会在错误时输出）
- 更新类型定义以匹配实际 API 响应
- 联系 TikHub 技术支持

### 4. 搜索无结果

**问题**: `未找到匹配的内容词`

**可能原因**:
- 关键词拼写错误
- 关键词过于具体或生僻
- 该关键词当前不是热门话题

**解决方法**:
- 检查关键词拼写
- 使用更通用的关键词
- 尝试相关的同义词
- 不使用 `--keyword` 参数查看全部热词

### 5. 热度值显示异常

**问题**: 热度值过高或过低

**原因**:
- API返回的热度值可能包含小数
- 趋势数据的热度值单位可能不同

**解决**:
- 查看完整JSON输出文件确认原始数据
- 热度值是相对指标，主要用于排序和比较

### 6. 时间窗口参数无效

**问题**: 修改 `--window` 参数但数据无变化

**解决**:
- 确认参数值正确（1=按小时，24=按天）
- 某些热词可能在不同时间窗口下数据相似
- 尝试不同的关键词或增加数据量进行对比

## 技术实现

### 核心功能

1. **POST请求支持** - 使用POST方法发送请求体
2. **关键词搜索** - 支持模糊匹配搜索
3. **数字格式化** - 热度值使用万/亿单位显示
4. **趋势数据展示** - 显示最新趋势数据点
5. **命令行参数** - 灵活的参数配置
6. **数据导出** - 自动保存JSON格式数据

### 设计特点

- ✅ 类型安全 - 完整的 TypeScript 类型定义
- ✅ 错误处理 - 完善的错误捕获和提示
- ✅ 数据格式化 - 美观的数字显示
- ✅ 数据导出 - 自动保存 JSON 格式数据
- ✅ 命令行友好 - 支持多种参数配置
- ✅ 趋势数据 - 支持历史热度数据展示

### 代码结构

```typescript
// 格式化热度值
function formatHotValue(value: number): string {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)}亿`
  } else if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`
  }
  return value.toString()
}

// 测试获取全部热门内容词
async function testGetAllHotWords(options: {
  dateWindow?: number
  pageSize?: number
})

// 测试搜索特定关键词的热门内容词
async function testSearchHotWords(options: {
  keyword: string
  dateWindow?: number
  pageSize?: number
})
```

## 相关文件

- **测试脚本**: `scripts/test-hot-word-list.ts`
- **类型定义**: `lib/tikhub/types.ts` (HotWordInfo, GetHotWordListParams, DouyinHotWordListResponse)
- **客户端方法**: `lib/tikhub/client.ts` (getHotWordList)
- **快速开始**: `scripts/QUICKSTART-hot-word-list.md`

## 在代码中使用

### 基础用法

```typescript
import { getTikHubClient } from '@/lib/tikhub'

async function getHotWordsExample() {
  const client = getTikHubClient()

  // 获取全部热门内容词
  const allWords = await client.getHotWordList({
    page_num: 1,
    page_size: 20,
    date_window: 24
  })

  console.log(`获取到 ${allWords.data.word_list.length} 个热门内容词`)
  console.log(`总数: ${allWords.data.total_count}`)

  // 处理热门词数据
  allWords.data.word_list.forEach(word => {
    console.log(`${word.title} - 热度: ${word.score}`)

    // 分析趋势数据
    if (word.trends && word.trends.length > 0) {
      const latest = word.trends[word.trends.length - 1]
      console.log(`  最新趋势: ${latest.date} - ${latest.value}`)
    }
  })
}
```

### 关键词搜索

```typescript
async function searchHotWordsExample() {
  const client = getTikHubClient()

  // 搜索包含"美食"的热门内容词
  const foodWords = await client.getHotWordList({
    page_num: 1,
    page_size: 10,
    date_window: 24,
    keyword: '美食'
  })

  console.log(`找到 ${foodWords.data.word_list.length} 个相关热门词`)

  foodWords.data.word_list.forEach(word => {
    console.log(`${word.title}`)
    console.log(`  热度值: ${word.score}`)
    if (word.rising_ratio > 0) {
      console.log(`  上升比例: ${(word.rising_ratio * 100).toFixed(2)}%`)
    }
  })
}
```

### 趋势分析

```typescript
async function analyzeTrendsExample() {
  const client = getTikHubClient()

  const response = await client.getHotWordList({
    page_num: 1,
    page_size: 50,
    date_window: 1  // 按小时
  })

  // 分析每个热词的趋势
  response.data.word_list.forEach(word => {
    if (word.trends && word.trends.length >= 2) {
      const trends = word.trends
      const firstValue = trends[0].value
      const lastValue = trends[trends.length - 1].value
      const growth = ((lastValue - firstValue) / firstValue * 100).toFixed(2)

      console.log(`${word.title}:`)
      console.log(`  起始热度: ${firstValue}`)
      console.log(`  当前热度: ${lastValue}`)
      console.log(`  增长率: ${growth}%`)
    }
  })
}
```

### 定时监控

```typescript
async function monitorHotWords() {
  const client = getTikHubClient()

  // 每小时监控一次
  setInterval(async () => {
    const response = await client.getHotWordList({
      page_num: 1,
      page_size: 10,
      date_window: 1
    })

    console.log(`[${new Date().toISOString()}] TOP 10 热门词:`)
    response.data.word_list.forEach((word, index) => {
      console.log(`${index + 1}. ${word.title} - ${word.score}`)
    })

    // 保存数据到数据库或文件
    // await saveToDatabase(response.data.word_list)
  }, 3600000) // 每小时
}
```

### 数据聚合分析

```typescript
async function aggregateAnalysis() {
  const client = getTikHubClient()
  const keywords = ['美食', '科技', '娱乐', '体育', '时尚']

  const results = await Promise.all(
    keywords.map(keyword =>
      client.getHotWordList({
        page_num: 1,
        page_size: 20,
        keyword
      })
    )
  )

  // 分析各类别热词数量和平均热度
  results.forEach((result, index) => {
    const keyword = keywords[index]
    const words = result.data.word_list
    const avgScore = words.reduce((sum, w) => sum + w.score, 0) / words.length

    console.log(`${keyword} 类别:`)
    console.log(`  热词数量: ${result.data.total_count}`)
    console.log(`  平均热度: ${avgScore.toFixed(2)}`)
    console.log(`  TOP词: ${words[0]?.title} (${words[0]?.score})`)
  })
}
```

## 数据应用案例

### 案例1: 内容创作助手

构建一个工具，每日推荐热门话题供创作者参考：

```typescript
async function dailyContentSuggestion() {
  const client = getTikHubClient()

  const response = await client.getHotWordList({
    page_num: 1,
    page_size: 30,
    date_window: 24
  })

  // 筛选快速上升的话题
  const risingWords = response.data.word_list.filter(
    word => word.rising_ratio > 0.5 // 上升50%以上
  )

  console.log('今日推荐创作话题:')
  risingWords.forEach((word, index) => {
    console.log(`${index + 1}. ${word.title}`)
    console.log(`   当前热度: ${word.score}`)
    console.log(`   上升速度: ${word.rising_speed}`)
    console.log(`   建议: 结合此话题创作相关内容`)
    console.log()
  })
}
```

### 案例2: 热词预警系统

监控特定关键词，当热度超过阈值时发送预警：

```typescript
async function hotWordAlert(targetKeywords: string[], threshold: number) {
  const client = getTikHubClient()

  for (const keyword of targetKeywords) {
    const response = await client.getHotWordList({
      keyword,
      page_num: 1,
      page_size: 10
    })

    const hotWords = response.data.word_list.filter(
      word => word.score > threshold
    )

    if (hotWords.length > 0) {
      console.log(`⚠️  预警: "${keyword}" 相关热词超过阈值`)
      hotWords.forEach(word => {
        console.log(`  - ${word.title}: ${word.score}`)
      })
      // 发送通知（邮件、短信、Webhook等）
      // await sendNotification(...)
    }
  }
}

// 使用示例
hotWordAlert(['品牌名', '产品名'], 1000000)
```

### 案例3: 竞品分析仪表板

定期采集竞品相关热词数据，生成分析报告：

```typescript
async function competitorAnalysis(competitors: string[]) {
  const client = getTikHubClient()
  const results = []

  for (const competitor of competitors) {
    const response = await client.getHotWordList({
      keyword: competitor,
      page_num: 1,
      page_size: 50
    })

    const analysis = {
      competitor,
      totalHotWords: response.data.total_count,
      avgScore: response.data.word_list.reduce((sum, w) => sum + w.score, 0) / response.data.word_list.length,
      topWords: response.data.word_list.slice(0, 5).map(w => ({
        title: w.title,
        score: w.score,
        rising_ratio: w.rising_ratio
      }))
    }

    results.push(analysis)
  }

  // 生成对比报告
  console.log('=== 竞品热词分析报告 ===\n')
  results.forEach(result => {
    console.log(`${result.competitor}:`)
    console.log(`  相关热词总数: ${result.totalHotWords}`)
    console.log(`  平均热度: ${result.avgScore.toFixed(2)}`)
    console.log(`  TOP 5 热词:`)
    result.topWords.forEach((word, index) => {
      console.log(`    ${index + 1}. ${word.title} - ${word.score}`)
    })
    console.log()
  })
}

// 使用示例
competitorAnalysis(['竞品A', '竞品B', '竞品C'])
```

## 最佳实践

### 1. 数据采集频率
- **实时监控**: 每小时采集一次（`--window=1`）
- **日常分析**: 每天采集一次（`--window=24`）
- **定期报告**: 每周采集一次，对比变化

### 2. 数据存储建议
- 保存JSON格式的原始数据
- 提取关键字段存入数据库
- 建立时间序列数据库用于趋势分析
- 定期清理过期数据

### 3. 关键词选择技巧
- 使用行业核心词获取相关话题
- 品牌名监控需要包含完整品牌名和简称
- 结合产品名、服务名、热门标签
- 避免过于通用的词（如"好"、"美"等）

### 4. 性能优化
- 合理设置 `page_size` 减少请求次数
- 利用关键词搜索精准获取
- 缓存非实时数据减少API调用
- 使用批量处理避免频繁请求

## 与其他榜单的区别

| 特性 | 热门内容词 | 视频热榜 | 低粉爆款榜 | 热门账号榜 |
|------|----------|---------|----------|-----------|
| 数据类型 | 关键词/话题 | 视频内容 | 视频内容 | 账号 |
| 主要用途 | 话题发现 | 内容分析 | 新人案例 | 账号研究 |
| 时效性 | 实时 | 实时 | 实时 | 实时 |
| 搜索功能 | ✅ 支持 | ❌ 不支持 | ❌ 不支持 | ❌ 不支持 |
| 趋势数据 | ✅ 有 | ❌ 无 | ❌ 无 | ✅ 有 |
| 适用场景 | 内容规划 | 爆款研究 | 突破策略 | 对标分析 |

## 许可证

本项目遵循项目主仓库的许可证。
