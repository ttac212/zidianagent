# TikHub API 视频热榜测试工具 - 快速开始

## 🚀 快速开始

### 第一步: 确认环境配置

确保 `.env.local` 文件中已配置 API Key:

```env
TIKHUB_API_KEY=your_api_key_here
TIKHUB_API_BASE_URL=https://api.tikhub.io
```

### 第二步: 运行测试

```bash
# 获取全部垂类的视频热榜（默认10条）
npx tsx scripts/test-hot-video-list.ts

# 获取特定垂类的视频热榜（美食垂类）
npx tsx scripts/test-hot-video-list.ts --tag=628

# 自定义参数
npx tsx scripts/test-hot-video-list.ts --tag=628 --window=1 --size=20
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
✅ 成功获取视频热榜
本页数量: 5
总数: 1000
有更多数据: 是

=== 美食垂类 - 热门视频列表 ===

1. 带入薯饼视角belike：人在工位，昏昏欲碎
   作者: 麦当劳
   播放: 626.6万
   点赞: 30.8万
   粉丝: 231.4万
   关注: 1.2万
   热度值: 825787
   发布时间: 2天前

2. "所以喜欢能当饭吃"
   作者: 宋.
   播放: 1038.3万
   点赞: 70.8万
   粉丝: 78.3万
   关注: 4196
   热度值: 528618
   发布时间: 7天前

📄 完整数据已保存到: ./hot-video-list-628-output.json
```

## 🔧 技术实现

### 新增文件

1. **类型定义**: `lib/tikhub/types.ts`
   - `HotVideoListTag` - 标签查询参数
   - `GetHotVideoListParams` - 请求参数
   - `HotVideoInfo` - 视频信息
   - `DouyinHotVideoListResponse` - API 响应类型

2. **客户端方法**: `lib/tikhub/client.ts`
   - `getHotVideoList()` - 获取视频热榜列表（POST请求）

3. **测试脚本**: `scripts/test-hot-video-list.ts`
   - 完整的测试工具实现
   - 支持全部垂类和特定垂类查询
   - 命令行参数支持
   - 数据格式化显示

### API 信息

- **端点**: `/api/v1/douyin/billboard/fetch_hot_total_video_list`
- **方法**: POST
- **认证**: Bearer Token
- **费用**: $0.001/请求 (状态码 200 时计费)
- **缓存**: 不缓存（实时数据）

## 💡 使用场景

### 1. 发现热门内容
```bash
# 查看美食垂类的热门视频
npx tsx scripts/test-hot-video-list.ts --tag=628

# 查看旅行垂类的热门视频
npx tsx scripts/test-hot-video-list.ts --tag=629
```

### 2. 内容趋势分析
- 分析不同垂类的热门内容特征
- 研究爆款视频的共同点
- 发现内容创作趋势

### 3. 竞品分析
- 研究同垂类热门内容
- 分析创作者策略
- 优化内容方向

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
| `本页数量: 0` | 垂类ID无效或无热门视频 | 检查垂类ID是否正确 |

## 📖 更多文档

详细文档请查看: `scripts/README-hot-video-list-test.md`

## ✨ 使用建议

1. **首次使用**: 先运行基本测试,了解全部垂类的视频热榜
2. **垂类筛选**: 使用 `--tag` 参数查看特定垂类的热门视频
3. **时间窗口**: 使用 `--window` 参数调整时间范围（按小时/按天）
4. **数据导出**: 查看 JSON 文件获取完整数据

## 🔗 相关工具

- **热门账号测试**: `scripts/test-hot-accounts.ts` - 获取热门账号列表
- **内容标签测试**: `scripts/test-content-tags.ts` - 获取垂类标签列表
- **城市列表测试**: `scripts/test-city-list.ts` - 获取城市列表

## 📞 技术支持

- **项目文档**: `CLAUDE.md`
- **TikHub 文档**: https://docs.tikhub.io
- **用户中心**: https://user.tikhub.io
