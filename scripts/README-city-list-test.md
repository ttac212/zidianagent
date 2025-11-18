# TikHub API 城市列表测试工具

## 功能说明

这个测试工具用于测试 TikHub API 的中国城市列表接口。

### API 信息
- **端点**: `/api/v1/douyin/billboard/fetch_city_list`
- **方法**: GET
- **认证**: Bearer Token (使用 `TIKHUB_API_KEY`)
- **参数**: 无
- **返回**: 中国城市列表数据

## 使用方法

### 1. 基本使用 - 获取完整城市列表

```bash
npx tsx scripts/test-city-list.ts
```

**输出内容包括**:
- 城市总数统计
- 省份数量统计
- 前10个省份及其城市预览
- 城市数量最多的5个省份排名
- 完整数据导出到 `city-list-output.json` 文件

### 2. 搜索特定城市

```bash
npx tsx scripts/test-city-list.ts --search=北京
```

```bash
npx tsx scripts/test-city-list.ts --search=深圳
```

**输出内容包括**:
- 匹配的城市列表
- 每个城市的详细信息(城市名、省份、城市代码、省份代码)

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

## 输出示例

### 基本使用输出

```
╔══════════════════════════════════════════════════╗
║     TikHub API - 中国城市列表测试工具            ║
╚══════════════════════════════════════════════════╝

=== 测试获取中国城市列表 ===

正在获取城市列表...

✅ 成功获取城市列表
总计: 368 个城市

省份数量: 34

=== 省份及城市预览（前10个省份）===

📍 北京 (16 个城市)
   ├─ 东城区 (代码: 110101)
   ├─ 西城区 (代码: 110102)
   ├─ 朝阳区 (代码: 110105)
   ├─ 丰台区 (代码: 110106)
   └─ 石景山区 (代码: 110107)
   └─ ... 还有 11 个城市

📍 广东 (21 个城市)
   ├─ 广州 (代码: 440100)
   ├─ 深圳 (代码: 440300)
   ├─ 珠海 (代码: 440400)
   ├─ 汕头 (代码: 440500)
   └─ 佛山 (代码: 440600)
   └─ ... 还有 16 个城市

...

=== 详细统计 ===

城市数量最多的省份（前5名）:
  1. 广东: 21 个城市
  2. 江苏: 13 个城市
  3. 山东: 16 个城市
  4. 浙江: 11 个城市
  5. 河北: 11 个城市

📄 完整数据已保存到: ./city-list-output.json
```

### 搜索城市输出

```
=== 搜索城市: "深圳" ===

找到 1 个匹配的城市:

1. 深圳
   省份: 广东
   城市代码: 440300
   省份代码: 440000
```

## 输出文件

测试工具会自动生成 `city-list-output.json` 文件,包含:

```json
{
  "total": 368,
  "provinces": 34,
  "data": {
    "city_list": [...]
  },
  "grouped": {
    "北京": [...],
    "广东": [...],
    ...
  }
}
```

## 相关文件

- **测试脚本**: `scripts/test-city-list.ts`
- **类型定义**: `lib/tikhub/types.ts` (CityInfo, DouyinCityListResponse)
- **客户端方法**: `lib/tikhub/client.ts` (getCityList)

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
- 确认 API Key 是否有效(访问 https://user.tikhub.io 检查)
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
- 查看完整响应内容,确认 API 返回格式
- 更新类型定义以匹配实际 API 响应

## 技术架构

### 设计特点

1. **类型安全**: 使用 TypeScript 定义完整的 API 响应类型
2. **错误处理**: 完善的错误捕获和提示
3. **熔断保护**: 内置熔断器防止 API 过载
4. **重试机制**: 自动重试失败的请求
5. **数据导出**: 自动保存完整数据到 JSON 文件

### 核心组件

```
test-city-list.ts
├── getTikHubClient()         # TikHub 客户端单例
├── testGetCityList()         # 获取完整城市列表测试
├── testSearchCity()          # 搜索特定城市测试
└── groupCitiesByProvince()   # 按省份分组城市
```

## 扩展用法

### 在代码中使用

```typescript
import { getTikHubClient } from '@/lib/tikhub'

async function getCities() {
  const client = getTikHubClient()
  const response = await client.getCityList()

  console.log(`获取到 ${response.city_list.length} 个城市`)

  // 处理城市数据
  response.city_list.forEach(city => {
    console.log(`${city.province_name} - ${city.city_name}`)
  })
}
```

### 集成到其他功能

城市列表数据可以用于:
- 用户地域筛选
- 数据分析地域分组
- 地图可视化
- 区域运营策略

## 许可证

本项目遵循项目主仓库的许可证。
