# TikHub API 垂类内容标签测试工具

## 功能说明

这个测试工具用于测试 TikHub API 的垂类内容标签接口，获取抖音的内容分类标签树。

### API 信息
- **端点**: `/api/v1/douyin/billboard/fetch_content_tag`
- **方法**: GET
- **认证**: Bearer Token (使用 `TIKHUB_API_KEY`)
- **参数**: 无
- **返回**: 垂类内容标签树（支持多层级结构）

## 使用方法

### 1. 基本使用 - 获取完整标签树

```bash
npx tsx scripts/test-content-tags.ts
```

**输出内容包括**:
- 顶级标签和标签总数统计
- 标签树可视化展示（支持多层级）
- 查询参数构建示例（用于 query_tag 参数）
- 完整数据导出到 `content-tags-output.json` 文件

### 2. 搜索特定标签

```bash
npx tsx scripts/test-content-tags.ts --search=美食
```

```bash
npx tsx scripts/test-content-tags.ts --search=旅行
```

**输出内容包括**:
- 匹配的标签列表（包括子标签）
- 每个标签的详细信息（ID、子标签列表）
- 查询参数构建示例

## 标签数据结构

### 标签对象
```typescript
interface ContentTag {
  value: number      // 标签ID (如: 628 代表美食)
  label: string      // 标签名称 (如: "美食")
  children?: ContentTag[]  // 子标签列表
}
```

### 示例数据
```json
{
  "value": 628,
  "label": "美食",
  "children": [
    { "value": 62808, "label": "品酒教学" },
    { "value": 62804, "label": "美食教程" },
    { "value": 62806, "label": "美食知识" }
  ]
}
```

## 查询参数构建

根据 TikHub API 文档，构建 `query_tag` 参数的方法：

### 单个顶级标签
```json
{"value": 628}
```

### 顶级标签 + 单个子标签
```json
{
  "value": 628,
  "children": [{"value": 62808}]
}
```

### 顶级标签 + 所有子标签
```json
{
  "value": 628,
  "children": [
    {"value": 62808},
    {"value": 62804},
    {"value": 62806},
    {"value": 62803},
    {"value": 62802},
    {"value": 62801},
    {"value": 62811},
    {"value": 62807},
    {"value": 62805},
    {"value": 62810}
  ]
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

### 基本使用输出

```
╔══════════════════════════════════════════════════╗
║     TikHub API - 垂类内容标签测试工具            ║
╚══════════════════════════════════════════════════╝

=== 测试获取垂类内容标签 ===

正在获取垂类内容标签...

✅ 成功获取垂类内容标签
顶级标签数量: 36
标签总数: 309 (包括所有子标签)

=== 垂类标签树（前10个顶级标签，最多显示2层）===

├─ 美食 (ID: 628)
│  ├─ 品酒教学 (ID: 62808)
│  ├─ 美食教程 (ID: 62804)
│  ├─ 美食知识 (ID: 62806)
│  ├─ 美食测评 (ID: 62803)
│  └─ 美食展示 (ID: 62802)
│     ... 还有 5 个子标签
├─ 旅行 (ID: 629)
│  ├─ 旅行风景 (ID: 62905)
│  ├─ 旅行记录与分享 (ID: 62913)
│  └─ ...

=== 查询参数构建示例 ===

标签: 美食 (ID: 628)
子标签数量: 10

查询参数 (包含所有子标签):
{"value":628,"children":[{"value":62808},{"value":62804},...]}

📄 完整数据已保存到: ./content-tags-output.json
```

### 搜索标签输出

```
=== 搜索标签: "美食" ===

找到 9 个匹配的标签:

1. 美食
   标签ID: 628
   子标签数量: 10
   子标签: 品酒教学, 美食教程, 美食知识, 美食测评, ...

   查询参数示例:
   {"value":628,"children":[{"value":62808},{"value":62804},...]}

2. 美食教程
   标签ID: 62804
   查询参数: {"value": 62804}

...
```

## 输出文件

测试工具会自动生成 `content-tags-output.json` 文件,包含:

```json
{
  "topLevelCount": 36,
  "totalCount": 309,
  "data": {
    "code": 0,
    "data": [
      {
        "value": 628,
        "label": "美食",
        "children": [...]
      },
      ...
    ]
  }
}
```

## 常见标签分类

根据测试结果，主要的顶级标签包括：

1. **美食** (628) - 10个子标签
   - 品酒教学、美食教程、美食知识、美食测评、美食展示等

2. **旅行** (629) - 13个子标签
   - 旅行风景、旅行记录与分享、旅行推荐与攻略等

3. **休闲娱乐** (634) - 13个子标签
   - 逛街、现场演出、传统休闲、运动玩乐等

4. **文化** (624) - 20个子标签
   - 传统文化、武术、人文、传统建筑等

5. **舞蹈** (612) - 15个子标签
   - 芭蕾舞、手势舞、肚皮舞、舞蹈教学等

...更多标签请运行测试工具查看

## 应用场景

### 1. 内容分类查询
使用标签 ID 构建查询参数，用于 TikHub 其他 API 接口的内容筛选。

### 2. 数据分析
- 分析不同垂类内容的分布
- 研究热门内容分类趋势
- 优化内容策略

### 3. 推荐系统
- 基于标签的内容推荐
- 用户兴趣建模
- 个性化内容分发

## API 费用

根据 TikHub API 定价:
- 每次请求: $0.001 USD
- 仅在返回状态码 200 时计费
- 缓存有效期: 24 小时

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

### 3. 响应数据格式错误

**错误**: `响应数据格式错误`

**解决方法**:
- 检查 API 端点是否正确
- 查看完整响应内容
- 更新类型定义以匹配实际 API 响应

## 技术实现

### 核心功能

1. **递归树遍历** - 支持任意层级的标签树展示
2. **智能搜索** - 递归搜索所有层级的标签
3. **查询参数构建** - 自动生成符合 API 要求的查询参数
4. **数据统计** - 自动统计标签数量和层级信息

### 设计特点

- ✅ 类型安全 - 完整的 TypeScript 类型定义
- ✅ 错误处理 - 完善的错误捕获和提示
- ✅ 树形展示 - 美观的控制台树形输出
- ✅ 数据导出 - 自动保存 JSON 格式数据

## 相关文件

- **测试脚本**: `scripts/test-content-tags.ts`
- **类型定义**: `lib/tikhub/types.ts` (ContentTag, DouyinContentTagResponse)
- **客户端方法**: `lib/tikhub/client.ts` (getContentTags)

## 在代码中使用

```typescript
import { getTikHubClient } from '@/lib/tikhub'

async function getTagsExample() {
  const client = getTikHubClient()
  const response = await client.getContentTags()

  console.log(`获取到 ${response.data.length} 个顶级标签`)

  // 处理标签数据
  response.data.forEach(tag => {
    console.log(`${tag.label} (ID: ${tag.value})`)
    if (tag.children) {
      console.log(`  子标签: ${tag.children.length} 个`)
    }
  })
}
```

### 构建查询参数

```typescript
import type { ContentTag } from '@/lib/tikhub/types'

// 单个标签
const queryTag1 = { value: 628 }

// 标签 + 子标签
const queryTag2 = {
  value: 628,
  children: [{ value: 62808 }, { value: 62804 }]
}

// 从标签对象构建
function buildQueryTag(tag: ContentTag) {
  if (!tag.children || tag.children.length === 0) {
    return { value: tag.value }
  }

  return {
    value: tag.value,
    children: tag.children.map(child => ({ value: child.value }))
  }
}
```

## 许可证

本项目遵循项目主仓库的许可证。
