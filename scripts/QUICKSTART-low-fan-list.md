# TikHub API 低粉爆款榜测试工具 - 快速开始

## 🚀 快速开始

### 第一步: 确认环境配置

确保 `.env.local` 文件中已配置 API Key:

```env
TIKHUB_API_KEY=your_api_key_here
TIKHUB_API_BASE_URL=https://api.tikhub.io
```

### 第二步: 运行测试

```bash
# 获取全部垂类的低粉爆款榜（默认10条）
npx tsx scripts/test-low-fan-list.ts

# 获取特定垂类的低粉爆款榜（美食垂类）
npx tsx scripts/test-low-fan-list.ts --tag=628

# 自定义参数
npx tsx scripts/test-low-fan-list.ts --tag=628 --window=1 --size=20
```

## 📋 命令行参数

| 参数 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `--tag` | 垂类标签ID | 无（全部垂类） | `--tag=628` (美食) |
| `--window` | 时间窗口 | 24 (按天) | `--window=1` (按小时) |
| `--size` | 每页数量 | 10 | `--size=20` |

**时间窗口说明**:
- `1` - 按小时
- `2` 或其他 - 按天

## 📊 输出示例

### 成功输出

```
✅ 成功获取低粉爆款榜
本页数量: 5
总数: 1000
有更多数据: 是

=== 美食垂类 - 低粉爆款视频列表 ===

1. 美中不足漏掉了一个，下次继续
   作者: 宁阳广场最辛苦的男人
   播放: 670.3万
   点赞: 6.6万
   粉丝: 3.4万
   关注: 691
   热度值: 458001
   发布时间: 2天前

2. @
   作者: 小怡的雷呀～
   播放: 1108.7万
   点赞: 48.5万
   粉丝: 2.0万
   关注: 8373
   热度值: 410213
   发布时间: 4天前

📄 完整数据已保存到: ./low-fan-list-628-output.json
```

## 🔧 技术实现

### 新增文件

1. **类型定义**: `lib/tikhub/types.ts`
   - `GetLowFanListParams` - 请求参数（复用 GetHotVideoListParams）
   - `LowFanVideoInfo` - 视频信息（复用 HotVideoInfo）
   - `DouyinLowFanListResponse` - API 响应类型

2. **客户端方法**: `lib/tikhub/client.ts`
   - `getLowFanList()` - 获取低粉爆款榜列表（POST请求）

3. **测试脚本**: `scripts/test-low-fan-list.ts`
   - 完整的测试工具实现
   - 支持全部垂类和特定垂类查询
   - 命令行参数支持
   - 数据格式化显示

### API 信息

- **端点**: `/api/v1/douyin/billboard/fetch_hot_total_low_fan_list`
- **方法**: POST
- **认证**: Bearer Token
- **费用**: $0.001/请求 (状态码 200 时计费)
- **缓存**: 不缓存（实时数据）

## 💡 使用场景

### 1. 发现低粉爆款内容
```bash
# 查看美食垂类的低粉爆款视频
npx tsx scripts/test-low-fan-list.ts --tag=628

# 查看旅行垂类的低粉爆款视频
npx tsx scripts/test-low-fan-list.ts --tag=629
```

### 2. 内容趋势分析
- 发现小账号的爆款内容特征
- 研究低粉爆款的共同点
- 分析新人创作者的成功案例

### 3. 创作灵感
- 学习小账号如何做出爆款内容
- 找到适合新人的创作方向
- 优化内容策略

## 📚 常见垂类标签

| 垂类 | ID | 使用示例 |
|------|----|----------|
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
|------|------|----------|
| `API key is required` | 未配置 TIKHUB_API_KEY | 在 `.env.local` 中添加 API Key |
| `401 Unauthorized` | API Key 无效 | 检查 API Key 是否正确或已过期 |
| `响应数据格式错误` | API 返回格式变化 | 查看详细日志,更新类型定义 |
| `本页数量: 0` | 垂类ID无效或无低粉爆款视频 | 检查垂类ID是否正确 |

## 📖 更多文档

详细文档请查看: `scripts/README-low-fan-list-test.md`

## ✨ 使用建议

1. **首次使用**: 先运行基本测试,了解全部垂类的低粉爆款榜
2. **垂类筛选**: 使用 `--tag` 参数查看特定垂类的低粉爆款视频
3. **时间窗口**: 使用 `--window` 参数调整时间范围（按小时/按天）
4. **数据导出**: 查看 JSON 文件获取完整数据

## 🔗 相关工具

- **视频热榜测试**: `scripts/test-hot-video-list.ts` - 获取热门视频列表
- **热门账号测试**: `scripts/test-hot-accounts.ts` - 获取热门账号列表
- **内容标签测试**: `scripts/test-content-tags.ts` - 获取垂类标签列表
- **城市列表测试**: `scripts/test-city-list.ts` - 获取城市列表

## 📞 技术支持

- **项目文档**: `CLAUDE.md`
- **TikHub 文档**: https://docs.tikhub.io
- **用户中心**: https://user.tikhub.io
