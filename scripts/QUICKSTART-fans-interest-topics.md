# TikHub API 粉丝感兴趣话题测试工具 - 快速开始

## 🚀 快速开始

### 第一步: 确认环境配置

确保 `.env.local` 文件中已配置 API Key:

```env
TIKHUB_API_KEY=your_api_key_here
TIKHUB_API_BASE_URL=https://api.tikhub.io
```

### 第二步: 运行测试

```bash
# 使用默认测试账号（人民日报）
npx tsx scripts/test-fans-interest-topics.ts

# 使用自定义账号
npx tsx scripts/test-fans-interest-topics.ts --sec-uid=MS4wLjABAAAA8U_l6rBzmy7bcy6xOJel4v0RzoR_wfAubGPeJimN__4
```

## 📋 命令行参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `--sec-uid` | 用户的sec_uid | `--sec-uid=MS4wLjABAAAA...` |

## 📊 输出示例

### 成功输出（有数据）

```
✅ 成功获取粉丝感兴趣的话题
话题数量: 10

=== 粉丝感兴趣的话题列表 ===

1. 美食教程
   话题ID: 62804
   兴趣度分数: 95.5
   排名: 1

2. 美食测评
   话题ID: 62803
   兴趣度分数: 89.2
   排名: 2

📄 完整数据已保存到: ./fans-interest-topics-output.json
```

### 空数据输出

```
✅ 成功获取粉丝感兴趣的话题
话题数量: 0

未获取到话题数据

原始响应: {
  "code": 0,
  "data": [],
  "extra": {
    "now": 1763346730000
  },
  "message": ""
}
```

## 🔧 技术实现

### 新增文件

1. **类型定义**: `lib/tikhub/types.ts`
   - `FansInterestTopic` - 话题信息类型
   - `DouyinFansInterestTopicListResponse` - API 响应类型
   - `GetFansInterestTopicListParams` - 请求参数类型

2. **客户端方法**: `lib/tikhub/client.ts`
   - `getFansInterestTopicList()` - 获取粉丝感兴趣话题列表

3. **测试脚本**: `scripts/test-fans-interest-topics.ts`
   - 完整的测试工具实现
   - 命令行参数支持
   - 预设测试账号

### API 信息

- **端点**: `/api/v1/douyin/billboard/fetch_hot_account_fans_interest_topic_list`
- **方法**: GET
- **认证**: Bearer Token
- **参数**: `sec_uid` (必需)
- **返回**: 近3天粉丝感兴趣的话题列表（最多10个）
- **费用**: $0.001/请求 (状态码 200 时计费)

## 💡 使用场景

### 1. 了解粉丝兴趣
- 分析粉丝近期关注的热门话题
- 发现粉丝兴趣变化趋势
- 为内容创作提供方向参考

### 2. 内容策略优化
- 基于粉丝兴趣话题调整内容方向
- 提高内容与粉丝兴趣的匹配度
- 增加粉丝互动和粘性

### 3. 竞品分析
- 对比不同账号粉丝的兴趣差异
- 研究竞品粉丝画像
- 优化目标受众定位

## ⚠️ 注意事项

### 数据可用性
根据测试结果，某些账号可能返回空数据：
- 近3天内没有明显的粉丝兴趣话题数据
- 需要账号达到一定粉丝规模或活跃度
- 可能需要特定的账号权限或数据授权

### 建议
- 尝试多个不同类型的账号
- 选择粉丝活跃度较高的账号
- 定期查询观察数据变化

## 🐛 故障排查

| 错误 | 原因 | 解决方法 |
|------|------|---------
| `API key is required` | 未配置 TIKHUB_API_KEY | 在 `.env.local` 中添加 API Key |
| `401 Unauthorized` | API Key 无效 | 检查 API Key 是否正确或已过期 |
| `sec_uid is required` | 缺少必需参数 | 使用 `--sec-uid` 参数指定账号 |
| 返回空数组 | 无数据 | 尝试其他账号或稍后重试 |

## 📖 更多文档

详细文档请查看: `scripts/README-fans-interest-topics-test.md`

## ✨ 使用建议

1. **首次使用**: 先使用默认测试账号了解接口返回格式
2. **自定义查询**: 使用 `--sec-uid` 参数查询目标账号
3. **数据分析**: 结合多个账号的数据进行对比分析
4. **定期监控**: 定期查询观察粉丝兴趣变化趋势

## 🔗 相关工具

- **热门账号测试**: `scripts/test-hot-accounts.ts` - 获取热门账号列表
- **内容标签测试**: `scripts/test-content-tags.ts` - 获取垂类标签列表
- **城市列表测试**: `scripts/test-city-list.ts` - 获取城市列表

## 📞 技术支持

- **项目文档**: `CLAUDE.md`
- **TikHub 文档**: https://docs.tikhub.io
- **用户中心**: https://user.tikhub.io
