# TikHub API 热门账号测试工具 - 快速开始

## 🚀 快速开始

### 第一步: 确认环境配置

确保 `.env.local` 文件中已配置 API Key（与城市列表和垂类标签测试共用）:

```env
TIKHUB_API_KEY=your_api_key_here
TIKHUB_API_BASE_URL=https://api.tikhub.io
```

### 第二步: 运行测试

```bash
# 获取全部垂类的热门账号（默认10条）
npx tsx scripts/test-hot-accounts.ts

# 获取特定垂类的热门账号（美食垂类）
npx tsx scripts/test-hot-accounts.ts --tag=628

# 自定义参数
npx tsx scripts/test-hot-accounts.ts --tag=628 --hours=48 --size=20
```

## 📋 命令行参数

| 参数 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `--tag` | 垂类标签ID | 无（全部垂类） | `--tag=628` (美食) |
| `--hours` | 时间窗口（小时） | 24 | `--hours=48` |
| `--size` | 每页数量 | 10 | `--size=20` |

## 📊 输出示例

### 成功输出

```
✅ 成功获取热门账号
本页数量: 5
有更多数据: 是

=== 美食垂类 - 热门账号列表 ===

1. 跳投哥 葱油饼
   粉丝数: 331.3万
   获赞数: 3527.4万
   作品数: 1472

2. 达哥在上海
   粉丝数: 528.3万
   获赞数: 7542.1万
   作品数: 653

📄 完整数据已保存到: ./hot-accounts-628-output.json
```

## 🔧 技术实现

### 新增文件

1. **类型定义**: `lib/tikhub/types.ts`
   - `HotAccountQueryTag` - 垂类标签查询参数
   - `GetHotAccountListParams` - 请求参数
   - `HotAccountInfo` - 账号信息
   - `DouyinHotAccountListResponse` - API 响应类型

2. **客户端方法**: `lib/tikhub/client.ts`
   - `getHotAccountList()` - 获取热门账号列表（POST请求）

3. **测试脚本**: `scripts/test-hot-accounts.ts`
   - 完整的测试工具实现
   - 支持全部垂类和特定垂类查询
   - 命令行参数支持
   - 数据格式化显示

### API 信息

- **端点**: `/api/v1/douyin/billboard/fetch_hot_account_list`
- **方法**: POST
- **认证**: Bearer Token
- **费用**: $0.001/请求 (状态码 200 时计费)
- **缓存**: 不缓存（实时数据）

## 💡 使用场景

### 1. 发现垂类头部账号
```bash
# 查看美食垂类的热门账号
npx tsx scripts/test-hot-accounts.ts --tag=628

# 查看旅行垂类的热门账号
npx tsx scripts/test-hot-accounts.ts --tag=629
```

### 2. 竞品分析
- 分析同垂类头部账号的内容策略
- 研究粉丝增长趋势
- 对标账号选择

### 3. 市场趋势研究
- 不同时间窗口的热门账号变化
- 新兴账号发现
- 垂类热度分析

## 📚 常见垂类标签

| 垂类 | ID | 使用示例 |
|------|----|----|
| 美食 | 628 | `--tag=628` |
| 旅行 | 629 | `--tag=629` |
| 休闲娱乐 | 634 | `--tag=634` |
| 文化 | 624 | `--tag=624` |
| 舞蹈 | 612 | `--tag=612` |
| 教育校园 | 626 | `--tag=626` |
| 汽车 | 635 | `--tag=635` |

获取完整标签列表:
```bash
npx tsx scripts/test-content-tags.ts
```

## 🐛 故障排查

| 错误 | 原因 | 解决方法 |
|------|------|---------
| `API key is required` | 未配置 TIKHUB_API_KEY | 在 `.env.local` 中添加 API Key |
| `401 Unauthorized` | API Key 无效 | 检查 API Key 是否正确或已过期 |
| `响应数据格式错误` | API 返回格式变化 | 查看详细日志,更新类型定义 |
| `本页数量: 0` | 垂类ID无效或该垂类无热门账号 | 检查垂类ID是否正确 |

## 📖 更多文档

详细文档请查看: `scripts/README-hot-accounts-test.md`

## ✨ 使用建议

1. **首次使用**: 先运行基本测试,了解全部垂类的热门账号
2. **垂类筛选**: 使用 `--tag` 参数查看特定垂类的热门账号
3. **时间窗口**: 使用 `--hours` 参数调整时间范围（24/48/72小时）
4. **数据导出**: 查看 `hot-accounts-output.json` 文件获取完整数据

## 🔗 相关工具

- **内容标签测试**: `scripts/test-content-tags.ts` - 获取垂类标签列表
- **城市列表测试**: `scripts/test-city-list.ts` - 获取城市列表
- **TikHub API 测试**: `scripts/test-tikhub-api.ts` - 测试API连接

## 📞 技术支持

- **项目文档**: `CLAUDE.md`
- **TikHub 文档**: https://docs.tikhub.io
- **用户中心**: https://user.tikhub.io
