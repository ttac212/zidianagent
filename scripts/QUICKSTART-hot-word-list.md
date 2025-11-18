# TikHub API 热门内容词测试工具 - 快速开始

## 功能说明

测试 TikHub API 的热门内容词接口，获取抖音平台热门关键词和话题趋势。

**API端点**: `/api/v1/douyin/billboard/fetch_hot_total_hot_word_list` (POST)

## 快速使用

### 1. 获取全部热门内容词（默认10条）

```bash
npx tsx scripts/test-hot-word-list.ts
```

**输出示例**:
```
1. 楚秉杰
   热度值: 1241.0万
   最新趋势: 20251115 - 329.2万

2. 中国电影金鸡奖
   热度值: 391.9万
   最新趋势: 20251115 - 100.7万
```

### 2. 搜索特定关键词

```bash
# 搜索包含"美食"的热门内容词
npx tsx scripts/test-hot-word-list.ts --keyword=美食

# 搜索包含"金鸡"的热门内容词
npx tsx scripts/test-hot-word-list.ts --keyword=金鸡 --size=5
```

### 3. 自定义参数

```bash
# 按小时窗口，每页50条
npx tsx scripts/test-hot-word-list.ts --window=1 --size=50

# 按天窗口（默认），每页20条
npx tsx scripts/test-hot-word-list.ts --window=24 --size=20
```

## 命令行参数

| 参数 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `--keyword` | 搜索关键词 | 无（全部） | `--keyword=美食` |
| `--window` | 时间窗口（1=按小时，24=按天） | 24 | `--window=1` |
| `--size` | 每页数量 | 10 | `--size=50` |

## 输出内容

- 内容词标题
- 热度值（自动格式化为万/亿）
- 上升比例
- 上升速度
- 最新趋势数据
- 完整数据导出到JSON文件

## 输出文件

- **全部词**: `hot-word-list-output.json`
- **关键词搜索**: `hot-word-list-{关键词}-output.json`

## 应用场景

1. **内容创作**: 发现热门话题，优化内容方向
2. **趋势分析**: 跟踪关键词热度变化
3. **营销策略**: 基于热词制定推广计划
4. **竞品监控**: 监控行业相关热词
5. **数据分析**: 导出JSON数据进行深度分析

## 前置条件

1. 配置环境变量（`.env.local`）:
```env
TIKHUB_API_BASE_URL=https://api.tikhub.dev  # 中国大陆
TIKHUB_API_KEY=your_api_key_here
```

2. 获取API Key: https://user.tikhub.io

3. 安装依赖:
```bash
pnpm install
```

## 常见使用示例

### 发现热门话题
```bash
npx tsx scripts/test-hot-word-list.ts --size=20
```

### 搜索特定领域热词
```bash
# 美食领域
npx tsx scripts/test-hot-word-list.ts --keyword=美食 --size=10

# 科技领域
npx tsx scripts/test-hot-word-list.ts --keyword=科技 --size=10

# 娱乐领域
npx tsx scripts/test-hot-word-list.ts --keyword=明星 --size=10
```

### 实时热词监控（按小时）
```bash
npx tsx scripts/test-hot-word-list.ts --window=1 --size=30
```

## 费用

- **定价**: $0.001 USD / 请求
- **计费条件**: 仅在返回状态码 200 时计费
- **数据更新**: 实时，不缓存

## 相关文件

- **测试脚本**: `scripts/test-hot-word-list.ts`
- **类型定义**: `lib/tikhub/types.ts`
- **客户端方法**: `lib/tikhub/client.ts` (getHotWordList)
- **详细文档**: `scripts/README-hot-word-list-test.md`

## 故障排查

**问题**: API连接失败

**解决**:
1. 检查 `TIKHUB_API_KEY` 是否正确
2. 确认网络连接正常
3. 验证API Key有效性（访问 https://user.tikhub.io）

**问题**: 搜索无结果

**解决**:
1. 尝试使用更通用的关键词
2. 检查关键词拼写是否正确
3. 尝试不同的时间窗口参数

## 更多信息

查看完整文档: `scripts/README-hot-word-list-test.md`
