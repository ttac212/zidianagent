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
```

### 常用脚本
```bash
npx tsx scripts/backfill-last-message-at.ts    # 回填历史对话时间戳
npx tsx scripts/diagnose-usage-stats.ts        # 诊断用量统计
npx tsx scripts/project-health-check.js        # 项目健康检查
```

## 核心架构

### 聊天系统架构（事件驱动 + SSE流式处理）
- **SSE流式响应**: 使用原生fetch实现（`hooks/use-chat-actions.ts`），无第三方依赖
- **事件协议**: `started` → `chunk` → `done`/`error` 事件流，支持状态管理
- **上下文管理**: 统一裁剪器（`lib/chat/context-trimmer.ts`），前后端共享规则
- **消息持久化**: 冗余存储用户ID优化查询，支持token使用统计
- **虚拟滚动**: 超过100条消息自动启用，优化长对话性能

### 认证系统（NextAuth + 邀请码）
- **开发环境**: 支持开发登录码，快速调试
- **生产环境**: 严格邀请码验证，支持使用次数限制和过期时间
- **中间件缓存**: Token缓存5分钟，减少数据库查询
- **权限控制**: 用户角色和月度Token配额管理

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
- **Conversation**: 冗余lastMessageAt字段，优化排序查询
- **Message**: 冗余userId字段，避免JOIN查询配额统计
- **UsageStats**: 按天聚合，支持按模型分类统计
- **关键索引**: `@@index([userId, lastMessageAt(sort: Desc)])` 优化对话列表

### 前端架构（React 19 + TypeScript）
- **状态管理**: React Query（服务器状态）+ useReducer（复杂本地状态）
- **组件设计**: shadcn/ui原子组件，Radix UI底层实现
- **性能优化**: 虚拟滚动、动态导入、图片懒加载
- **错误边界**: 统一ErrorBoundary + Sonner Toast系统

### 商家数据分析系统
- **多维分析**: 按分类、地区、业务类型统计商家和内容数据
- **内容聚合**: 支持视频、文章、图片等多媒体类型
- **社交指标**: 点赞、评论、收藏、分享数统计和趋势分析
- **标签系统**: JSON存储灵活标签，支持复杂查询和分析

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
```

## 关键工作流程

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

## 核心文件结构

### API路由
- `app/api/chat/route.ts` - SSE流式聊天API，包含权限验证和消息存储
- `app/api/conversations/[id]/route.ts` - 单个对话管理
- `app/api/users/[id]/model-stats/route.ts` - 用户使用量统计

### 关键Hooks
- `hooks/use-chat-actions.ts` - 聊天消息发送，事件驱动架构
- `hooks/use-conversations.ts` - React Query对话状态管理
- `hooks/use-chat-state.ts` - 本地聊天状态管理

### 核心工具库
- `lib/chat/context-trimmer.ts` - 统一的消息上下文裁剪器
- `lib/ai/key-manager.ts` - 多模型API Key选择策略
- `lib/constants/message-limits.ts` - 消息长度和token配置
- `lib/prisma.ts` - Prisma客户端单例，包含SQLite优化

### 认证和中间件
- `auth.ts` - NextAuth配置，邀请码验证
- `middleware.ts` - 路由保护，token缓存，速率限制