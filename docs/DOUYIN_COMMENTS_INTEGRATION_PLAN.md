# 抖音评论分析功能集成方案

## 📋 项目概述

将已实现的抖音评论数据分析功能(包含LLM智能分析)集成到智点AI聊天系统中。

---

## 🏗️ 现有架构分析

### 1. 已有的抖音功能

**视频文案提取功能**:
- ✅ API路由: `app/api/douyin/extract-text/route.ts`
- ✅ Pipeline: `lib/douyin/pipeline.ts` (7步处理流程)
- ✅ 链接检测: `lib/douyin/link-detector.ts`
- ✅ Hook: `hooks/use-douyin-extraction.ts`
- ✅ 进度组件: `components/chat/douyin-progress.tsx`

**聊天系统集成方式**:
```typescript
// app/api/chat/route.ts 中的处理逻辑
if (detectDouyinLink(lastUserMessage.content)) {
  if (isDouyinShareRequest(lastUserMessage.content)) {
    // 调用 runDouyinPipeline() 处理视频
    // 通过SSE流式返回: douyin-progress, douyin-info, douyin-partial, douyin-done
  }
}
```

**SSE事件流协议**:
- `douyin-progress`: 处理进度更新
- `douyin-info`: 视频信息
- `douyin-partial`: 部分结果(转录文本、markdown)
- `douyin-done`: 处理完成
- `douyin-error`: 错误信息

### 2. 测试脚本现有功能

**文件**: `tests/manual/test-douyin-comments.ts`

**功能**:
1. ✅ 解析抖音分享链接
2. ✅ 获取视频详情(TikHub API)
3. ✅ 获取播放数据(精确播放量)
4. ✅ 采集评论(多页自动分页,最多100条)
5. ✅ 清理评论文本(删除`[表情]`等无意义内容)
6. ✅ 统计地域分布(从IP标签提取)
7. ✅ 调用LLM分析(Claude 3.5 Haiku)

**LLM分析维度**:
- 用户情感倾向(正面/负面/中性比例)
- 核心关注点(按权重排序)
- 具体需求分析
- 用户画像(地域分布、用户特征、消费心理)
- 潜在问题和改进建议

---

## 🎯 集成方案设计

### 方案选择: 独立API路由 (推荐)

**为什么不扩展现有Pipeline?**
1. 评论分析是独立功能(用户可能只想分析评论)
2. 评论分析不需要下载视频/提取音频等重操作
3. 可以单独调用,更灵活
4. 符合单一职责原则

**设计原则**:
- 复用现有架构模式(SSE流式、事件驱动)
- 保持与视频文案提取功能一致的用户体验
- 模块化设计,便于维护和扩展

---

## 📂 文件结构规划

### 新增文件

```
lib/douyin/
  ├── comments-pipeline.ts          # 评论分析Pipeline (新增)
  ├── comments-pipeline-steps.ts    # Pipeline步骤定义 (新增)

app/api/douyin/
  └── analyze-comments/
      └── route.ts                  # 评论分析API路由 (新增)

hooks/
  └── use-douyin-comments.ts        # 评论分析Hook (新增)

components/chat/
  └── douyin-comments-progress.tsx  # 评论分析进度组件 (新增)

types/
  └── chat.ts                       # 扩展类型定义
```

### 修改文件

```
app/api/chat/route.ts              # 集成评论分析检测
lib/douyin/link-detector.ts        # 添加评论分析请求检测
types/chat.ts                       # 添加comments相关事件类型
components/chat/smart-chat-center.tsx  # 处理comments事件
```

---

## 🔧 实现步骤

### Step 1: 创建Pipeline步骤定义

**文件**: `lib/douyin/comments-pipeline-steps.ts`

```typescript
export type DouyinCommentsPipelineStep =
  | 'parse-link'        // 解析链接
  | 'fetch-detail'      // 获取视频详情
  | 'fetch-statistics'  // 获取播放数据
  | 'fetch-comments'    // 采集评论
  | 'clean-comments'    // 清理评论
  | 'analyze-comments'  // LLM分析

export const DOUYIN_COMMENTS_PIPELINE_STEPS = [
  {
    key: 'parse-link',
    label: '解析链接',
    description: '正在解析抖音分享链接'
  },
  {
    key: 'fetch-detail',
    label: '获取视频信息',
    description: '正在获取视频详情'
  },
  {
    key: 'fetch-statistics',
    label: '获取播放数据',
    description: '正在获取播放量、点赞数等'
  },
  {
    key: 'fetch-comments',
    label: '采集评论',
    description: '正在采集评论数据'
  },
  {
    key: 'clean-comments',
    label: '清理评论',
    description: '正在清理评论文本'
  },
  {
    key: 'analyze-comments',
    label: 'LLM分析',
    description: '正在使用AI分析评论'
  }
]
```

### Step 2: 创建评论分析Pipeline

**文件**: `lib/douyin/comments-pipeline.ts`

**核心函数**:
```typescript
export async function runDouyinCommentsPipeline(
  shareLink: string,
  emit: DouyinCommentsPipelineEmitter,
  options: DouyinCommentsPipelineOptions = {}
): Promise<DouyinCommentsPipelineResult>
```

**处理流程**:
1. 解析链接 → 获取videoId
2. 获取视频详情 → 标题、作者、时长
3. 获取播放数据 → 精确播放量、点赞数
4. 采集评论 → 多页分页(100条)
5. 清理评论 → 删除表情、过滤无效内容
6. LLM分析 → 调用Claude API进行智能分析

**SSE事件发送**:
```typescript
emit({ type: 'progress', step: 'fetch-comments', status: 'active', percent: 50 })
emit({ type: 'info', videoInfo: {...} })
emit({ type: 'partial', key: 'analysis', data: chunk })
emit({ type: 'done', markdown: result })
```

### Step 3: 创建API路由

**文件**: `app/api/douyin/analyze-comments/route.ts`

**功能**:
- 接收参数: `{ shareLink: string }`
- 认证检查(NextAuth)
- 调用 `runDouyinCommentsPipeline()`
- 返回SSE流式响应

**响应格式**:
```
event: comments-progress
data: {"type":"progress","step":"fetch-comments",...}

event: comments-info
data: {"type":"info","videoInfo":{...}}

event: comments-done
data: {"type":"done","markdown":"...","analysis":{...}}
```

### Step 4: 扩展链接检测器

**文件**: `lib/douyin/link-detector.ts`

**新增函数**:
```typescript
export function isDouyinCommentsRequest(text: string): boolean {
  // 检测关键词: "分析评论", "评论分析", "查看评论", "评论数据"
  const keywords = ['分析评论', '评论分析', '查看评论', '评论数据', '用户反馈']
  return detectDouyinLink(text) && keywords.some(kw => text.includes(kw))
}
```

### Step 5: 集成到聊天API

**文件**: `app/api/chat/route.ts`

**修改位置**: 在现有抖音检测逻辑后添加

```typescript
// 现有代码: 视频文案提取
if (detectDouyinLink(lastUserMessage.content)) {
  if (isDouyinShareRequest(lastUserMessage.content)) {
    // ... 视频文案提取逻辑
  }
}

// 新增代码: 评论分析
if (detectDouyinLink(lastUserMessage.content)) {
  if (isDouyinCommentsRequest(lastUserMessage.content)) {
    console.info('[Douyin Comments] 检测到评论分析请求')

    const shareLink = extractDouyinLink(lastUserMessage.content)
    // ... 类似视频处理的SSE流式响应
    const result = await runDouyinCommentsPipeline(
      shareLink,
      async (event) => {
        switch (event.type) {
          case 'progress':
            sendEvent('comments-progress', event)
            break
          case 'done':
            sendEvent('comments-done', event)
            break
          // ...
        }
      },
      { signal: request.signal }
    )
  }
}
```

### Step 6: 创建前端Hook

**文件**: `hooks/use-douyin-comments.ts`

**参考**: `hooks/use-douyin-extraction.ts` 的实现

**功能**:
- 发起评论分析请求
- 处理SSE流式响应
- 提供进度状态、部分结果、最终结果
- 支持取消操作(AbortController)

### Step 7: 创建进度展示组件

**文件**: `components/chat/douyin-comments-progress.tsx`

**参考**: `components/chat/douyin-progress.tsx` 的设计

**展示内容**:
- 6步Pipeline进度
- 视频信息卡片
- 实时更新的分析结果预览
- 错误提示

### Step 8: 扩展类型定义

**文件**: `types/chat.ts`

**新增类型**:
```typescript
export interface DouyinCommentsProgressState {
  steps: DouyinCommentsProgressStep[]
  percentage: number
  status: 'running' | 'completed' | 'failed'
  videoInfo?: DouyinVideoInfo
  analysisPreview?: string
}

export interface DouyinCommentsResult {
  markdown: string
  videoInfo: DouyinVideoInfo
  statistics: {
    play_count: number
    digg_count: number
    comment_count: number
  }
  analysis: {
    sentiment: any
    coreTopics: any
    userProfile: any
    suggestions: any
  }
}

// 新增事件类型
export interface ChatEventProtocol {
  // ... 现有事件
  'comments-progress': {...}
  'comments-info': {...}
  'comments-done': {...}
  'comments-error': {...}
}
```

### Step 9: 集成到聊天中心

**文件**: `components/chat/smart-chat-center.tsx`

**修改**: 在 `handleChatEvent` 中添加评论事件处理

```typescript
case 'comments-progress':
  dispatch({
    type: 'UPDATE_COMMENTS_PROGRESS',
    payload: { messageId: event.pendingAssistantId, progress: event }
  })
  break

case 'comments-done':
  dispatch({
    type: 'UPDATE_COMMENTS_DONE',
    payload: { messageId: event.pendingAssistantId, result: event.result }
  })
  break
```

---

## 🎨 用户交互流程

### 触发方式

**方式1: 关键词触发**
```
用户: "分析这个视频的评论 https://v.douyin.com/xxx"
用户: "帮我看看这个视频的用户反馈 [抖音链接]"
```

**方式2: 明确指令**
```
用户: "评论分析 [抖音链接]"
用户: "查看评论数据 [抖音链接]"
```

### 响应流程

1. **检测阶段** (0-5%)
   - 解析链接
   - 显示: "正在解析抖音链接..."

2. **数据采集阶段** (5-50%)
   - 获取视频详情
   - 获取播放数据
   - 采集评论(显示进度: 20/100条)
   - 显示: 视频信息卡片

3. **分析阶段** (50-90%)
   - 清理评论文本
   - 调用LLM分析
   - 实时流式显示分析结果

4. **完成阶段** (90-100%)
   - 显示完整分析报告
   - 格式化Markdown输出

### 输出格式

```markdown
📊 **抖音视频评论分析报告**

**视频信息**
- 标题: xxx
- 作者: xxx
- 播放量: 20,280,809
- 点赞数: 37,151
- 评论数: 1,131 (采集样本: 100条)

---

## 1. 用户情感倾向
- 正面评价: 90.9%
- 中性评价: 9.1%
- 负面评价: 0%
- 情感得分: 4.5/5

## 2. 核心关注点
1. 装修效果和美观性 (高)
2. 价格和预算 (中高)
3. 联系方式和咨询 (中)
...

## 3. 用户画像
**地域分布**
- 安徽: 6条
- 广西: 5条
- 江西: 5条
...

**消费心理**
- 价格敏感
- 注重性价比
- 重视设计美感

## 4. 具体需求
- 80-120㎡户型装修方案
- 性价比高的装修服务
...

## 5. 改进建议
- 增加明确价格区间
- 提供清晰联系方式
...

---
✅ 分析完成! 你可以继续提问。
```

---

## 🔐 安全性考虑

### 1. 认证与权限
- ✅ 使用NextAuth JWT认证
- ✅ 验证conversationId权限
- ✅ 防止越权访问

### 2. 速率限制
- ✅ 复用现有速率限制机制
- ✅ 评论分析API单独限流

### 3. API Key管理
- ✅ 使用 `LLM_API_KEY` 调用Claude
- ✅ 使用 `TIKHUB_API_KEY` 调用TikHub
- ✅ 环境变量保护

### 4. 错误处理
- ✅ Pipeline每一步独立错误捕获
- ✅ 友好的错误提示
- ✅ 支持用户取消操作

---

## 📊 性能优化

### 1. 评论采集
- 分页获取(每页20条)
- 最多5页(100条评论)
- 请求间隔500ms避免限流

### 2. LLM分析
- 使用Claude 3.5 Haiku(高性价比)
- 流式输出(实时显示结果)
- 评论样本限制50条(避免token超限)

### 3. 缓存策略
- 视频详情缓存(避免重复请求)
- 评论数据临时缓存

---

## 🧪 测试策略

### 1. 单元测试
```bash
# 测试Pipeline
npx vitest lib/douyin/comments-pipeline.test.ts

# 测试链接检测
npx vitest lib/douyin/link-detector.test.ts
```

### 2. 集成测试
```bash
# 测试API路由
npx vitest app/api/douyin/analyze-comments/route.test.ts
```

### 3. E2E测试
```bash
# 测试完整流程
npx playwright test e2e/douyin-comments.spec.ts
```

### 4. 手动测试
```bash
# 使用测试脚本
npx tsx tests/manual/test-douyin-comments.ts
```

---

## 📅 开发计划

### Phase 1: 核心功能实现 (预计2小时)
- [ ] 创建Pipeline步骤定义
- [ ] 实现评论分析Pipeline
- [ ] 创建API路由
- [ ] 扩展类型定义

### Phase 2: 前端集成 (预计1小时)
- [ ] 创建Hook
- [ ] 创建进度组件
- [ ] 集成到聊天中心

### Phase 3: 系统集成 (预计30分钟)
- [ ] 扩展链接检测器
- [ ] 集成到聊天API
- [ ] 测试完整流程

### Phase 4: 优化和测试 (预计30分钟)
- [ ] 错误处理优化
- [ ] 性能优化
- [ ] 编写测试用例
- [ ] 文档完善

**总计**: 约4小时

---

## 🚀 部署清单

### 环境变量检查
```bash
✓ TIKHUB_API_KEY         # TikHub API密钥
✓ LLM_API_KEY            # Claude API密钥
✓ LLM_API_BASE           # API基础URL
✓ NEXTAUTH_SECRET        # NextAuth密钥
```

### 依赖检查
```bash
✓ @prisma/client         # 数据库
✓ next-auth              # 认证
✓ @tanstack/react-query  # 状态管理
✓ framer-motion          # 动画
```

### 部署步骤
1. 合并代码到主分支
2. 运行类型检查: `pnpm type-check`
3. 运行测试: `pnpm test:run`
4. 构建生产版本: `pnpm build`
5. 部署到生产环境

---

## 📝 使用文档

### 用户指南

**如何使用评论分析功能?**

1. 在聊天框中发送包含抖音链接的消息
2. 添加关键词如 "分析评论" 或 "查看评论"
3. 等待AI自动分析(约10-30秒)
4. 查看详细的分析报告

**示例**:
```
用户: "分析这个视频的评论 https://v.douyin.com/k5Nc3QsEQH8"
AI: [显示进度] → [显示分析报告]
```

### 开发者指南

**如何调用评论分析API?**

```typescript
const response = await fetch('/api/douyin/analyze-comments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ shareLink: 'https://v.douyin.com/xxx' })
})

// 处理SSE流
const reader = response.body.getReader()
// ... 读取事件流
```

---

## 🔗 相关资源

- TikHub API文档: https://docs.tikhub.io
- Claude API文档: https://docs.anthropic.com
- 项目文档: `CLAUDE.md`
- 测试脚本: `tests/manual/test-douyin-comments.ts`
- 测试报告: `tests/manual/FINAL-TEST-REPORT.md`

---

**创建日期**: 2025-10-20
**最后更新**: 2025-10-20
**版本**: v1.0.0
