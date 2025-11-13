# TikHub API 400 错误修复报告

## 问题描述

在评论分析 Pipeline 的 `fetch-statistics` 步骤中,TikHub API 调用失败,返回 400 Bad Request 错误:

```
[COMMENTS_STATS] 获取视频统计数据失败: {
  code: 400,
  message: 'Bad Request',
  endpoint: '/api/v1/douyin/app/v3/fetch_video_statistics',
  ...
}
```

## 根本原因

环境变量 `.env.local` 中配置的 TikHub API 基础 URL 不正确:

- **错误配置**: `TIKHUB_API_BASE_URL=https://api.tikhub.dev`
- **正确配置**: `TIKHUB_API_BASE_URL=https://api.tikhub.io`

经过测试验证:
- `api.tikhub.io` - ✓ 支持 `fetch_video_statistics` 端点
- `api.tikhub.dev` - ✗ **不支持**该端点,返回 400 错误

## 修复措施

### 1. 修复环境配置 (关键修复)

```bash
# .env.local
- TIKHUB_API_BASE_URL=https://api.tikhub.dev
+ TIKHUB_API_BASE_URL=https://api.tikhub.io
```

### 2. 优化降级策略 (防御性改进)

在 `lib/douyin/comments-pipeline.ts` 中优化了统计数据获取逻辑:

**改进前**:
- 使用复杂的 try-catch 嵌套
- 错误日志使用 `console.error`,不清晰
- 降级方案不透明,用户不知道使用了哪个数据源

**改进后**:
```typescript
// 主策略: 使用专门的统计 API
try {
  const stats = await tikhubClient.getVideoStatistics({
    aweme_ids: videoId
  })
  // 处理并验证数据...
} catch (error) {
  console.warn('[COMMENTS_STATS] 获取统计数据失败，尝试降级方案:', error)
}

// 降级方案: 使用视频详情中的统计数据
if (!statistics) {
  await emitProgress(emit, 'fetch-statistics', 'active', '使用视频详情中的统计数据...')
  const fallbackStatistics = normalizeStatisticsData(awemeDetail.statistics)

  if (fallbackStatistics) {
    statistics = fallbackStatistics
    usedFallback = true
    console.log('[COMMENTS_STATS] 成功使用降级数据源:', statistics)
  }
}

// 明确告知用户使用了哪个数据源
const completionDetail = usedFallback
  ? '已获取统计数据（使用降级数据源）'
  : '已获取统计数据'
await emitProgress(emit, 'fetch-statistics', 'completed', completionDetail)
```

**关键改进**:
1. ✅ 清晰的双层策略: 主API → 降级方案
2. ✅ 使用 `console.warn` 替代 `console.error`,更符合降级场景
3. ✅ 通过 `emitProgress` 向用户展示数据来源
4. ✅ 简化了错误处理逻辑,提高可读性

## 验证结果

### 测试 1: API 域名对比

```bash
$ npx tsx scripts/test-tikhub-domains.ts

测试域名: https://api.tikhub.io
HTTP 状态码: 200 ✓
返回数据: {
  "data": {
    "statistics_list": [{
      "aweme_id": "7563973955766521146",
      "digg_count": 4639,
      "play_count": 237324,
      "share_count": 44
    }]
  }
}

测试域名: https://api.tikhub.dev
HTTP 状态码: 400 ✗
错误: "Request failed. Please retry..."
```

### 测试 2: 修复后的 API 调用

```bash
$ npx tsx scripts/verify-tikhub-fix.ts

测试配置:
- API Base URL: https://api.tikhub.io
- 视频ID: 7563973955766521146

[测试] 获取视频统计数据...
✓ 成功!

统计数据: {
  "statistics_list": [{
    "digg_count": 4639,
    "play_count": 237339,
    "share_count": 44,
    "aweme_id": "7563973955766521146"
  }]
}
```

## 相关文件

- `lib/douyin/comments-pipeline.ts:465-539` - 统计数据获取逻辑
- `lib/tikhub/config.ts:10` - API 基础 URL 配置
- `.env.local` - 环境变量配置文件

## 防止复发

### 环境变量检查清单

在部署或配置新环境时,确保:

1. ✅ `TIKHUB_API_BASE_URL=https://api.tikhub.io` (生产域名)
2. ✅ `TIKHUB_API_KEY` 已正确配置
3. ✅ 运行 `npx tsx scripts/verify-tikhub-fix.ts` 验证连接

### 监控建议

在生产环境中添加监控:

```typescript
// 示例: 监控降级方案使用频率
if (usedFallback) {
  logger.warn('StatisticsAPI降级', {
    videoId,
    reason: 'API调用失败'
  })

  // 发送告警到监控系统
  metrics.increment('tikhub.stats.fallback')
}
```

## 总结

- **问题**: API 域名配置错误导致 400 错误
- **修复**: 更正 `.env.local` 中的 `TIKHUB_API_BASE_URL`
- **优化**: 改进降级策略,提高透明度和用户体验
- **结果**: ✅ API 调用恢复正常,即使主 API 失败也能优雅降级

修复日期: 2025-11-13
修复人员: Claude Code Assistant
