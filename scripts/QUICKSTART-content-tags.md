# TikHub API 垂类内容标签测试工具 - 快速开始

## 🚀 快速开始

### 第一步: 确认环境配置

确保 `.env.local` 文件中已配置 API Key（与城市列表测试共用）:

```env
TIKHUB_API_KEY=your_api_key_here
TIKHUB_API_BASE_URL=https://api.tikhub.io
```

### 第二步: 运行测试

```bash
# 获取完整标签树
npx tsx scripts/test-content-tags.ts

# 搜索特定标签
npx tsx scripts/test-content-tags.ts --search=美食
```

## 📋 测试功能

### ✅ 已实现功能

1. **获取完整标签树**
   - 36个顶级标签
   - 309个标签总数（包括所有子标签）
   - 树形结构可视化展示
   - 自动统计标签数量

2. **搜索标签**
   - 支持按标签名称搜索
   - 递归搜索所有层级
   - 显示匹配标签的完整信息

3. **查询参数构建**
   - 自动生成 query_tag 参数
   - 支持单标签和多标签
   - 符合 TikHub API 规范

4. **数据导出**
   - 自动保存到 `content-tags-output.json`
   - 包含完整的标签树数据
   - 便于进一步分析

## 📊 输出示例

### 成功输出

```
✅ 成功获取垂类内容标签
顶级标签数量: 36
标签总数: 309 (包括所有子标签)

=== 垂类标签树（前10个顶级标签，最多显示2层）===

├─ 美食 (ID: 628)
│  ├─ 品酒教学 (ID: 62808)
│  ├─ 美食教程 (ID: 62804)
│  ├─ 美食知识 (ID: 62806)
│  └─ 美食测评 (ID: 62803)
│     ... 还有 6 个子标签

=== 查询参数构建示例 ===

标签: 美食 (ID: 628)
子标签数量: 10

查询参数 (包含所有子标签):
{"value":628,"children":[{"value":62808},{"value":62804},...]}

📄 完整数据已保存到: ./content-tags-output.json
```

## 🔧 技术实现

### 新增文件

1. **类型定义**: `lib/tikhub/types.ts`
   - `ContentTag` - 标签信息类型（支持递归）
   - `DouyinContentTagResponse` - API 响应类型

2. **客户端方法**: `lib/tikhub/client.ts`
   - `getContentTags()` - 获取垂类内容标签

3. **测试脚本**: `scripts/test-content-tags.ts`
   - 完整的测试工具实现
   - 递归树遍历和展示
   - 标签搜索功能
   - 查询参数构建

### API 信息

- **端点**: `/api/v1/douyin/billboard/fetch_content_tag`
- **方法**: GET
- **认证**: Bearer Token
- **费用**: $0.001/请求 (状态码 200 时计费)
- **缓存**: 24 小时

## 💡 使用场景

### 1. 内容分类查询
```typescript
// 构建美食类标签查询参数
const queryTag = {
  value: 628,  // 美食
  children: [
    { value: 62804 },  // 美食教程
    { value: 62803 }   // 美食测评
  ]
}

// 用于其他 API 接口的内容筛选
```

### 2. 标签分析
- 分析各垂类内容的细分程度
- 研究热门内容分类
- 规划内容策略

### 3. 推荐系统
- 基于标签的内容匹配
- 用户兴趣建模
- 个性化推荐

## 📚 常见标签分类

根据测试结果，主要分类包括：

| 顶级标签 | ID | 子标签数量 | 示例子标签 |
|---------|-----|-----------|-----------|
| 美食 | 628 | 10 | 品酒教学、美食教程、美食测评 |
| 旅行 | 629 | 13 | 旅行风景、旅行记录、户外生活 |
| 休闲娱乐 | 634 | 13 | 逛街、现场演出、运动玩乐 |
| 文化 | 624 | 20 | 传统文化、武术、传统建筑 |
| 舞蹈 | 612 | 15 | 芭蕾舞、手势舞、舞蹈教学 |
| 教育校园 | 626 | 13 | 高考、出国留学、艺考 |
| 汽车 | 635 | 9 | 车辆类型、用车、新车 |

...更多标签请运行测试工具查看完整列表

## 🐛 故障排查

| 错误 | 原因 | 解决方法 |
|------|------|---------|
| `API key is required` | 未配置 TIKHUB_API_KEY | 在 `.env.local` 中添加 API Key |
| `401 Unauthorized` | API Key 无效 | 检查 API Key 是否正确或已过期 |
| `响应数据格式错误` | API 返回格式变化 | 查看详细日志,更新类型定义 |

## 📖 更多文档

详细文档请查看: `scripts/README-content-tags-test.md`

## ✨ 使用建议

1. **首次使用**: 先运行基本测试,了解完整的标签树结构
2. **查找标签**: 使用 `--search` 参数快速找到需要的标签
3. **数据导出**: 查看 `content-tags-output.json` 文件获取完整数据
4. **参数构建**: 参考测试输出构建符合 API 规范的查询参数

## 🔗 相关工具

- **城市列表测试**: `scripts/test-city-list.ts`
- **TikHub API 测试**: `scripts/test-tikhub-api.ts`

## 📞 技术支持

- **项目文档**: `CLAUDE.md`
- **TikHub 文档**: https://docs.tikhub.io
- **用户中心**: https://user.tikhub.io
