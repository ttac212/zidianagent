# TikHub 抖音综合搜索 API 文档

## 概述

TikHub 综合搜索 V4 API 用于获取抖音平台指定关键词的综合搜索结果，支持视频、图集等多种内容类型的搜索。

- **API 端点**: `POST /api/v1/douyin/search/fetch_general_search_v4`
- **基础URL**: `https://api.tikhub.io`
- **定价**: $0.001/请求（仅状态码200时收费）
- **文档**: https://api.tikhub.io/#/Douyin-Search-API

## 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `keyword` | string | 是 | - | 搜索关键词 |
| `offset` | integer | 否 | 0 | 翻页偏移量 |
| `sort_type` | string | 否 | "0" | 排序方式 |
| `publish_time` | string | 否 | "0" | 发布时间筛选 |
| `filter_duration` | string | 否 | "0" | 视频时长筛选 |
| `content_type` | string | 否 | "0" | 内容类型筛选 |
| `search_id` | string | 否 | "" | 搜索ID（翻页时使用） |

### 参数取值说明

#### sort_type（排序方式）
| 值 | 说明 |
|----|------|
| "0" | 综合排序 |
| "1" | 最多点赞 |
| "2" | 最新发布 |

#### publish_time（发布时间）
| 值 | 说明 |
|----|------|
| "0" | 不限 |
| "1" | 最近一天 |
| "7" | 最近一周 |
| "180" | 最近半年 |

#### filter_duration（视频时长）
| 值 | 说明 |
|----|------|
| "0" | 不限 |
| "0-1" | 1分钟以内 |
| "1-5" | 1-5分钟 |
| "5-10000" | 5分钟以上 |

#### content_type（内容类型）
| 值 | 说明 |
|----|------|
| "0" | 不限 |
| "1" | 视频 |
| "2" | 图集 |

## 请求示例

### cURL

```bash
curl -X POST "https://api.tikhub.io/api/v1/douyin/search/fetch_general_search_v4" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "南宁全屋定制",
    "offset": 0,
    "sort_type": "0",
    "publish_time": "0",
    "filter_duration": "0",
    "content_type": "0",
    "search_id": ""
  }'
```

### TypeScript（使用项目客户端）

```typescript
import { TikHubClient } from '@/lib/tikhub/client'

const client = new TikHubClient()

// 基础搜索
const result = await client.generalSearchV4({
  keyword: '南宁全屋定制',
})

// 带筛选条件的搜索
const filteredResult = await client.generalSearchV4({
  keyword: '南宁全屋定制',
  sort_type: '1',      // 按点赞数排序
  publish_time: '7',   // 最近一周
  content_type: '1',   // 仅视频
})

// 遍历结果
for (const item of result.data) {
  if (item.aweme_info) {
    const video = item.aweme_info
    console.log({
      id: video.aweme_id,
      desc: video.desc,
      author: video.author?.nickname,
      likes: video.statistics?.digg_count,
      comments: video.statistics?.comment_count,
    })
  }
}
```

### 自动分页获取多页结果

```typescript
// 获取最多3页结果
for await (const page of client.getAllGeneralSearchV4Results('南宁全屋定制', {
  maxPages: 3,
  sort_type: '1',
  onProgress: (current, total) => {
    console.log(`进度: ${current}/${total}`)
  },
})) {
  console.log(`获取到 ${page.data.length} 条结果`)
}
```

## 响应数据结构

### 完整响应示例

```json
{
  "code": 200,
  "message": "Request successful. This request will incur a charge.",
  "message_zh": "请求成功，本次请求将被计费。",
  "data": {
    "data": [
      {
        "aweme_info": {
          "aweme_id": "7516804654953778459",
          "desc": "明码标价！南宁全屋定制衣柜、厨柜实力厂家...",
          "create_time": 1695123456,
          "author": {
            "uid": "123456789",
            "sec_uid": "MS4wLjABAAAA...",
            "nickname": "广西南宁全屋定制工厂",
            "unique_id": "nanning_dingzhi",
            "avatar_thumb": {
              "url_list": ["https://..."]
            }
          },
          "video": {
            "play_addr": {
              "url_list": ["https://..."]
            },
            "cover": {
              "url_list": ["https://..."]
            },
            "duration": 15000
          },
          "statistics": {
            "digg_count": 5289,
            "comment_count": 182,
            "share_count": 151,
            "play_count": 0,
            "collect_count": 0
          },
          "share_url": "https://www.douyin.com/video/..."
        }
      }
    ],
    "has_more": 1,
    "cursor": 20,
    "extra": {
      "logid": "20251124104739A16009A05C3E02F8FBE5",
      "now": 1732420911000
    },
    "log_pb": {
      "impr_id": "20251124104739A16009A05C3E02F8FBE5"
    }
  }
}
```

### 字段说明

#### 顶层响应字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | number | HTTP状态码，200表示成功 |
| `message` | string | 响应消息（英文） |
| `message_zh` | string | 响应消息（中文） |
| `data` | object | 搜索结果数据 |

#### data 对象字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `data` | array | 搜索结果列表 |
| `has_more` | number | 是否有更多结果：1-有，0-无 |
| `cursor` | number | 游标位置 |
| `extra.logid` | string | 日志ID，翻页时作为 search_id 使用 |

#### aweme_info 视频信息字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `aweme_id` | string | 视频唯一ID |
| `desc` | string | 视频描述/标题 |
| `create_time` | number | 创建时间戳（秒） |
| `author` | object | 作者信息 |
| `author.uid` | string | 用户ID |
| `author.sec_uid` | string | 用户安全ID |
| `author.nickname` | string | 用户昵称 |
| `author.unique_id` | string | 抖音号 |
| `video` | object | 视频信息 |
| `video.play_addr.url_list` | array | 播放地址列表 |
| `video.cover.url_list` | array | 封面图列表 |
| `video.duration` | number | 视频时长（毫秒） |
| `statistics` | object | 统计数据 |
| `statistics.digg_count` | number | 点赞数 |
| `statistics.comment_count` | number | 评论数 |
| `statistics.share_count` | number | 分享数 |
| `statistics.play_count` | number | 播放数 |
| `statistics.collect_count` | number | 收藏数 |
| `share_url` | string | 分享链接 |

## 翻页说明

1. **首次请求**: `offset=0`, `search_id=""`
2. **获取翻页参数**: 从响应中获取 `extra.logid` 或 `log_pb.impr_id`
3. **翻页请求**: `offset=20`（或当前offset+每页数量）, `search_id=上次的logid`

```typescript
// 翻页示例
const page1 = await client.generalSearchV4({ keyword: '南宁全屋定制' })
const searchId = page1.extra?.logid || ''

const page2 = await client.generalSearchV4({
  keyword: '南宁全屋定制',
  offset: 20,
  search_id: searchId,
})
```

## 命令行测试工具

项目提供了命令行测试脚本：

```bash
# 基本用法
npx tsx scripts/test-general-search.ts [keyword] [pages] [sort]

# 示例：搜索"南宁全屋定制"，1页，综合排序
npx tsx scripts/test-general-search.ts 南宁全屋定制 1 0

# 示例：搜索"全屋定制"，按点赞排序
npx tsx scripts/test-general-search.ts 全屋定制 1 1

# 示例：搜索"装修"，按最新发布排序
npx tsx scripts/test-general-search.ts 装修 1 2
```

### 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| keyword | 搜索关键词 | 全屋定制 |
| pages | 最大页数 | 1 |
| sort | 排序方式：0-综合 1-点赞 2-最新 | 0 |

### 输出示例

```
============================================================
TikHub 综合搜索V4 测试
关键词: 南宁全屋定制
最大页数: 1
排序方式: 综合排序
============================================================

正在测试API连接...
API连接成功!

正在搜索 "南宁全屋定制"...

--- 第 1 页 ---
结果数量: 19
是否有更多: 是

============================================================
搜索完成!
============================================================
总结果数: 19
视频数量: 19

视频列表:
------------------------------------------------------------
1. 明码标价！南宁全屋定制衣柜、厨柜实力厂家...
   作者: 广西南宁全屋定制工厂
   互动: 点赞 5289 | 评论 182 | 分享 151
   ID: 7516804654953778459
...

完整数据已保存到: scripts/output/search-南宁全屋定制-xxx.json
```

## 注意事项

1. **请求频率限制**
   - 每秒最大10个并发请求
   - 每分钟300次请求限制
   - 建议请求间隔500ms以上

2. **API稳定性**
   - 此接口有概率失败，如果失败请使用相同参数重试1-3次
   - 翻页请求可能会出现400错误，建议做好错误处理

3. **计费说明**
   - 仅HTTP状态码200时收费
   - 每次请求$0.001
   - 缓存结果24小时内免费访问

4. **数据完整性**
   - `play_count` 字段部分视频可能返回0
   - 建议结合 `digg_count`、`comment_count`、`share_count` 综合判断视频热度

## TypeScript 类型定义

```typescript
// 请求参数类型
interface GeneralSearchV4Params {
  keyword: string
  offset?: number
  sort_type?: '0' | '1' | '2'
  publish_time?: '0' | '1' | '7' | '180'
  filter_duration?: '0' | '0-1' | '1-5' | '5-10000'
  content_type?: '0' | '1' | '2'
  search_id?: string
}

// 响应类型
interface DouyinGeneralSearchV4Response {
  data: GeneralSearchV4ResultItem[]
  has_more: number
  cursor: number
  extra: {
    logid: string
    now: number
  }
  log_pb?: {
    impr_id: string
  }
}

// 单条搜索结果
interface GeneralSearchV4ResultItem {
  aweme_info?: {
    aweme_id: string
    desc: string
    create_time?: number
    author: {
      uid: string
      nickname: string
      sec_uid?: string
    }
    video: {
      play_addr?: { url_list: string[] }
      cover?: { url_list: string[] }
      duration: number
    }
    statistics: {
      digg_count: number
      comment_count: number
      share_count: number
      play_count?: number
    }
  }
}
```

## 相关文件

- 客户端实现: `lib/tikhub/client.ts`
- 类型定义: `lib/tikhub/types.ts`
- 配置文件: `lib/tikhub/config.ts`
- 测试脚本: `scripts/test-general-search.ts`
- 输出目录: `scripts/output/`

## 更新日志

- **2025-11-24**: 初始版本，支持综合搜索V4 API
