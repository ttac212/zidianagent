# TikHub API 数据格式说明文档

基于实际API响应整理

## 📌 API基础信息

- **API Key**: `nasQXM88xWilwWy0O6/F5DftDxaSfaA9vSPz62eARtiKgAucPXmRZzaxaA==`
- **Base URL**: `https://api.tikhub.io`
- **测试用户**: 南宁润江贸易-辅材批发
- **测试时间**: 2025-10-08

## 🎯 API响应统一格式

所有成功的API响应都遵循以下格式：

```json
{
  "code": 200,
  "request_id": "唯一请求ID",
  "message": "Request successful. This request will incur a charge.",
  "message_zh": "请求成功，本次请求将被计费。",
  "time": "2025-10-08 23:18:23",
  "time_stamp": 1759990703,
  "time_zone": "America/Los_Angeles",
  "docs": "https://api.tikhub.io/#/...",
  "cache_url": "缓存URL（24小时有效）",
  "router": "请求的路由",
  "params": { /* 请求参数 */ },
  "data": { /* 实际业务数据 */ }
}
```

## 📹 获取用户视频列表

### 端点
```
GET /api/v1/douyin/app/v3/fetch_user_post_videos
```

### 请求参数
- `sec_user_id` (必需): 用户的加密ID
- `count` (可选): 每页视频数量，默认20，建议≤20
- `max_cursor` (可选): 分页游标，首次请求为0

### 响应数据结构

#### 顶层 data 字段
```json
{
  "data": {
    "has_more": 1,              // 是否有更多数据 (0或1)
    "max_cursor": 1757588087000, // 下一页游标
    "status_code": 0,            // 状态码
    "uid": "7534923995318584380", // 用户UID
    "aweme_list": [...]          // 视频列表数组
  }
}
```

#### 单个视频对象 (aweme_list 中的元素)

**基础信息**
```json
{
  "aweme_id": "7536181485112544563",  // 视频ID
  "desc": "南宁装修买辅材，为什么找萍姐？#南宁建材 #辅材 #南宁装修",  // 视频描述
  "create_time": 1730886006,  // 创建时间戳（秒）
  "region": "450100",         // 地区代码
  "city": "450100",           // 城市代码
  "is_top": 1,                // 是否置顶 (0或1)
  "share_url": "分享链接"     // 短链接
}
```

**作者信息 (author)**
```json
{
  "uid": "7534923995318584380",
  "sec_uid": "MS4wLjABAAAALwnmSxBrIRF2Dh1J6IfWvdaORR1H0nJTgmcmtp0kd-m_AS2YR_Oczrvv9Ebxoupc",
  "short_id": "89260867412",
  "unique_id": "89260867412",
  "nickname": "南宁润江贸易-辅材批发",
  "signature": "✨我是萍姐 润江贸易建材负责人...",
  "avatar_thumb": {
    "url_list": ["头像URL数组"]
  },
  "avatar_medium": {
    "url_list": ["中等尺寸头像"]
  },
  "avatar_larger": {
    "url_list": ["大尺寸头像"]
  },
  "verification_type": 1,  // 认证类型 (0=未认证, 1=企业认证)
  "enterprise_verify_reason": "南宁市润江贸易有限公司",
  "is_verified": true,
  "follower_status": 0,
  "follow_status": 0,
  "region": "CN",
  "language": "zh-Hans"
}
```

**统计数据 (statistics)** - 最重要的指标
```json
{
  "aweme_id": "7536181485112544563",
  "digg_count": 171,        // 点赞数 ❤️
  "comment_count": 44,      // 评论数 💬
  "share_count": 29,        // 分享数 📤
  "collect_count": 42,      // 收藏数 ⭐
  "play_count": 0,          // 播放数 🎬 (某些视频可能为0)
  "forward_count": 0,       // 转发数
  "download_count": 0,      // 下载数
  "whatsapp_share_count": 0 // WhatsApp分享数
}
```

**视频信息 (video)**
```json
{
  "play_addr": {
    "uri": "视频URI",
    "url_list": ["播放地址数组"],  // 通常有多个CDN地址
    "width": 720,
    "height": 720
  },
  "cover": {
    "url_list": ["封面图URL数组"]
  },
  "dynamic_cover": {
    "url_list": ["动态封面URL数组"]
  },
  "duration": 40000,  // 时长（毫秒）
  "width": 1080,      // 视频宽度
  "height": 1920,     // 视频高度
  "ratio": "540p"     // 分辨率比例
}
```

**音乐信息 (music)**
```json
{
  "id": 7536181505661062000,
  "id_str": "7536181505661061924",
  "title": "@南宁润江贸易-辅材批发创作的原声",
  "author": "南宁润江贸易-辅材批发",
  "album": "",
  "duration": 40,  // 音乐时长（秒）
  "play_url": {
    "url_list": ["音乐播放URL"]
  },
  "cover_thumb": {
    "url_list": ["音乐封面"]
  },
  "is_original_sound": true,  // 是否原创音乐
  "is_pgc": false,           // 是否PGC音乐
  "owner_id": "7534923995318584380",
  "owner_nickname": "南宁润江贸易-辅材批发"
}
```

**话题标签 (cha_list)** - 重要的分类信息
```json
[
  {
    "cid": "1631030337224717",
    "cha_name": "南宁建材",
    "desc": "",
    "type": 1,
    "view_count": 0,
    "user_count": 0,
    "is_commerce": false,
    "schema": "aweme://aweme/challenge/detail?cid=1631030337224717"
  },
  {
    "cid": "1620269730739278",
    "cha_name": "辅材"
  },
  {
    "cid": "1617439798557699",
    "cha_name": "南宁装修"
  }
]
```

**文本中的话题标签 (text_extra)** - 用于提取#标签
```json
[
  {
    "hashtag_name": "南宁建材",
    "hashtag_id": "1631030337224717",
    "start": 13,
    "end": 18,
    "type": 1,
    "sub_type": 0
  }
]
```

**分享信息 (share_info)**
```json
{
  "share_url": "https://www.iesdouyin.com/share/video/...",
  "share_title": "视频标题",
  "share_desc": "在抖音，记录美好生活",
  "share_weibo_desc": "微博分享文案"
}
```

## 🔄 分页处理

```javascript
// 首次请求
const firstPage = await fetch(
  `${API_BASE}/api/v1/douyin/app/v3/fetch_user_post_videos?sec_user_id=${secUid}&count=20&max_cursor=0`
)

const data = await firstPage.json()

// 检查是否有更多数据
if (data.data.has_more === 1) {
  // 获取下一页
  const nextPage = await fetch(
    `${API_BASE}/api/v1/douyin/app/v3/fetch_user_post_videos?sec_user_id=${secUid}&count=20&max_cursor=${data.data.max_cursor}`
  )
}
```

## 💡 数据库设计建议

基于API返回的数据结构，建议的数据库表设计：

### Merchant (商家表)
```typescript
{
  id: string              // 主键
  uid: string             // 抖音UID
  secUid: string          // 加密的用户ID
  shortId: string         // 短ID
  uniqueId: string        // 唯一ID（抖音号）
  nickname: string        // 昵称
  signature: string       // 个人签名
  avatarUrl: string       // 头像URL

  // 认证信息
  verificationType: number        // 认证类型
  enterpriseVerifyReason: string  // 企业认证原因
  isVerified: boolean             // 是否认证

  // 地理位置
  region: string          // 地区
  city: string            // 城市

  // 统计信息（从用户资料获取，不是从视频）
  followerCount: number   // 粉丝数
  followingCount: number  // 关注数
  awemeCount: number      // 作品数
  totalFavorited: number  // 获赞总数

  // 元数据
  dataSource: string      // 数据来源（如：douyin）
  lastSyncAt: DateTime    // 最后同步时间
  createdAt: DateTime
  updatedAt: DateTime
}
```

### MerchantContent (商家内容表 - 视频)
```typescript
{
  id: string              // 主键
  merchantId: string      // 外键 -> Merchant.id

  // 视频基础信息
  awemeId: string         // 抖音视频ID（唯一）
  description: string     // 视频描述
  shareUrl: string        // 分享链接

  // 时间信息
  createTime: DateTime    // 发布时间
  isTop: boolean          // 是否置顶

  // 统计数据 - 核心指标
  diggCount: number       // 点赞数
  commentCount: number    // 评论数
  shareCount: number      // 分享数
  collectCount: number    // 收藏数
  playCount: number       // 播放数
  forwardCount: number    // 转发数

  // 视频元信息
  duration: number        // 时长（毫秒）
  videoWidth: number      // 视频宽度
  videoHeight: number     // 视频高度
  coverUrl: string        // 封面URL
  videoUrl: string        // 播放地址

  // 音乐信息
  musicId: string         // 音乐ID
  musicTitle: string      // 音乐标题
  musicAuthor: string     // 音乐作者
  isOriginalSound: boolean // 是否原创音乐

  // 标签 - JSON存储
  tags: Json              // 话题标签数组 [{name, id}]

  // 地理位置
  region: string
  city: string

  // 元数据
  dataSource: string
  lastSyncAt: DateTime
  createdAt: DateTime
  updatedAt: DateTime

  // 索引
  @@unique([awemeId])
  @@index([merchantId, createTime])
  @@index([diggCount])  // 用于热门排序
}
```

## 📊 实际数据示例

测试商家：**南宁润江贸易-辅材批发**

**基本信息**
- UID: 7534923995318584380
- sec_uid: MS4wLjABAAAALwnmSxBrIRF2Dh1J6IfWvdaORR1H0nJTgmcmtp0kd-m_AS2YR_Oczrvv9Ebxoupc
- 昵称: 南宁润江贸易-辅材批发
- 抖音号: 89260867412
- 认证: 企业认证 - 南宁市润江贸易有限公司

**示例视频数据**
- 视频ID: 7536181485112544563
- 描述: "南宁装修买辅材，为什么找萍姐？#南宁建材 #辅材 #南宁装修"
- 点赞: 171 | 评论: 44 | 分享: 29 | 收藏: 42
- 时长: 40秒
- 标签: #南宁建材 #辅材 #南宁装修
- 是否置顶: 是

## ⚠️ 注意事项

1. **参数命名差异**
   - 获取视频列表使用 `sec_user_id` 作为参数名
   - 某些端点可能使用 `sec_uid`
   - 需要根据具体端点调整

2. **播放数可能为0**
   - 某些视频的 `play_count` 可能返回0
   - 这可能是隐私设置或API限制
   - 不影响其他统计数据

3. **缓存机制**
   - API响应包含24小时有效的缓存URL
   - 可以用于减少重复请求成本
   - 格式: `https://cache.tikhub.io/api/v1/cache/public/{request_id}?sign={signature}`

4. **计费**
   - 每次成功请求都会被计费
   - 建议使用缓存URL重复访问
   - 合理控制请求频率

5. **数据更新频率**
   - 统计数据（点赞、评论等）是实时的
   - 建议定期同步而不是实时查询
   - 可以每天或每小时同步一次

## 🔧 实用工具脚本

项目中提供了以下测试脚本：

```bash
# 查看数据格式（需提供sec_uid）
SEC_UID="你的sec_uid" npx tsx scripts/view-tikhub-data-format.ts

# 查看预期数据格式（无需参数）
npx tsx scripts/view-tikhub-data-format.ts
```

## 📚 参考链接

- TikHub API 文档: https://api.tikhub.io
- TikHub 开发者文档: https://docs.tikhub.io
- 视频列表API: https://docs.tikhub.io/186826143e0
- Discord 支持: https://discord.gg/aMEAS8Xsvz
