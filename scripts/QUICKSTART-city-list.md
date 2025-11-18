# TikHub API 城市列表测试工具 - 快速开始

## 🚀 快速开始

### 第一步: 配置 API Key

在项目根目录的 `.env.local` 文件中添加:

```env
TIKHUB_API_KEY=your_api_key_here
```

> **获取 API Key**: 访问 [TikHub 用户中心](https://user.tikhub.io) 注册并创建 API Token

### 第二步: 运行测试

```bash
# 获取完整城市列表
npx tsx scripts/test-city-list.ts

# 搜索特定城市
npx tsx scripts/test-city-list.ts --search=深圳
```

## 📋 测试功能

### ✅ 已实现功能

1. **获取完整城市列表**
   - 显示城市总数和省份数量
   - 按省份分组显示城市
   - 统计每个省份的城市数量
   - 导出完整数据到 JSON 文件

2. **搜索特定城市**
   - 支持城市名称搜索
   - 支持省份名称搜索
   - 显示匹配城市的详细信息

3. **数据导出**
   - 自动保存到 `city-list-output.json`
   - 包含原始数据和按省份分组的数据

## 📊 输出示例

### 成功输出

```
✅ 成功获取城市列表
总计: 368 个城市

省份数量: 34

=== 省份及城市预览（前10个省份）===

📍 北京 (16 个城市)
   ├─ 东城区 (代码: 110101)
   ├─ 西城区 (代码: 110102)
   ...

📄 完整数据已保存到: ./city-list-output.json
```

## 🔧 技术实现

### 新增文件

1. **类型定义**: `lib/tikhub/types.ts`
   - `CityInfo` - 城市信息类型
   - `DouyinCityListResponse` - API 响应类型

2. **客户端方法**: `lib/tikhub/client.ts`
   - `getCityList()` - 获取城市列表

3. **测试脚本**: `scripts/test-city-list.ts`
   - 完整的测试工具实现
   - 数据分组和统计功能
   - 搜索功能

### API 信息

- **端点**: `/api/v1/douyin/billboard/fetch_city_list`
- **方法**: GET
- **认证**: Bearer Token
- **费用**: $0.001/请求 (状态码 200 时计费)
- **缓存**: 24 小时

## 🐛 故障排查

| 错误 | 原因 | 解决方法 |
|------|------|---------|
| `API key is required` | 未配置 TIKHUB_API_KEY | 在 `.env.local` 中添加 API Key |
| `401 Unauthorized` | API Key 无效 | 检查 API Key 是否正确或已过期 |
| `响应数据格式错误` | API 返回格式变化 | 查看详细日志,更新类型定义 |

## 📚 更多文档

详细文档请查看: `scripts/README-city-list-test.md`

## ✨ 使用建议

1. **首次使用**: 先运行基本测试,确认 API 连接正常
2. **搜索城市**: 使用 `--search` 参数快速查找特定城市
3. **数据分析**: 查看导出的 JSON 文件进行进一步分析
4. **集成应用**: 在代码中调用 `client.getCityList()` 获取城市数据

## 📞 技术支持

- **项目文档**: `CLAUDE.md`
- **TikHub 文档**: https://docs.tikhub.io
- **用户中心**: https://user.tikhub.io
