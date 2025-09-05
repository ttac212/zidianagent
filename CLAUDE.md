# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

智点AI平台 - 基于 Next.js 15 + React 19 + TypeScript 的智能对话平台，采用 App Router 架构，前后端同仓部署。核心功能包括AI聊天、文档管理、商家数据分析、视频内容洞察、连接可靠性监控等。

### 快速参考
- **开发服务器**: `pnpm dev` (端口3007)
- **数据库操作**: `npx prisma studio` (可视化管理)
- **类型检查**: `tsc --noEmit`
- **运行测试**: `pnpm test`
- **构建部署**: `pnpm build:prod` (生产构建)

## 常用开发命令

### 开发环境
```bash
pnpm dev:fast              # Turbopack快速启动 (编译速度19倍，0.75s完成)
pnpm dev                   # 传统webpack启动 (端口3007，支持局域网)
pnpm dev:debug             # 调试模式启动
pnpm build                 # 构建生产版本
pnpm build:prod            # 生产环境构建（完整检查）
pnpm start                 # 启动生产服务器
pnpm lint                  # 代码检查
tsc --noEmit               # TypeScript类型检查
```

### 数据库操作
```bash
pnpm db:generate           # 生成Prisma客户端（修改schema后必须执行）
pnpm db:push               # 开发环境快速同步数据库
pnpm db:studio             # 数据库可视化管理界面
npx prisma migrate dev     # 创建数据库迁移
npx prisma migrate deploy  # 生产环境应用迁移
npx prisma migrate reset   # 重置数据库（危险操作）
pnpm db:seed               # 填充种子数据
```

### 测试
```bash
pnpm test                 # 运行测试（Vitest）
pnpm test:ui              # 测试UI界面
pnpm test:run             # 单次测试运行
pnpm test --coverage      # 测试覆盖率
vitest run <test-file>    # 运行单个测试文件
vitest --reporter=verbose # 详细测试输出
```

### 数据管理
```bash
pnpm import:merchants      # 导入商家数据
pnpm verify:merchants      # 验证商家数据导入
pnpm test:features        # 测试商家功能
```

### 反馈管理
```bash
node update-feedback-status.js list                      # 列出所有反馈
node update-feedback-status.js update <id> <status>     # 更新反馈状态
node update-feedback-status.js batch                    # 批量更新待处理反馈
```

### 邀请码管理
```bash
node scripts/generate-invite-codes.js generate          # 生成20个无限制邀请码
node scripts/generate-invite-codes.js list              # 查看所有邀请码
node scripts/generate-invite-codes.js disable <code>    # 停用指定邀请码
node scripts/generate-invite-codes.js enable <code>     # 激活指定邀请码
node scripts/generate-invite-codes.js delete <code>     # 删除指定邀请码
node scripts/generate-secure-invite-codes.js           # 生成安全邀请码（可选）
```

### 可靠性测试和监控
```bash
node scripts/comprehensive-reliability-test.js         # 运行完整的可靠性测试套件
node scripts/test-server-restart-scenario.js         # 测试服务器重启场景
node scripts/test-connection-monitoring-integration.js # 测试连接监控集成
pnpm test:phase0                                       # 运行Phase 0可靠性测试
pnpm test:phase1                                       # 运行Phase 1可靠性测试
pnpm test:phase2                                       # 运行Phase 2可靠性测试
pnpm test:phase3                                       # 运行Phase 3可靠性测试
pnpm test:full                                         # 运行完整测试套件
pnpm monitor                                           # 运行性能监控
pnpm rollback                                         # 禁用连接监控功能
pnpm rollback:full                                    # 完全回滚连接监控
```

### 安全和部署
```bash
pnpm security:check                # 检查开发环境配置
pnpm security:check:prod           # 检查生产环境配置
pnpm security:clean                # 清理开发配置（强制）
pnpm security:clean:dry            # 清理开发配置（预览）
pnpm pre-deploy                    # 部署前检查
pnpm deploy:validate               # 完整部署验证
pnpm env:validate                  # 验证环境变量配置
pnpm env:toggle                    # 切换环境配置
```

### 项目健康度监控
```bash
pnpm health:check                  # 完整健康度检查（安全、代码质量、性能、依赖、测试）
pnpm health:quick                  # 快速健康检查（跳过耗时项）
pnpm debt:track                    # 技术债务追踪（TODO/FIXME统计）
```

## 核心架构

### 聊天系统架构
聊天功能的核心组件是 `SmartChatCenterV2`，位于 `components/chat/smart-chat-center-v2-fixed.tsx`：

1. **状态管理**: `use-chat-state` hook，基于 `useReducer` 管理复杂聊天状态
2. **消息发送**: `use-chat-actions-fixed` hook 使用纯fetch API实现，避免AI SDK循环依赖
3. **对话管理**: `use-conversations` hook 管理 LocalStorage + API 双重持久化
4. **API端点**: `/api/chat` 代理转发请求到 302.AI，支持SSE流式响应
5. **模型验证**: `lib/model-validator.ts` 确保对话中模型一致性
6. **虚拟滚动**: `components/chat/chat-messages-virtual.tsx` 智能渲染长对话，阈值100条消息
7. **配置管理**: `lib/config/chat-config.ts` 统一管理聊天系统性能参数

### 工作区架构设计
主工作区页面位于 `app/workspace/page.tsx`，采用双栏布局：

1. **对话历史侧边栏**: 统一的对话管理中心
   - 对话列表展示和切换
   - 新建对话功能
   - 标题编辑（双击编辑）
   - 操作菜单：导出对话、复制链接、删除对话
   - 响应式设计：移动端自动折叠

2. **主聊天区域**: 专注于对话交互
   - 简化的聊天头部（仅显示标题和模型信息）
   - 消息列表（支持虚拟滚动优化）
   - 输入区域和设置面板

### 可靠性监控架构
项目实现了全面的连接可靠性监控系统，解决服务器重启后页面无响应问题：

1. **健康检查API** (`app/api/health/route.ts`):
   - 轻量级服务器状态检测
   - 性能监控和响应时间追踪
   - 功能开关支持 (disabled/enabled/debug)

2. **自适应连接监控** (`hooks/use-connection-monitor.ts`):
   - 智能间隔调整: 30s正常 → 10s恢复 → 5s紧急
   - 网络状态监听和自动重连
   - 内存泄漏防护机制

3. **连接状态组件** (`components/ui/connection-status.tsx`):
   - 响应式状态指示器（固定定位: top-20 right-4 z-[45]）
   - 智能tooltip定位（自动上下切换避免遮挡）
   - 扩展tooltip宽度（桌面端max-w-2xl，移动端max-w-sm）
   - 一键恢复功能和友好的错误提示

4. **多页面集成**: 已集成到5个关键页面
   - 设置页面 (详细状态显示)
   - 工作区页面 (自动隐藏模式)
   - 文档管理页面
   - 视频内容洞察页面
   - 主页面

### API路由结构
项目包含35个精心组织的API端点：

```
app/api/
├── auth/              # 认证相关 (signin, signout, session)
├── admin/             # 管理员功能 (stats, users, system)
├── chat/              # 聊天核心API (支持SSE流式响应)
├── conversations/     # 对话管理 (CRUD, export)
├── merchants/         # 商家数据 (list, search, stats)
├── users/             # 用户管理 (profile, usage, settings)
├── documents/         # 文档管理 (upload, parse, delete)
├── feedback/          # 用户反馈系统
├── health/            # 健康检查和监控
└── keyword-data/      # 关键字数据分析
```

### 多KEY架构设计
项目实现了智能的API Key管理系统（`lib/ai/key-manager.ts`）：

1. **精确匹配**: 在KEY_CONFIGS中查找模型专属Key
2. **模糊匹配**: 根据模型名称推断供应商 (如claude-*使用Claude Key)
3. **回退机制**: 使用LLM_API_KEY作为通用Key
4. **模型白名单**: `MODEL_ALLOWLIST` 环境变量控制可用模型
5. **调试工具**: `lib/ai/key-manager.ts`中的 `getModelKeyDebugInfo` 函数

### 数据库设计
使用 Prisma + SQLite/PostgreSQL，核心模型：

#### 用户系统
- `User`: 用户管理，支持角色权限（ADMIN/USER/GUEST）
- `InviteCode`: 邀请码注册系统
- `UserSession`: 会话追踪和活跃状态

#### 聊天系统
- `Conversation`: 聊天会话，包含模型配置
- `Message`: 消息记录，支持多种角色，包含token统计

#### 使用量统计系统
- `UsageStats`: 核心统计表，支持双模式：
  - 总量统计: `modelId="_total"`，汇总用户每日总使用量
  - 按模型统计: `modelId`为具体模型ID，详细记录各模型使用量
  - 唯一约束: `@@unique([userId, date, modelId])`
- 数据流: Message表token → User表累计 → UsageStats表双重记录
- 权限隔离: 每个用户只能访问自己的统计数据
- **重要**: modelId不能为null，使用"_total"标识总量统计

#### 商家数据系统
- `Merchant`: 商家信息管理
- `MerchantContent`: 商家内容（视频、文章、活动）
- `MerchantCategory`: 商家分类系统

#### 视频内容洞察
- 位于 `/inspiration` 页面
- 读取 `keyword_search_aggregated/` 目录下的JSON数据
- 支持多关键字数据切换和评论分析

## 环境配置

### 必需环境变量
```env
NEXTAUTH_URL=http://localhost:3007
NEXTAUTH_SECRET=<强随机字符串>
DATABASE_URL=file:./prisma/dev.db
```

### AI服务配置（多KEY架构）
```env
LLM_API_BASE=https://api.302.ai/v1
MODEL_ALLOWLIST=claude-opus-4-1-20250805,gemini-2.5-pro
LLM_CLAUDE_API_KEY=<Claude专属Key>
LLM_GEMINI_API_KEY=<Gemini专属Key>
LLM_API_KEY=<通用回退Key>
```

### 开发环境登录（生产环境必须删除）
```env
DEV_LOGIN_CODE=<临时登录码>
NEXT_PUBLIC_DEV_LOGIN_CODE=<同上>
```

### 可靠性监控配置
```env
NEXT_PUBLIC_CONNECTION_MONITORING=enabled  # 连接监控功能开关 (enabled/disabled/debug)
```

## 重要文件位置

### 核心配置
- `next.config.mjs`: Next.js配置（忽略构建错误、图片优化、禁用webpack缓存）
- `middleware.ts`: 路由保护和认证中间件
- `auth.ts`: NextAuth配置和认证逻辑
- `prisma/schema.prisma`: 数据库模式定义

### 聊天核心
- `components/chat/smart-chat-center-v2-fixed.tsx`: 主聊天组件
- `components/chat/chat-messages-virtual.tsx`: 虚拟滚动消息列表（100条消息阈值）
- `components/chat/chat-header.tsx`: 聊天头部（简化版，仅显示标题）
- `hooks/use-chat-state.ts`: 聊天状态管理
- `hooks/use-chat-actions-fixed.ts`: 聊天操作逻辑（纯fetch实现）
- `hooks/use-auto-resize-textarea.ts`: 输入框自动调整高度
- `hooks/use-chat-effects.ts`: 聊天副作用管理（滚动、焦点等）
- `app/api/chat/route.ts`: 聊天API端点
- `types/chat.ts`: 聊天相关类型定义
- `lib/config/chat-config.ts`: 聊天系统统一配置
- `app/workspace/page.tsx`: 工作区主页，包含对话管理功能

### 可靠性监控系统
- `app/api/health/route.ts`: 健康检查API端点
- `hooks/use-connection-monitor.ts`: 自适应连接监控Hook
- `components/ui/connection-status.tsx`: 连接状态指示器组件（z-[45]层级，tooltip z-[60]）
- `scripts/comprehensive-reliability-test.js`: 综合可靠性测试脚本
- `scripts/test-server-restart-scenario.js`: 服务器重启场景测试
- `scripts/test-connection-monitoring-integration.js`: 连接监控集成测试

### AI配置
- `lib/ai/models.ts`: 模型配置和白名单
- `lib/ai/key-manager.ts`: 多KEY管理器
- `lib/ai/message-processor.ts`: 消息处理逻辑
- `lib/model-validator.ts`: 模型一致性验证器

### 数据分析
- `app/api/keyword-data/route.ts`: 关键字数据API
- `app/inspiration/page.tsx`: 视频内容洞察页面
- `keyword_search_aggregated/`: 关键字数据存储目录
- `scripts/import-merchant-data.ts`: 商家数据导入脚本

## 开发注意事项

### 编译性能优化
- **Turbopack**: 使用`pnpm dev:fast`启动，编译速度提升19倍 (0.75s vs 14.6s)
- **文件系统缓存**: 二次启动更快
- **代码分包**: radix-ui、three、gsap独立打包优化加载
- **内存配置**: NODE_OPTIONS="--max-old-space-size=8192"

### Z-Index层级规范
```
z-[100]: Toast全局通知
z-[60]:  Tooltip和弹出层
z-50:    Header、Modal对话框
z-[45]:  ConnectionStatus组件、固定状态指示器
z-40:    一般固定元素
z-30:    侧边栏
z-20:    移动端遮罩层
z-10:    背景层
```

### 数据库开发
- 修改schema后必须运行 `npx prisma generate` 更新客户端
- 开发环境使用 `npx prisma db push` 快速同步
- 生产环境必须使用 `npx prisma migrate deploy`
- 使用CUID作为主键，确保唯一性
- **使用量统计约束**: UsageStats表使用 `@@unique([userId, date, modelId])` 约束，支持总量统计(`modelId="_total"`)和按模型统计

### API开发
- 新API路由放在 `app/api/` 下
- 使用 `lib/ai/models.ts` 进行模型白名单验证
- 使用 `lib/ai/key-manager.ts` 进行多KEY管理
- API Key仅在服务端使用，不能暴露到客户端

### 聊天功能开发
- 修改聊天功能时，重点关注：
  - `types/chat.ts` 中的类型定义
  - `use-chat-state.ts` 中的状态reducer
  - SSE流处理逻辑在 `use-chat-actions-fixed.ts`
  - 模型一致性检查在 `lib/model-validator.ts`
  - **虚拟滚动配置**: `lib/config/chat-config.ts` 中的 `VIRTUAL_SCROLL_CONFIG`
- **使用量记录流程**: 聊天API通过SSE流提取token使用量 → 保存到Message表 → 更新User总量 → 双重upsert到UsageStats表（总量+按模型）
- **关键函数**: `saveAssistantMessage()` 负责异步保存AI响应和统计更新
- **性能优化**: 长对话（>100条消息）自动启用虚拟滚动，估计项高度120px，缓冲区5项

### 组件开发
- 新UI组件优先使用 Radix UI 封装
- 业务组件放在对应功能目录
- 使用 `@/*` 路径别名导入
- 遵循现有的props接口和命名约定
- **重要**: 避免按钮嵌套（`<button>` 不能包含 `<button>`），使用 `div` + 事件处理替代

### 性能优化
- 大型组件使用动态导入
- 使用 `memo` 和 `useMemo` 优化重渲染
- 开发环境禁用webpack持久缓存（Windows兼容性）

### 安全考虑
- 生产环境必须移除 DEV_LOGIN_CODE 配置
- 确保 NEXTAUTH_SECRET 使用强随机字符串
- 多KEY架构降低单点Key泄露风险
- 模型白名单机制防止恶意模型调用

## 项目特色功能

### 商家数据分析
- 完整的商家管理系统，支持分类、评分、内容管理
- 数据导入工具链 (`pnpm import:merchants`)
- 多维度搜索和筛选功能

### 视频内容洞察
- 支持抖音等平台视频数据分析
- 评论热点自动提取和分析
- 高频词汇统计和用户问题识别
- 支持多关键字数据文件切换

### 动画和交互
- Framer Motion 实现流畅动画
- GSAP 动画库集成
- 自定义动画组件 (AnimatedGradientBackgroundDynamic, AnimatedLogoOptimized)

## 调试和诊断工具

### 数据库诊断
```bash
node scripts/db-check.js                    # 检查数据库连接和基础结构
node scripts/db-integrity-check.ts         # 完整性检查
node scripts/check-data.ts                 # 检查数据一致性
```

### AI服务调试
```bash
node scripts/test-models.js                # 测试模型可用性
node scripts/test-multi-key.js            # 测试多KEY配置
node scripts/verify-model-consistency.js  # 验证模型一致性
node test-usage-recording.js              # 检查使用量记录机制
node debug-recent-usage.js                # 调试最近对话的使用量问题
node final-usage-verification.js          # 完整验证使用量流程
```

### 商家数据验证
```bash
node scripts/comprehensive-test.js        # 综合功能测试
npx tsx scripts/check-tags-format.ts     # 检查标签格式
```

## 常见问题排查

### 开发环境
- Windows环境需禁用webpack持久缓存（已配置）
- 端口冲突：修改package.json中的 --port 参数
- 数据库连接失败：检查DATABASE_URL配置

### AI服务问题
- 模型白名单检查：确保 MODEL_ALLOWLIST 包含所需模型
- API Key调试：使用 `getModelKeyDebugInfo` 函数诊断
- 302.AI代理问题：检查 LLM_API_BASE 配置

### 使用量统计问题
- **settings页面无法显示模型用量**: 检查UsageStats表是否有`modelId`非空的记录
- **数据库约束错误**: 确保使用统一的`userId_date_modelId`约束进行upsert操作
- **token统计不一致**: 使用调试脚本验证Message表与UsageStats表数据一致性
- **新对话后无统计**: 检查聊天API中的`saveAssistantMessage`函数是否正确执行

### 连接状态组件问题
- **被Header遮挡**: 确保使用 `top-20` 而非 `top-4` 定位
- **Tooltip被遮挡**: 检查z-index层级，tooltip应为 `z-[60]`
- **多个状态指示器冲突**: 将冲突的组件移至不同位置（如left-4）

### 部署注意
- PostgreSQL推荐用于生产环境
- 生产环境使用环境变量管理敏感信息
- 确保所有API Key正确配置

## 疑难问题快速诊断

### 使用量统计显示异常
```bash
# 完整诊断流程
node debug-recent-usage.js              # 1. 检查最近对话和统计状态
node test-usage-recording.js           # 2. 验证数据库记录结构
node final-usage-verification.js       # 3. 完整流程验证

# 常见修复方法
npx prisma db push                      # 应用schema变更
npx prisma generate                     # 重新生成客户端
```

### 数据库约束冲突
- 症状: `Unique constraint failed on (userId,date)` 或 `Argument modelId must not be null`
- 原因: UsageStats表约束不允许modelId为null
- 解决: 确保所有upsert操作使用`userId_date_modelId`约束，总量统计设置`modelId="_total"`

### settings页面无法显示模型分布
- 检查: `SELECT * FROM usage_stats WHERE modelId != '_total'`
- 确认: `/api/users/[id]/model-stats` API是否返回正确数据
- 验证: 用户权限和身份认证是否正常

# 重要开发原则
- 优先编辑现有文件而非创建新文件
- 使用中文与用户沟通
- 始终遵循现有的代码规范和架构模式
- 修改代码前必须先理解现有实现逻辑
- 保持向后兼容性，避免破坏性变更

# 性能考量
- 使用Turbopack可大幅提升编译速度（0.75s vs 14.6s）
- webpack已切换为文件系统缓存（更适合Windows环境）
- NextAuth调试模式已关闭以避免客户端错误
- 所有动画和交互已进行响应式优化

# 最新修复记录
- ✅ **长对话显示性能优化** (2025-09-04)：
  - 虚拟滚动阈值从50条提升到100条，减少不必要的性能开销
  - 优化消息项高度估算算法，提高滚动精度
  - 完善边界值验证和配置管理系统
  - 新增统一的聊天配置文件 `lib/config/chat-config.ts`
  - 改进自动滚动逻辑和新消息标记机制
- ✅ **连接状态组件z-index优化** (2025-08-31)：
  - 统一所有页面使用 `z-[45]` 层级
  - Tooltip提升至 `z-[60]` 避免遮挡
  - 智能tooltip定位，自动上下切换
  - 扩展tooltip宽度至2倍（桌面端max-w-2xl）
  - 修复workspace等页面被Header遮挡问题（top-4改为top-20）
- ✅ **编译性能优化** (2025-08-31)：
  - 集成Turbopack编译器，编译速度提升19倍
  - webpack配置优化：文件系统缓存、智能分包
  - 内存从4GB提升到8GB，优化TypeScript监听
- ✅ **可靠性监控系统完成** (2025-08-31)：
  - 实现了完整的连接监控架构，解决服务器重启后页面无响应问题
  - 智能自适应监控间隔：30s正常状态，10s恢复状态，5s紧急状态
  - 5个关键页面100%覆盖：settings、workspace、documents、inspiration、主页
  - 健康检查API平均响应时间142ms，远优于500ms目标
  - 综合测试100%通过：45/45请求成功，服务器重启10秒内检测恢复
  - 性能优化：内存增长仅1.6MB，CPU增长0.7%，远低于目标阈值
- ✅ NextAuth JSON解析错误已修复（关闭debug模式，添加错误页面配置）
- ✅ 用户菜单加载状态优化（避免在loading期间渲染）
- ✅ 按钮微交互和聊天输入体验已全面优化
- ✅ AI思考状态可视化已实现多阶段动画系统
- ✅ UsageStats约束错误已修复（modelId从null改为"_total"标识总量统计）
- ✅ API稳定性大幅提升（2024-08-30）：
  - 实现自动重试机制，网络故障自动恢复
  - 添加请求超时控制，防止无限等待
  - 集成API性能监控，实时追踪错误率
  - 优化错误提示，用户体验更友好
  - 修复数据库modelId不一致问题

# 快速调试命令
```bash
node scripts/test-models.js                # 测试模型可用性
node scripts/test-multi-key.js            # 测试多KEY配置
node scripts/db-check.js                  # 检查数据库连接
node debug-recent-usage.js                # 调试使用量统计
```