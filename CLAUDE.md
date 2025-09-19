# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

智点AI平台 - 基于 Next.js 15 + React 19 + TypeScript 的智能对话平台，采用 App Router 架构。核心功能包括AI聊天、文档管理、商家数据分析、视频内容洞察、连接可靠性监控等。

**应用端口**: 3007（开发和生产环境）  
**包管理器**: pnpm 9.6.0（必须使用pnpm，不要使用npm/yarn）  
**Node版本**: 22.17.2+  
**TypeScript**: 严格模式启用

## 常用开发命令

### 开发与构建
```bash
pnpm dev:fast              # ⚡ Turbopack开发服务器 (推荐 - 修复热加载问题)
pnpm dev                   # ⚠️ Webpack开发服务器 (存在API路由编译错误)
pnpm dev:debug             # 调试模式（Node.js inspector）
pnpm build                 # 构建生产版本
pnpm build:safe            # 安全构建（含验证）
pnpm build:prod            # 生产构建（含安全检查）
pnpm start                 # 启动生产服务器
pnpm lint                  # ESLint检查
tsc --noEmit               # TypeScript类型检查

# 安全与部署
pnpm security:check        # 安全检查
pnpm security:check:prod   # 生产安全检查
pnpm pre-deploy            # 部署前验证
pnpm deploy:validate       # 部署验证（security + pre-deploy）
```

### 数据库操作
```bash
pnpm db:generate           # 生成Prisma客户端（修改schema后必须执行）
pnpm db:push               # 快速同步数据库（开发环境）
pnpm db:seed               # 运行数据库种子
pnpm db:studio             # Prisma Studio可视化管理
npx prisma migrate dev     # 创建迁移
npx prisma migrate deploy  # 应用迁移（生产环境）
```

### 测试
```bash
# 单元测试（Vitest）
pnpm test                  # 运行测试（watch模式）
pnpm test:run              # 单次运行所有测试
vitest run <file>          # 运行单个测试文件
pnpm test:ui               # 测试UI界面

# 端到端测试（Playwright）
pnpm test:e2e              # 基础E2E测试
pnpm test:e2e:ui           # 交互式测试界面
pnpm test:e2e:debug        # 调试模式
pnpm test:e2e:codegen      # 生成测试代码
pnpm test:e2e:report       # 查看测试报告
pnpm test:e2e:concurrent   # 高并发测试（8workers）
pnpm test:e2e:stress       # 压力测试（12workers）
pnpm test:e2e:extreme      # 极限测试（300并发）
pnpm test:e2e:basic        # 单线程基础测试

# 分阶段测试
pnpm test:phase0           # 阶段0：基础检查
pnpm test:phase1           # 阶段1：单元测试
pnpm test:phase2           # 阶段2：集成测试
pnpm test:phase3           # 阶段3：E2E测试
pnpm test:full             # 运行全部测试阶段
```

### 诊断与调试
```bash
pnpm health:check          # 完整健康检查
pnpm health:quick          # 快速健康检查
pnpm debt:track            # 技术债务追踪
node scripts/diagnose-health-api.js  # 诊断健康API问题
node scripts/diagnose-usage-stats.ts # 检查使用量统计问题
pnpm monitor               # 性能监控

# 环境配置
pnpm env:validate          # 验证环境变量
pnpm env:toggle            # 切换环境配置
```

### 数据备份
```bash
pnpm backup:db             # 备份数据库
pnpm backup:full           # 完整备份（含压缩）
pnpm backup:schema         # 仅备份schema
pnpm backup:auto           # 自动备份调度器
pnpm backup:test           # 测试备份功能
pnpm restore:db            # 恢复数据库
pnpm restore:help          # 恢复帮助文档
```

### 商家数据管理
```bash
pnpm import:merchants      # 导入商家数据
pnpm verify:merchants      # 验证导入结果
pnpm test:features         # 测试商家功能
```

## 核心架构

### 认证与安全
- **NextAuth**: 基于JWT的认证系统
- **邀请码系统**: 支持使用限制、有效期、权限配置
- **速率限制**: 多层级限制（用户/IP/API端点）
- **内容过滤**: 消息内容安全验证

### 聊天系统
核心组件位于 `components/chat/smart-chat-center-v2-fixed.tsx`：

- **状态管理**: `hooks/use-chat-state.ts` - useReducer管理聊天状态
- **消息发送**: `hooks/use-chat-actions-fixed.ts` - 纯fetch实现SSE流（不使用AI SDK）
- **对话管理**: `stores/conversation-store.ts` - Zustand统一状态管理
- **虚拟滚动**: 100条消息阈值，自动启用优化渲染
- **时间轴导航**: `components/chat/timeline-scrollbar.tsx` - 混合时间/结构定位算法
- **API端点**: `/api/chat` - 代理302.AI请求，支持流式响应

### API路由结构
```
app/api/
├── auth/          # 认证系统（NextAuth）
├── chat/          # 聊天核心（SSE流式响应）
├── conversations/ # 对话管理CRUD
├── health/        # 健康检查（增强诊断）
├── users/         # 用户和使用量统计
├── merchants/     # 商家数据分析
└── model-stats/   # 模型使用统计
```

### 多KEY架构
`lib/ai/key-manager.ts` 实现智能Key管理：
1. 模型专属Key匹配（LLM_CLAUDE_API_KEY等）
2. 供应商推断（claude-* → Claude Key）
3. 通用Key回退机制（LLM_API_KEY）

### 数据库模型（Prisma）
- **User**: 用户管理，角色权限，邀请码关联
- **InviteCode**: 邀请码系统，使用限制和权限配置
- **Conversation/Message**: 聊天记录，token统计
- **UsageStats**: 使用量统计（双模式：总量/_total + 按模型）
- **Merchant/MerchantContent**: 商家数据和内容管理
- **Document**: 文档管理，支持外部资源

## 环境配置

### 必需环境变量
```env
NEXTAUTH_URL=http://localhost:3007
NEXTAUTH_SECRET=<强随机字符串，至少32字符>
DATABASE_URL=file:./prisma/dev.db
NEXT_PUBLIC_CONNECTION_MONITORING=enabled
```

### AI服务配置
```env
LLM_API_BASE=https://api.302.ai/v1
LLM_API_KEY=<通用Key>
MODEL_ALLOWLIST=claude-opus-4-1-20250805,gemini-2.5-pro
```

### 多KEY配置（可选）
```env
LLM_CLAUDE_API_KEY=<Claude专用Key>
LLM_GEMINI_API_KEY=<Gemini专用Key>
LLM_OPENAI_API_KEY=<OpenAI专用Key>
```

## 开发注意事项

### ⚠️ 已知问题：Webpack模式热加载
**问题**: 标准 `pnpm dev` 存在API路由编译错误：
```
⨯ [Error: ENOENT: no such file or directory, open '.next\server\app\api\health\route.js']
```
**解决方案**: 使用Turbopack模式 `pnpm dev:fast` 可完全修复此问题

### 性能优化
- 使用`pnpm dev:fast`启动Turbopack（编译速度0.75s vs 14.6s）
- 长对话>100条消息自动启用虚拟滚动
- webpack已配置内存缓存（开发环境优化）
- 生产环境自动清理console（保留error/warn）

### Z-Index层级（已优化）
```
z-[100]: Toast通知
z-[60]:  Tooltip弹出层（全局）
z-50:    Modal对话框 + Header组件
z-[45]:  ConnectionStatus组件
z-[35]:  时间轴切换按钮
z-[25]:  时间轴激活圆点
z-20:    侧边栏
z-[15]:  移动端遮罩层 + 时间轴圆点悬停
z-10:    基础交互元素
```

### 项目结构
```
app/
├── api/              # API路由（Next.js App Router）
│   ├── auth/         # NextAuth认证
│   ├── chat/         # 聊天核心功能
│   ├── conversations/# 对话管理
│   └── merchants/    # 商家数据分析
components/
├── chat/             # 聊天组件
├── ui/               # 通用UI组件（Radix UI）
└── workspace/        # 工作区组件
e2e/                  # Playwright端到端测试
├── global-setup.ts   # 测试全局设置
└── *.spec.ts         # 测试规范文件
hooks/
├── use-chat-*.ts     # 聊天相关hooks
├── use-model-*.ts    # 模型状态管理
└── use-connection-*.ts # 连接监控
lib/
├── ai/               # AI服务集成
├── mcp/              # Model Context Protocol
├── monitoring/       # 性能监控
└── security/         # 安全相关
prisma/
├── schema.prisma     # 数据库模式
└── dev.db           # SQLite开发数据库
scripts/
├── test/            # 测试脚本
├── deploy/          # 部署脚本
└── diagnose-*.js    # 诊断工具
tests/               # Vitest单元测试
```

### 数据库开发流程
1. 修改 `prisma/schema.prisma`
2. 运行 `pnpm db:generate` 生成客户端（必须）
3. 开发环境用 `pnpm db:push` 快速同步
4. 生产环境用 `npx prisma migrate dev` 创建迁移
5. 测试前运行 `npx prisma db push` 确保同步

### E2E测试配置
- **测试目录**: `e2e/` - Playwright端到端测试
- **并发配置**: 支持1-300并发worker（通过CONCURRENT_WORKERS环境变量）
- **测试模式**: 基础/并发/压力/极限四种模式
- **全局设置**: `e2e/global-setup.ts` - 测试前准备
- **报告输出**: HTML + JSON格式，位于`test-results/`

### 聊天功能实现
- **SSE流处理**: `hooks/use-chat-actions-fixed.ts` - 纯fetch实现，不依赖AI SDK
- **虚拟滚动**: `lib/config/chat-config.ts` - 100条消息自动启用
- **使用量记录**: Message → User → UsageStats双重更新
- **模型选择**: `hooks/use-model-state.ts` - 支持动态切换
- **状态管理**: `stores/conversation-store.ts` - Zustand统一管理

### 测试策略
- **单元测试**: `tests/` 目录，使用Vitest
- **端到端测试**: `e2e/` 目录，使用Playwright，支持300并发极限压力测试
- **API测试**: `scripts/test/verify-all-apis.js`
- **性能测试**: `scripts/test/test-api-performance.js`
- **健康检查**: `scripts/test/test-health-api.js`
- **分阶段测试**: `pnpm test:phase0-3` 自动化测试流水线

### 关键技术栈
- **前端**: Next.js 15 + React 19 + TypeScript
- **UI组件**: Radix UI + Tailwind CSS v4 + Framer Motion
- **状态管理**: React Hooks (useReducer + Context) + Zustand
- **数据库**: Prisma + SQLite (开发) / PostgreSQL (生产推荐)
- **认证**: NextAuth v4
- **AI集成**: 302.AI API代理，支持Claude/Gemini/OpenAI
- **测试**: Vitest + Testing Library + Playwright（支持极限并发测试）
- **包管理**: pnpm 9.6.0
- **TypeScript配置**: 严格模式，路径别名 `@/*`

## 常见问题排查

### 健康检查503错误
```bash
node scripts/diagnose-health-api.js  # 诊断问题
# 确保 NEXT_PUBLIC_CONNECTION_MONITORING=enabled
```

### 使用量统计异常
```bash
node scripts/diagnose-usage-stats.ts  # 检查统计问题
npx prisma db push                    # 同步schema
```

### 数据库问题
```bash
node scripts/db-integrity-check.ts    # 检查数据完整性
pnpm backup:db                        # 备份当前数据
pnpm restore:db                       # 恢复数据库
```

### 调试技巧
```bash
pnpm dev:debug                        # 启用Node.js调试（端口9229）
# Chrome DevTools: chrome://inspect
```

## 脚本目录结构
- **测试脚本**: `scripts/test/` - 各类测试脚本
- **数据库脚本**: `scripts/db/` - 备份恢复工具
- **部署脚本**: `scripts/deploy/` - 部署前检查
- **诊断工具**: `scripts/diagnose-*.js` - 问题诊断

## 安全注意事项

### 生产部署前必须
```bash
pnpm security:check:prod   # 安全检查
pnpm pre-deploy           # 部署前验证
pnpm build:prod           # 生产构建
```

### 生产环境必须删除的配置
- DEV_LOGIN_CODE
- NEXT_PUBLIC_DEV_LOGIN_CODE
- 所有DEBUG相关配置

### 邀请码管理
```bash
node scripts/generate-secure-invite-codes.js  # 生成安全邀请码
node scripts/check-invite-codes.js           # 检查邀请码状态
```

## Git检查点

- `v20250911-optimization`: 优化前版本
- `v20250911-optimized`: 优化后版本
- `feature/2025-09-09`: 当前开发分支

回滚命令：
```bash
git checkout v20250911-optimization  # 完全回滚
git checkout v20250911-optimization -- [文件路径]  # 恢复特定文件
```

## 工作流注意事项

### 开发流程
1. **启动开发服务器**: 始终使用 `pnpm dev:fast`（Turbopack模式）
2. **数据库修改**: 修改schema后必须执行 `pnpm db:generate`
3. **类型检查**: 提交前运行 `tsc --noEmit` 确保类型正确
4. **测试运行**: 单个测试文件使用 `vitest run <file>`

### 代码提交前检查
```bash
pnpm lint                  # ESLint检查
tsc --noEmit              # TypeScript类型检查
pnpm test:run             # 运行所有测试
pnpm security:check        # 安全检查（生产前必须）
```

### 环境变量最小配置（开发）
```env
NEXTAUTH_URL=http://localhost:3007
NEXTAUTH_SECRET=<32字符以上随机字符串，使用 openssl rand -hex 32 生成>
DATABASE_URL=file:./prisma/dev.db
LLM_API_BASE=https://api.302.ai/v1
LLM_API_KEY=<你的302.AI API Key>
NEXT_PUBLIC_CONNECTION_MONITORING=enabled
NEXT_PUBLIC_APP_NAME=支点有星辰
```

详细配置参见 `.env.example` 文件

## 重要提示

### API路由编译问题
使用 `pnpm dev:fast`（Turbopack）避免Webpack模式下的API路由编译错误。

### 聊天功能注意
- 使用纯fetch实现SSE流，不依赖AI SDK
- 消息发送hook: `use-chat-actions-fixed.ts`（已修复版本）
- 避免使用废弃的 `use-chat-actions.ts`

### 状态管理
- 优先使用Zustand store (`stores/conversation-store.ts`)
- 避免在多个地方管理相同状态