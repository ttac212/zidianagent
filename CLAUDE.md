# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**智点AI平台** - Next.js 15 + React 19 + TypeScript 智能对话平台
- **端口**: 3007
- **包管理**: pnpm 9.6.0（必须使用pnpm，不要使用npm/yarn）
- **数据库**: Prisma + SQLite（开发）/ PostgreSQL（生产）
- **AI服务**: 302.AI API代理（支持Claude、Gemini、GPT等模型）

## 常用命令

### 开发环境
```bash
pnpm dev            # 启动开发服务器（Turbopack模式，端口3007）
pnpm build          # 构建生产版本
pnpm lint           # ESLint代码检查
pnpm type-check     # TypeScript类型检查
pnpm check          # 运行lint + type-check + test:run
pnpm deploy:check   # 生产部署前的完整检查
```

### 数据库操作
```bash
pnpm db:generate    # Prisma Client生成（修改schema后必须运行）
pnpm db:push        # 同步schema到数据库（开发环境）
pnpm db:migrate     # 创建并执行迁移（生产环境）
pnpm db:studio      # Prisma Studio可视化管理
```

### 测试
```bash
pnpm test           # Vitest单元测试（watch模式）
pnpm test:run       # 运行所有测试（单次）
pnpm test:e2e       # Playwright E2E测试

# 运行单个测试文件
npx vitest tests/specific-test.test.ts

# 运行特定E2E测试
npx playwright test e2e/chat.spec.ts

# 测试覆盖率
npx vitest --coverage

# E2E测试调试
npx playwright test --debug
npx playwright test --ui  # 交互式UI模式
```

### 用户管理脚本
```bash
# 创建新用户
npx tsx scripts/create-user.ts <email> [displayName] [role] [monthlyTokenLimit]
npx tsx scripts/create-user.ts user@example.com "用户名" USER 200000

# 用户管理
npx tsx scripts/manage-users.ts list                    # 列出所有用户
npx tsx scripts/manage-users.ts get <email>             # 查看用户详情
npx tsx scripts/manage-users.ts update-role <email> ADMIN    # 更新角色
npx tsx scripts/manage-users.ts update-limit <email> 500000  # 更新Token限额
npx tsx scripts/manage-users.ts delete <email>          # 删除用户
```

### 数据维护脚本
```bash
npx tsx scripts/backfill-last-message-at.ts    # 回填历史对话时间戳
npx tsx scripts/diagnose-usage-stats.ts        # 诊断用量统计
npx tsx scripts/project-health-check.js        # 项目健康检查

# 架构优化脚本
npx tsx scripts/fix-useeffect.ts               # 修复useEffect依赖问题
npx tsx scripts/migrate-date-toolkit.ts        # 迁移到新的日期工具库
node scripts/fix-typescript-errors.js          # 修复TypeScript错误
node scripts/cleanup-unused-vars.js            # 清理未使用变量
```

## 核心架构

### 聊天系统架构（事件驱动 + SSE流式处理）
- **SSE流式响应**: 使用原生fetch + ReadableStream实现（`hooks/use-chat-actions.ts`），无第三方依赖
- **事件协议**: `started` → `chunk` → `done`/`error` 事件流，支持精细状态管理
- **上下文管理**: 统一裁剪器（`lib/chat/context-trimmer.ts`），前后端共享规则，防止token超限
- **消息持久化**: 冗余存储userId优化查询，实时统计token使用量
- **虚拟滚动**: 超过100条消息自动启用（`chat-messages-virtual.tsx`），优化长对话性能
- **中止控制**: AbortController管理流式请求，支持用户主动取消

### 认证系统（NextAuth）
- **登录方式**: Credentials Provider，邮箱 + 认证码，支持双模式
  - **开发环境**: 使用 `DEV_LOGIN_CODE`，自动创建不存在的用户（快速开发）
  - **生产环境**: 使用 `ADMIN_LOGIN_PASSWORD`，只允许预先通过脚本添加的用户登录
- **用户管理**: 手动创建用户通过 `scripts/create-user.ts` 和 `scripts/manage-users.ts`
- **会话策略**: JWT策略（无需数据库session表），Token有效期配置灵活
- **权限控制**:
  - 用户角色（USER/ADMIN/GUEST）
  - 月度Token配额管理（默认100k tokens/月）
  - 中间件层级权限验证（`middleware.ts`）

### API Key管理（多模型支持）
- **多Key架构**: 按模型提供商智能选择API Key
  ```typescript
  // Claude模型使用专用Key，其他模型fallback到通用Key
  if (modelId.includes('claude')) {
    apiKey = process.env.LLM_CLAUDE_API_KEY || process.env.LLM_API_KEY
  }
  ```
- **错误恢复**: Key失效时自动fallback到备用Key

### 数据库设计优化
- **Conversation**:
  - 冗余`lastMessageAt`字段，优化对话列表排序查询
  - `metadata` JSON字段存储固定标签、自定义配置等灵活元数据
- **Message**:
  - 冗余`userId`字段，避免JOIN查询配额统计
  - 单独存储`promptTokens`和`completionTokens`精确计费
- **UsageStats**:
  - 按天+模型聚合统计，支持多维度分析
  - `modelProvider`字段区分不同AI提供商
- **关键索引**:
  - `@@index([userId, lastMessageAt(sort: Desc)])` - 对话列表查询优化
  - `@@index([userId, modelId, createdAt])` - 用量统计查询优化
  - `@@unique([userId, date, modelId])` - 确保统计数据唯一性

### 前端架构（React 19 + TypeScript）
- **状态管理**:
  - React Query（TanStack Query v5）管理服务器状态，支持缓存、重试、乐观更新
  - useReducer管理复杂本地状态（聊天组件使用`chat-reducer.ts`）
  - 避免过度使用useState，超过3个状态建议使用reducer
- **组件设计**:
  - shadcn/ui原子组件 + Radix UI底层实现
  - Framer Motion动画效果
  - 严格遵循受控组件模式
- **性能优化**:
  - 虚拟滚动（100+消息触发）
  - 动态导入（React.lazy + Suspense）
  - 图片懒加载
  - 防抖/节流（`use-debounce-throttle.ts`）
- **错误处理**:
  - 统一ErrorBoundary组件
  - Sonner Toast系统
  - API错误统一在`lib/api/error-handler.ts`处理

### React Query缓存管理（重要）
- **查询Key结构**:
  ```typescript
  conversationKeys = {
    all: ['conversations'],
    lists: () => ['conversations', 'list'],
    detail: (id) => ['conversations', 'detail', id]
  }
  // 实际使用: ['conversations', 'list', 'summary', { page, limit }]
  ```
- **Mutation缓存同步**: 使用`predicate`函数匹配所有相关查询，避免Key不匹配
  ```typescript
  queryClient.setQueriesData({
    predicate: (query) => query.queryKey[0] === 'conversations' && query.queryKey[1] === 'list'
  }, updater)
  ```
- **常见陷阱**:
  - ❌ 使用精确匹配 `{ queryKey: ['conversations', 'list'] }` 会漏掉带参数的查询
  - ✅ 使用predicate匹配前缀，确保所有相关缓存都被更新

### 商家数据分析系统
- **多维分析**: 按分类、地区、业务类型（B2B/B2C/B2B2C）统计商家和内容数据
- **内容聚合**: 支持视频、文章、图片、音频等多媒体类型
- **社交指标**: 点赞、评论、收藏、分享数统计和趋势分析
- **标签系统**: JSON存储灵活标签（`tags`字段），支持复杂查询和分析
- **数据源**: 支持抖音等多平台数据采集，通过`dataSource`字段区分
- **导入工具**: `scripts/import-merchant-data.ts`批量导入CSV/Excel数据

### 使用量分析系统（简单实用）
- **架构**: Prisma直接查询 + React Query缓存 + Recharts可视化
- **核心API**: `app/api/users/[id]/model-stats/route.ts`
  - 总体统计（总Token、总请求数、平均每次请求Token）
  - 按模型聚合（Token分布、请求次数、使用占比）
  - 每日趋势数据（最近N天的Token消耗）
- **前端组件**:
  - `hooks/api/use-usage-stats.ts` - React Query hooks
  - `components/analytics/usage-dashboard.tsx` - 可视化仪表板
  - `app/analytics/page.tsx` - 分析页面
- **性能优化**:
  - React Query自动缓存（1分钟staleTime，5分钟自动刷新）
  - Prisma索引优化（`@@index([userId, modelId, createdAt])`）
  - 按天预聚合数据（`UsageStats`表）
- **访问路径**: `http://localhost:3007/analytics`

## 环境配置

### 必需环境变量（.env.local）
```env
# NextAuth配置
NEXTAUTH_URL=http://localhost:3007
NEXTAUTH_SECRET=<使用 openssl rand -hex 32 生成>

# 数据库
DATABASE_URL=file:./prisma/dev.db

# AI API配置（支持多Provider Key）
LLM_API_BASE=https://api.302.ai/v1
LLM_API_KEY=<你的302.AI通用Key>
LLM_CLAUDE_API_KEY=<Claude专用Key（可选）>
LLM_GEMINI_API_KEY=<Gemini专用Key（可选）>

# 模型白名单
MODEL_ALLOWLIST=claude-opus-4-1-20250805,gemini-2.5-pro,claude-3-5-haiku-20241022

# 功能开关
NEXT_PUBLIC_CONNECTION_MONITORING=enabled

# 开发环境配置（可选）
DEV_LOGIN_CODE=dev123  # 开发环境快速登录码

# 生产环境认证
ADMIN_LOGIN_PASSWORD=<生产环境登录密码>

# 分布式限流（可选）
UPSTASH_REDIS_REST_URL=<Upstash Redis REST URL>
UPSTASH_REDIS_REST_TOKEN=<Upstash Redis REST Token>
```

## 关键工作流程

### 首次设置
1. 安装依赖：`pnpm install`
2. 配置环境变量：复制`.env.example`到`.env.local`并填写必需变量
   - 生成NEXTAUTH_SECRET：`openssl rand -hex 32`
   - 配置LLM_API_KEY（302.AI API密钥）
3. 生成Prisma Client：`pnpm db:generate`
4. 同步数据库：`pnpm db:push`
5. （可选）创建管理员账户：`npx tsx scripts/create-user.ts admin@example.com "管理员" ADMIN 1000000`
6. 启动开发服务器：`pnpm dev`
7. 访问登录页面：http://localhost:3007/login
   - 开发环境：任意邮箱 + `DEV_LOGIN_CODE`（默认：dev123456），自动创建用户
   - 生产环境：预先创建的邮箱 + `ADMIN_LOGIN_PASSWORD`

### Prisma开发流程
1. 修改 `prisma/schema.prisma`
2. 运行 `pnpm db:generate` 生成Prisma Client
3. 开发环境: `pnpm db:push` 直接同步
4. 生产环境: `pnpm db:migrate` 创建迁移文件
5. 索引修改后需要运行数据回填脚本（如适用）

### 消息上下文优化
- 修改 `lib/constants/message-limits.ts` 调整token预算
- `trimForChatAPI()` 用于API调用，`trimForDisplay()` 用于界面显示
- 长文本用户配置: API 180k tokens，显示 500k tokens

### 数据库性能监控
- 使用 `scripts/project-health-check.js` 监控数据库健康状态
- 关注对话列表查询性能（依赖 lastMessageAt 索引）
- 使用量统计查询优化（按日期和模型聚合）

### 常见问题排查

#### 删除对话后刷新页面数据恢复
**原因**: React Query缓存Key不匹配
**解决**: Mutation使用`predicate`函数匹配所有相关查询，而不是精确Key匹配
```typescript
// ❌ 错误 - 只更新 ['conversations', 'list']
queryClient.setQueriesData({ queryKey: ['conversations', 'list'] }, updater)

// ✅ 正确 - 匹配所有 list 相关查询
queryClient.setQueriesData({
  predicate: (query) => query.queryKey[0] === 'conversations' && query.queryKey[1] === 'list'
}, updater)
```

#### 401认证错误被默认空数组掩盖
**原因**: useQuery返回值设置了默认值 `const { data = [] } = useQuery()`
**解决**: 移除默认值，在返回边界处理空值
```typescript
// ❌ 错误
const { data: conversations = [] } = useConversationsQuery()

// ✅ 正确
const { data: conversations } = useConversationsQuery()
return { conversations: conversations || [] }
```

#### Invalid Date / RangeError
**原因**: 数据库返回null/undefined的时间戳，直接传给`new Date()`
**解决**: 使用`lib/utils/date-toolkit.ts`的安全转换函数
```typescript
// ❌ 错误
const timestamp = new Date(value).getTime()

// ✅ 正确
import * as dt from '@/lib/utils/date-toolkit'
const timestamp = dt.safeTimestamp(value)
```

### 架构优化和重构工作流程
1. **性能优化脚本**：项目包含多个自动化优化脚本
   - `scripts/fix-useeffect.ts` - 修复useEffect依赖问题
   - `scripts/cleanup-unused-vars.js` - 清理未使用变量
   - `scripts/fix-typescript-errors.js` - 修复TypeScript错误
   - `scripts/migrate-date-toolkit.ts` - 迁移到新的日期工具库

2. **代码质量检查**：
   - `scripts/analyze-useeffect.ts` - 分析useEffect使用情况
   - `scripts/verify-timer-cleanup.js` - 验证定时器清理
   - `scripts/check-unused-ui.js` - 检查未使用的UI组件

3. **架构迁移指南（2025年状态管理优化）**：
   - **聊天状态管理**：新项目使用`UPDATE_MESSAGE_STREAM` action，避免使用废弃的分散action
   - **消息状态跟踪**：使用`ChatMessage.status`字段替代分离的`isLoading`和`previewContent`状态
   - 优先使用`lib/utils/date-toolkit.ts`而不是原生Date方法
   - 使用`lib/api/http-response.ts`构建API响应而不是直接使用NextResponse.json()
   - 新的聊天组件应使用Reducer模式进行状态管理
   - **向后兼容**：保留`SEND_USER_MESSAGE`和`REMOVE_MESSAGE` action用于过渡期

## 核心文件结构

### API路由
- `app/api/chat/route.ts` - SSE流式聊天API，包含权限验证和消息存储
- `app/api/conversations/[id]/route.ts` - 单个对话管理（GET/PATCH/DELETE）
- `app/api/conversations/route.ts` - 对话列表和创建（GET/POST）
- `app/api/users/[id]/model-stats/route.ts` - 用户使用量统计

### 关键Hooks
- `hooks/use-chat-actions.ts` - 聊天消息发送，事件驱动架构，SSE流式处理
- `hooks/api/use-conversations-query.ts` - React Query对话数据获取
- `hooks/api/use-conversation-mutations.ts` - React Query对话增删改mutations
- `hooks/use-chat-state.ts` - 本地聊天状态管理（已废弃，优先使用reducer）

### 核心工具库
- `lib/chat/context-trimmer.ts` - 统一的消息上下文裁剪器
- `lib/ai/key-manager.ts` - 多模型API Key选择策略
- `lib/constants/message-limits.ts` - 消息长度和token配置
- `lib/prisma.ts` - Prisma客户端单例，包含SQLite优化

### 认证和中间件
- `auth.ts` - NextAuth配置，双模式认证（开发/生产）
- `middleware.ts` - 路由保护，token缓存，速率限制
- `app/login/page.tsx` - 登录页面，邮箱+密码表单

### 用户管理脚本
- `scripts/create-user.ts` - 手动创建用户账户
- `scripts/manage-users.ts` - 用户管理工具（列出、查看、更新、删除）

## 架构更新（2025年架构优化）

### 新增工具库和优化组件
- `lib/utils/date-toolkit.ts` - 统一的时间处理工具库，提供防抖函数和时间格式化
- `lib/api/http-response.ts` - 标准化API响应构造器，统一错误处理和分页格式
- `lib/lifecycle-manager.ts` - 全局生命周期管理器，解决内存泄漏问题

### 新增性能优化Hooks
- `hooks/use-debounce-throttle.ts` - 防抖和节流工具，优化用户交互性能
- `hooks/use-chat-events.ts` - 聊天事件处理，简化消息状态管理
- `hooks/use-chat-focus.ts` - 聊天输入框焦点管理
- `hooks/use-chat-keyboard.ts` - 聊天快捷键支持
- `hooks/use-chat-scroll.ts` - 聊天区域滚动控制

### 聊天系统新架构（统一Reducer模式）
- `components/chat/chat-reducer.ts` - 统一的聊天状态管理，使用useReducer替代多个useState
- **新的状态管理模式**：消息状态直接存储在`ChatMessage.status`字段中，替代分离的预览状态
- **统一流式更新**：`UPDATE_MESSAGE_STREAM` action统一处理所有流式消息更新，替代原来的5个分散action
- **消息状态类型**：`pending` | `streaming` | `completed` | `error`，支持直接在消息中跟踪状态
- **性能优化**：减少不必要的重渲染，消除状态重复存储
- **向后兼容**：保留`SEND_USER_MESSAGE`和`REMOVE_MESSAGE` action用于过渡期，新代码应使用新的action类型

### 测试策略
- **单元测试**: Vitest + jsdom环境，覆盖工具函数和业务逻辑
- **E2E测试**: Playwright，支持并发和极限压力测试
- **测试配置**:
  - Vitest排除E2E文件避免冲突：`exclude: ['**/e2e/**', '**/*.spec.ts']`
  - Playwright测试文件使用`.spec.ts`后缀
- **测试最佳实践**:
  - 使用`scripts/test/verify-all-apis.js`验证所有API端点
  - E2E测试使用`globalSetup`创建测试用户
  - 并发测试注意数据隔离（使用唯一ID）

## 重要架构清理说明

### 已移除的遗留组件（2025年架构优化）
项目在架构优化过程中移除了以下过时组件，如果在旧代码中遇到引用错误：

- **邀请码系统**：已完全移除所有相关API路由和组件，改为管理员密码认证
- **MCP集成**：移除了MCP客户端管理器和相关服务器配置
- **连接监控**：移除了复杂的连接状态监控组件，简化为基本的网络状态检测
- **性能监控组件**：移除了过度抽象的性能监控，保留基本的生命周期管理

### 架构决策原则
遵循Linus Torvalds的设计哲学："简单胜过复杂"
- 优先删除而不是重构复杂的抽象层
- 保留向后兼容性，避免破坏用户空间API
- 新功能应当使用最少的抽象层实现

### 架构迁移提示
- 如遇到导入错误，检查文件是否已被移除
- 使用新的工具库（date-toolkit、http-response）替代旧的抽象
- 聊天功能优先使用新的Reducer架构

## 生产部署

### 部署前检查清单
1. 运行完整检查：`pnpm deploy:check`
2. 确保移除所有开发环境配置：
   - 删除`.env.local`中的`DEV_LOGIN_CODE`
   - 设置`NODE_ENV=production`
3. 配置生产数据库：
   - 使用PostgreSQL替代SQLite
   - 运行`pnpm db:migrate`而不是`db:push`
4. 配置环境变量：
   - `NEXTAUTH_URL`使用HTTPS域名
   - `NEXTAUTH_SECRET`使用强随机字符串
   - `ADMIN_LOGIN_PASSWORD`设置管理员密码
5. 预先创建用户账户（使用`scripts/create-user.ts`）
6. 启用监控和日志（可选配置Redis、Sentry等）

### 推荐部署平台
- **Vercel**: Next.js原生支持，自动优化（推荐）
- **Railway**: 支持PostgreSQL一键部署
- **Docker**: 使用项目提供的Dockerfile（如有）
- **传统VPS**: PM2管理进程，Nginx反向代理

### 性能优化建议
- 启用Redis缓存（可选）
- 配置CDN加速静态资源
- 使用Upstash Redis实现分布式限流
- 监控数据库查询性能（使用`scripts/project-health-check.js`）

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.