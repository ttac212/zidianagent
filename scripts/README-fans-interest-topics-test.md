# TikHub API 粉丝感兴趣话题测试工具

## 功能说明

这个测试工具用于测试 TikHub API 的粉丝感兴趣话题接口，获取指定账号粉丝在近3天内感兴趣的话题列表（最多10个话题）。

### API 信息
- **端点**: `/api/v1/douyin/billboard/fetch_hot_account_fans_interest_topic_list`
- **方法**: GET
- **认证**: Bearer Token (使用 `TIKHUB_API_KEY`)
- **参数**:
  - `sec_uid`: 用户的sec_uid（必需）
- **返回**: 粉丝近3天感兴趣的话题列表（最多10个）

## 使用方法

### 1. 基本使用 - 使用默认测试账号

```bash
npx tsx scripts/test-fans-interest-topics.ts
```

默认使用"人民日报"账号进行测试。

### 2. 使用自定义账号

```bash
# 使用命令行参数指定账号
npx tsx scripts/test-fans-interest-topics.ts --sec-uid=MS4wLjABAAAA8U_l6rBzmy7bcy6xOJel4v0RzoR_wfAubGPeJimN__4

# 使用其他测试账号
npx tsx scripts/test-fans-interest-topics.ts --sec-uid=MS4wLjABAAAAgq8cb7cn9ByhZbmx-XQDdRTvFzmJeBBXOUO4QflP96M
```

## 预设测试账号

脚本中预设了以下测试账号：

| 账号名称 | sec_uid | 类型 |
|---------|---------|------|
| 人民日报 | MS4wLjABAAAA8U_l6rBzmy7bcy6xOJel4v0RzoR_wfAubGPeJimN__4 | 新闻媒体 |
| 央视新闻 | MS4wLjABAAAAgq8cb7cn9ByhZbmx-XQDdRTvFzmJeBBXOUO4QflP96M | 新闻媒体 |
| 新华社 | MS4wLjABAAAAxA44mxJVod_Aq5wc0cZrbZHJ2S_DnoJctGpb_mOvsxs | 新闻媒体 |

## 响应数据结构

### 话题对象
```typescript
interface FansInterestTopic {
  topic_id?: string      // 话题ID
  topic_name: string     // 话题名称
  interest_score?: number // 兴趣度分数
  rank?: number          // 排名
  [key: string]: any     // 其他字段
}
```

### 示例响应（有数据）
```json
{
  "code": 0,
  "data": [
    {
      "topic_id": "62804",
      "topic_name": "美食教程",
      "interest_score": 95.5,
      "rank": 1
    },
    {
      "topic_id": "62803",
      "topic_name": "美食测评",
      "interest_score": 89.2,
      "rank": 2
    }
  ],
  "extra": {
    "now": 1763346730000
  },
  "message": ""
}
```

### 示例响应（无数据）
```json
{
  "code": 0,
  "data": [],
  "extra": {
    "now": 1763346730000
  },
  "message": ""
}
```

## 前置条件

### 1. 环境变量配置

确保 `.env.local` 文件中配置了以下变量:

```env
# TikHub API 配置
TIKHUB_API_BASE_URL=https://api.tikhub.io
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

## 输出示例

### 成功输出（有数据）

```
╔══════════════════════════════════════════════════╗
║     TikHub API - 粉丝感兴趣话题测试工具          ║
╚══════════════════════════════════════════════════╝

使用默认测试账号: 人民日报
提示: 可使用 --sec-uid=<sec_uid> 参数指定其他账号

=== 测试获取粉丝感兴趣的话题 ===

查询参数:
  用户sec_uid: MS4wLjABAAAA8U_l6rBzmy7bcy6xOJel4v0RzoR_wfAubGPeJimN__4
  账号名称: 人民日报

正在获取粉丝感兴趣的话题...

✅ 成功获取粉丝感兴趣的话题
话题数量: 10

=== 粉丝感兴趣的话题列表 ===

1. 美食教程
   话题ID: 62804
   兴趣度分数: 95.5
   排名: 1

2. 美食测评
   话题ID: 62803
   兴趣度分数: 89.2
   排名: 2

📄 完整数据已保存到: ./fans-interest-topics-output.json
```

### 成功输出（无数据）

```
✅ 成功获取粉丝感兴趣的话题
话题数量: 0

未获取到话题数据

原始响应: {
  "code": 0,
  "data": [],
  "extra": {
    "now": 1763346730000
  },
  "message": ""
}
📄 完整数据已保存到: ./fans-interest-topics-output.json
```

## 输出文件

测试工具会自动生成 `fans-interest-topics-output.json` 文件:

```json
{
  "secUid": "MS4wLjABAAAA8U_l6rBzmy7bcy6xOJel4v0RzoR_wfAubGPeJimN__4",
  "accountName": "人民日报",
  "count": 0,
  "data": {
    "code": 0,
    "data": [],
    "extra": {
      "now": 1763346730000
    },
    "message": ""
  }
}
```

## 数据可用性说明

### ⚠️ 重要提示

根据测试结果，此接口可能在以下情况返回空数据：

1. **时间范围限制**: 仅返回近3天的数据，如果该时间段内没有明显的粉丝兴趣话题，则返回空数组
2. **账号类型**: 某些账号类型（如新闻媒体账号）可能不产生粉丝兴趣话题数据
3. **粉丝活跃度**: 需要粉丝有足够的互动行为才能产生兴趣话题数据
4. **数据权限**: 可能需要特定的账号权限或数据授权

### 建议策略

- **多账号测试**: 尝试不同类型和规模的账号
- **内容创作者优先**: 美食、旅行、生活方式等垂类的内容创作者更可能有数据
- **定期监控**: 定期查询以观察数据变化趋势
- **结合其他接口**: 与热门账号、内容标签等接口结合使用，获取更全面的洞察

## 应用场景

### 1. 粉丝画像分析
- 了解粉丝群体的兴趣偏好
- 发现粉丝关注的热门话题
- 分析粉丝兴趣变化趋势

### 2. 内容策略优化
- 基于粉丝兴趣调整内容方向
- 提高内容与粉丝兴趣的匹配度
- 增加粉丝互动和粘性

### 3. 竞品分析
- 对比不同账号粉丝的兴趣差异
- 研究竞品粉丝画像
- 优化目标受众定位

### 4. 营销策略制定
- 根据粉丝兴趣话题制定营销活动
- 选择合适的话题标签
- 提高内容传播效果

## API 费用

根据 TikHub API 定价:
- 每次请求: $0.001 USD
- 仅在返回状态码 200 时计费
- 数据更新频率: 实时

## 故障排查

### 1. 连接失败

**错误**: `TikHub API连接失败`

**解决方法**:
- 检查 `TIKHUB_API_KEY` 是否正确配置
- 确认 API Key 是否有效
- 检查网络连接

### 2. 401 认证错误

**错误**: `错误码: 401`

**解决方法**:
- API Key 无效或已过期
- 重新生成 API Key 并更新 `.env.local`

### 3. 缺少必需参数

**错误**: `sec_uid is required to fetch fans interest topic list`

**解决方法**:
- 使用 `--sec-uid` 参数指定账号
- 确保 sec_uid 格式正确（以 MS4wLjABAAAA 开头）

### 4. 返回空数据

**情况**: API 调用成功但 data 为空数组

**可能原因**:
- 该账号近3天内没有粉丝兴趣话题数据
- 账号类型不适合此接口
- 粉丝活跃度不足

**解决方法**:
- 尝试其他账号（特别是内容创作者账号）
- 稍后重试
- 结合其他数据分析接口使用

## 技术实现

### 核心功能

1. **GET 请求** - 使用 GET 方法获取数据
2. **参数验证** - 确保 sec_uid 参数存在
3. **错误处理** - 完善的错误捕获和提示
4. **数据导出** - 自动保存 JSON 格式数据

### 设计特点

- ✅ 类型安全 - 完整的 TypeScript 类型定义
- ✅ 错误处理 - 完善的错误捕获和提示
- ✅ 灵活配置 - 支持命令行参数
- ✅ 数据导出 - 自动保存 JSON 格式数据
- ✅ 预设账号 - 提供常用测试账号

## 相关文件

- **测试脚本**: `scripts/test-fans-interest-topics.ts`
- **类型定义**: `lib/tikhub/types.ts` (FansInterestTopic, DouyinFansInterestTopicListResponse, GetFansInterestTopicListParams)
- **客户端方法**: `lib/tikhub/client.ts` (getFansInterestTopicList)

## 在代码中使用

```typescript
import { getTikHubClient } from '@/lib/tikhub'

async function getFansInterestExample() {
  const client = getTikHubClient()

  try {
    // 获取指定账号粉丝感兴趣的话题
    const response = await client.getFansInterestTopicList({
      sec_uid: 'MS4wLjABAAAA8U_l6rBzmy7bcy6xOJel4v0RzoR_wfAubGPeJimN__4'
    })

    if (response.data && response.data.length > 0) {
      console.log(`获取到 ${response.data.length} 个感兴趣的话题`)

      response.data.forEach((topic, index) => {
        console.log(`${index + 1}. ${topic.topic_name}`)
        if (topic.interest_score) {
          console.log(`   兴趣度: ${topic.interest_score}`)
        }
      })
    } else {
      console.log('该账号暂无粉丝兴趣话题数据')
    }
  } catch (error) {
    console.error('获取失败:', error)
  }
}
```

## 与其他接口配合使用

### 配合热门账号接口

```typescript
import { getTikHubClient } from '@/lib/tikhub'

async function analyzeHotAccountFans() {
  const client = getTikHubClient()

  // 1. 获取热门账号
  const hotAccounts = await client.getHotAccountList({
    query_tag: { value: 628 }, // 美食垂类
    page_size: 10
  })

  // 2. 分析每个热门账号的粉丝兴趣
  for (const account of hotAccounts.data.user_list) {
    console.log(`\n分析账号: ${account.nick_name}`)

    const topics = await client.getFansInterestTopicList({
      sec_uid: account.user_id
    })

    if (topics.data && topics.data.length > 0) {
      console.log(`粉丝感兴趣的话题:`)
      topics.data.forEach(topic => {
        console.log(`  - ${topic.topic_name}`)
      })
    } else {
      console.log('  暂无话题数据')
    }

    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500))
  }
}
```

## 许可证

本项目遵循项目主仓库的许可证。
