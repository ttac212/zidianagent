# TikHub API 集成文档

本文档说明如何使用TikHub API来获取抖音商家数据并同步到智点AI平台。

## 目录

- [概述](#概述)
- [环境配置](#环境配置)
- [快速开始](#快速开始)
- [API端点](#api端点)
- [使用示例](#使用示例)
- [定价和配额](#定价和配额)
- [故障排除](#故障排除)

---

## 概述

TikHub API集成允许您：

- 🔍 搜索抖音用户/商家
- 👤 获取用户详细资料
- 🎬 获取用户发布的视频列表
- 📊 同步商家数据到本地数据库
- 🔄 批量同步多个商家
- 📈 跟踪API使用情况和费用

### 技术架构

```
┌─────────────────┐
│   Next.js App   │
└────────┬────────┘
         │
         ├─ API Routes (/api/tikhub/*)
         │  ├─ /sync         - 同步单个商家
         │  ├─ /batch-sync   - 批量同步
         │  ├─ /search       - 搜索用户
         │  └─ /status       - 检查状态
         │
         ├─ lib/tikhub/
         │  ├─ client.ts      - HTTP客户端
         │  ├─ config.ts      - 配置常量
         │  ├─ types.ts       - 类型定义
         │  ├─ mapper.ts      - 数据映射
         │  └─ sync-service.ts - 同步服务
         │
         └─ TikHub API (https://api.tikhub.io)
```

---

## 环境配置

### 1. 获取TikHub API密钥

1. 访问 [TikHub用户中心](https://user.tikhub.io)
2. 注册并登录账号
3. 进入 **API Key** 菜单
4. 创建新的API Token，选择适当的权限范围和过期时间
5. 复制生成的API Key

### 2. 配置环境变量

在 `.env.local` 文件中添加以下配置：

```env
# TikHub API配置
TIKHUB_API_BASE_URL=https://api.tikhub.io
TIKHUB_API_KEY=your_api_key_here

# 可选：测试用的用户sec_uid
TEST_SEC_UID=MS4wLjABAAAA...
```

### 3. 验证配置

运行测试脚本验证配置是否正确：

```bash
npx tsx scripts/test-tikhub-api.ts
```

---

## 快速开始

### 使用TypeScript客户端

```typescript
import { getTikHubClient } from '@/lib/tikhub'

// 获取客户端实例
const client = getTikHubClient()

// 测试连接
const connected = await client.testConnection()
console.log('连接状态:', connected)

// 获取用户信息
const userInfo = await client.getUserInfo()
console.log('用户信息:', userInfo)

// 搜索用户
const searchResult = await client.searchUser({
  keyword: '门窗',
  count: 20
})
console.log('搜索结果:', searchResult.user_list)

// 获取用户资料
const profile = await client.getUserProfile({
  sec_uid: 'MS4wLjABAAAA...'
})
console.log('用户资料:', profile)

// 获取用户视频
const videos = await client.getUserVideos({
  sec_uid: 'MS4wLjABAAAA...',
  count: 20
})
console.log('视频列表:', videos.aweme_list)
```

### 使用同步服务

```typescript
import { syncMerchantData } from '@/lib/tikhub'

// 同步单个商家
const result = await syncMerchantData('MS4wLjABAAAA...', {
  categoryId: 'category_id',
  businessType: 'B2C',
  maxVideos: 100
})

if (result.success) {
  console.log('同步成功:', result)
} else {
  console.error('同步失败:', result.errors)
}
```

---

## API端点

### 1. 检查TikHub状态

**端点**: `GET /api/tikhub/status`

**权限**: 需要管理员权限

**响应示例**:

```json
{
  "code": 200,
  "message": "TikHub API连接正常",
  "data": {
    "connected": true,
    "userInfo": {
      "userId": "user_123",
      "username": "username",
      "email": "user@example.com",
      "plan": "pro",
      "balance": 100.50
    },
    "dailyUsage": {
      "date": "2025-10-09",
      "totalRequests": 150,
      "successfulRequests": 148,
      "failedRequests": 2,
      "totalCost": 0.15
    }
  }
}
```

### 2. 搜索用户

**端点**: `GET /api/tikhub/search`

**权限**: 需要管理员权限

**查询参数**:
- `keyword` (必需): 搜索关键词
- `autoSync` (可选): 是否自动同步，默认 `false`
- `categoryId` (可选): 商家分类ID
- `businessType` (可选): 业务类型 (`B2B` | `B2C` | `B2B2C`)

**示例请求**:

```bash
curl -X GET "http://localhost:3007/api/tikhub/search?keyword=门窗&autoSync=false" \
  -H "Cookie: next-auth.session-token=..."
```

**响应示例**:

```json
{
  "code": 200,
  "message": "搜索完成",
  "data": {
    "merchants": [
      {
        "uid": "123456789",
        "name": "某某门窗",
        "synced": false
      }
    ],
    "total": 1,
    "synced": 0
  }
}
```

### 3. 同步单个商家

**端点**: `POST /api/tikhub/sync`

**权限**: 需要管理员权限

**请求体**:

```json
{
  "sec_uid": "MS4wLjABAAAA...",
  "categoryId": "category_id_here",
  "businessType": "B2C",
  "maxVideos": 100
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "商家数据同步成功",
  "data": {
    "merchantId": "merchant_id",
    "totalVideos": 50,
    "newVideos": 45,
    "updatedVideos": 5
  }
}
```

### 4. 批量同步商家

**端点**: `POST /api/tikhub/batch-sync`

**权限**: 需要管理员权限

**请求体**:

```json
{
  "merchantUids": [
    "MS4wLjABAAAA...",
    "MS4wLjABAAAA..."
  ],
  "maxConcurrent": 3
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "批量同步完成",
  "data": {
    "total": 2,
    "completed": 2,
    "failed": 0,
    "totalVideos": 120,
    "tasks": [
      {
        "merchantUid": "MS4wLjABAAAA...",
        "merchantName": "商家A",
        "status": "completed",
        "totalVideos": 60,
        "result": {
          "newVideos": 55,
          "updatedVideos": 5,
          "totalCost": 0.06
        }
      }
    ]
  }
}
```

---

## 使用示例

### 示例1: 搜索并导入新商家

```typescript
import { searchAndImportMerchant } from '@/lib/tikhub'

async function importNewMerchants() {
  const result = await searchAndImportMerchant('断桥铝门窗', {
    categoryId: 'category_id',
    businessType: 'B2C',
    autoSync: true  // 自动同步搜索结果
  })

  console.log(`找到 ${result.merchants.length} 个商家`)
  console.log(`成功同步 ${result.merchants.filter(m => m.synced).length} 个`)
}
```

### 示例2: 批量同步多个商家

```typescript
import { batchSyncMerchants } from '@/lib/tikhub'

async function syncMultipleMerchants() {
  const tasks = await batchSyncMerchants({
    merchantUids: [
      'MS4wLjABAAAA...',
      'MS4wLjABAAAA...',
      'MS4wLjABAAAA...'
    ],
    maxConcurrent: 3,
    onProgress: (task) => {
      console.log(`${task.merchantName}: ${task.status}`)
    },
    onComplete: (results) => {
      const completed = results.filter(r => r.status === 'completed')
      console.log(`完成 ${completed.length}/${results.length} 个商家同步`)
    }
  })

  return tasks
}
```

### 示例3: 增量更新商家视频

```typescript
import { updateMerchantVideos } from '@/lib/tikhub'

async function updateMerchant(merchantId: string) {
  const result = await updateMerchantVideos(merchantId, {
    limit: 50  // 只获取最新的50个视频
  })

  console.log(`新增视频: ${result.newVideos}`)
  console.log(`更新视频: ${result.updatedVideos}`)
}
```

### 示例4: 使用异步生成器获取所有视频

```typescript
import { getTikHubClient } from '@/lib/tikhub'

async function getAllVideos(secUid: string) {
  const client = getTikHubClient()

  let totalVideos = 0

  for await (const batch of client.getAllUserVideos({ sec_uid: secUid })) {
    console.log(`获取到 ${batch.aweme_list.length} 个视频`)
    totalVideos += batch.aweme_list.length

    // 处理视频数据
    batch.aweme_list.forEach(video => {
      console.log(`- ${video.desc}`)
    })

    if (!batch.has_more) break
  }

  console.log(`总计: ${totalVideos} 个视频`)
}
```

---

## 定价和配额

### 基础定价

- **基础价格**: $0.001 / 每次成功请求
- **失败请求**: 不收费（仅状态码200收费）

### 分级折扣

| 每日请求数 | 折扣 | 实际价格 |
|-----------|------|---------|
| 0 - 999 | 0% | $0.001 |
| 1,000 - 4,999 | 10% | $0.0009 |
| 5,000 - 9,999 | 20% | $0.0008 |
| 10,000 - 49,999 | 30% | $0.0007 |
| 50,000 - 99,999 | 40% | $0.0006 |
| 100,000+ | 50% | $0.0005 |

### 配额管理

```typescript
import { getTikHubClient } from '@/lib/tikhub'

async function checkQuota() {
  const client = getTikHubClient()

  // 查看今日使用情况
  const usage = await client.getDailyUsage()
  console.log('今日请求数:', usage.total_requests)
  console.log('今日费用:', `$${usage.total_cost}`)

  // 估算价格
  const pricing = await client.calculatePrice(1000)
  console.log('1000次请求费用:', `$${pricing.final_price}`)
}
```

---

## 故障排除

### 问题1: API密钥无效

**错误**: `401 Unauthorized`

**解决方法**:
1. 检查 `TIKHUB_API_KEY` 环境变量是否正确配置
2. 确认API Key没有过期
3. 验证API Key的权限范围

### 问题2: 请求超时

**错误**: `Request timeout`

**解决方法**:
1. 检查网络连接
2. 增加超时时间配置：
   ```typescript
   const client = new TikHubClient({
     timeout: 120000  // 120秒
   })
   ```

### 问题3: 限流错误

**错误**: `429 Too Many Requests`

**解决方法**:
1. 检查每日配额是否用完
2. 减少并发请求数：
   ```typescript
   const tasks = await batchSyncMerchants({
     merchantUids: [...],
     maxConcurrent: 1  // 降低并发数
   })
   ```
3. 增加请求间延迟

### 问题4: 商家数据不完整

**原因**: sec_uid 与 uid 不匹配

**解决方法**:
1. 使用搜索功能获取正确的 sec_uid：
   ```typescript
   const result = await client.searchUser({ keyword: '商家名称' })
   const secUid = result.user_list[0]?.user_info.sec_uid
   ```
2. 确保使用 `sec_uid` 而不是 `uid` 调用API

### 调试模式

启用详细日志：

```typescript
// 在客户端请求中添加日志
const client = getTikHubClient()

// 捕获并记录所有错误
try {
  const result = await client.getUserProfile({ sec_uid: '...' })
} catch (error) {
  console.error('API错误详情:', error)
}
```

---

## 数据库Schema

同步的商家数据会存储在以下表中：

### Merchant (商家表)

- `uid`: 抖音用户UID（唯一）
- `name`: 商家名称
- `description`: 商家简介
- `location`: 位置信息
- `totalContentCount`: 总内容数
- `totalDiggCount`: 总点赞数
- `totalCommentCount`: 总评论数
- `totalCollectCount`: 总收藏数
- `totalShareCount`: 总分享数
- `dataSource`: 数据来源（固定为 "douyin"）
- `lastCollectedAt`: 最后采集时间

### MerchantContent (商家内容表)

- `externalId`: 视频ID（抖音aweme_id）
- `merchantId`: 关联的商家ID
- `title`: 视频标题
- `diggCount`: 点赞数
- `commentCount`: 评论数
- `collectCount`: 收藏数
- `shareCount`: 分享数
- `tags`: 标签（JSON数组）
- `publishedAt`: 发布时间
- `collectedAt`: 采集时间

---

## 最佳实践

### 1. 分批同步

避免一次性同步大量商家，建议分批进行：

```typescript
const allMerchants = [...] // 100个商家
const batchSize = 10

for (let i = 0; i < allMerchants.length; i += batchSize) {
  const batch = allMerchants.slice(i, i + batchSize)
  await batchSyncMerchants({ merchantUids: batch })

  // 批次间休息
  await new Promise(resolve => setTimeout(resolve, 60000)) // 1分钟
}
```

### 2. 错误处理

始终处理可能的错误：

```typescript
try {
  const result = await syncMerchantData(secUid, options)

  if (!result.success) {
    // 记录错误但继续执行
    console.error('同步失败:', result.errors)
  }
} catch (error) {
  // 处理致命错误
  console.error('致命错误:', error)
  throw error
}
```

### 3. 定期更新

设置定时任务定期更新商家数据：

```typescript
// 使用Node.js cron或其他调度器
import cron from 'node-cron'

// 每天凌晨2点更新所有商家
cron.schedule('0 2 * * *', async () => {
  const merchants = await prisma.merchant.findMany()

  for (const merchant of merchants) {
    await updateMerchantVideos(merchant.id)
  }
})
```

### 4. 监控使用情况

定期检查API使用和费用：

```typescript
async function monitorUsage() {
  const client = getTikHubClient()
  const usage = await client.getDailyUsage()

  if (usage.total_cost > 10) { // 费用超过$10
    console.warn('⚠️  今日API费用超过阈值')
    // 发送告警通知
  }
}
```

---

## 相关链接

- [TikHub官方文档](https://docs.tikhub.io)
- [TikHub Swagger UI](https://api.tikhub.io)
- [TikHub用户中心](https://user.tikhub.io)
- [项目CLAUDE.md](../CLAUDE.md)

---

## 更新日志

### 2025-10-09
- ✅ 初始版本发布
- ✅ 完成基础API客户端
- ✅ 实现商家数据同步功能
- ✅ 添加批量同步支持
- ✅ 创建API路由端点
- ✅ 编写测试脚本和文档
