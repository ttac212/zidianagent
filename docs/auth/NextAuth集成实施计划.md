# NextAuth 集成实施计划（方案A：完全切换，淘汰 AuthContext/localStorage）

本计划用于在没有对话上下文的情况下，任何开发者都能独立完成 NextAuth 集成和迁移工作。采用临时 Credentials（开发期）+ Prisma Adapter + Database Session + Middleware 路由保护的组合方案，并为将来迁移到 Email Magic Link/OAuth 预留空间。

---

## 一、完整技术方案

### 1. NextAuth 配置
- 依赖：
  - next-auth
  - @auth/prisma-adapter
- 文件与导出：创建根级 `auth.ts`，导出 `{ auth, signIn, signOut, handlers }`（App Router建议做法）。
- Providers：
  - CredentialsProvider（仅开发环境启用）
    - 登录参数：`email` + `code`
    - authorize：
      - 要求 `code === process.env.DEV_LOGIN_CODE`
      - 通过 Prisma 查找用户（email），找到则返回用户对象，否则拒绝
- Session 策略：
  - `strategy: 'database'`（使用 Session 表）或 `strategy: 'jwt'`（均可，本计划选 database，便于失效控制）
- Callbacks：
  - `session`: 将必要的用户字段注入到 `session.user`（例如 `id`, `role`, `displayName`, `currentMonthUsage`, `monthlyTokenLimit`），避免前端额外请求
  - `signIn`: 可做额外约束（例如用户状态）

### 2. Prisma 迁移
- 新增 NextAuth 所需模型（参考官方）：
  - `Account`, `Session`, `VerificationToken`
  - 为 `User` 增加 `emailVerified DateTime?`（兼容未来 Email 登录）
- 保留现有 User/InviteCode/Conversation/Message/UsageStats 等模型不变
- 执行 `npx prisma migrate dev -n add_nextauth_models` 和 `npx prisma generate`

### 3. Middleware 路由保护
- 新建 `middleware.ts`：
  - 使用 `auth()` 读取会话；未认证访问受保护路径则重定向至 `/`
  - 管理路径（`/admin`, `/api/admin/**`）校验 `session.user.role === 'ADMIN'`，否则 403/重定向
- 保护范围：
  - 受保护：`/workspace/:path*`, `/admin/:path*`, `/api/chat`, `/api/users/:path*`, `/api/admin/:path*`
  - 放行：`/`, `/_next/**`, 静态资源, `/api/invite-codes/**`

### 4. API 改造
- `app/api/chat/route.ts`：
  - 使用 `const session = await auth()`
  - 无 session -> 401
  - `userId = session.user.id`；禁止信任 body.userId
  - conversation 权限校验使用 `userId`
- `app/api/admin/**`、`app/api/users/**`：
  - 同样使用 session；必要时校验 `role === 'ADMIN'`

### 5. 客户端接入
- 在 `app/layout.tsx` 顶层包裹 `<SessionProvider>`（来自 `next-auth/react`）
- 删除 `contexts/auth-context.tsx` 以及所有 `useAuth()` 使用点
- 迁移组件：
  - `components/auth/invite-code-auth.tsx`
    - verify 阶段不变（/api/invite-codes/verify）
    - register 成功后：调用 `await signIn('credentials', { email, code: DEV_LOGIN_CODE, redirect: false })`，成功后跳转 `/workspace`
  - `components/auth/user-menu.tsx`
    - 使用 `useSession()` 替代 `useAuth()`
    - 使用 `signOut()` 替代 `logout()`
  - `components/auth/auth-guard.tsx`
    - 可删除（优先依赖 middleware 做服务端保护）
    - 如需保留前端防闪烁，可改成 `useSession()` 判定

### 6. 环境变量
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DEV_LOGIN_CODE`（仅开发环境使用）
  - 在 Credentials authorize 中校验
  - 生产环境禁用该 Provider 或清空该变量

---

## 二、实施步骤（分阶段）

### 阶段一：框架与基础设施（Day 1）
1) 安装依赖：`pnpm add next-auth @auth/prisma-adapter`
2) 新建 `auth.ts`：配置 Credentials Provider（dev-only）、Prisma Adapter、session 回调（注入 user 字段）
3) Prisma 模型：为 NextAuth 添加 `Account`, `Session`, `VerificationToken`，为 `User` 加 `emailVerified?`
4) 迁移与生成：`npx prisma migrate dev -n add_nextauth_models`、`npx prisma generate`
5) 新建 `middleware.ts`：实现受保护与管理员路径逻辑
6) 在 `app/layout.tsx` 包裹 `<SessionProvider>`（不改变业务功能）

预期结果：
- 应用具备最小可用的会话与路由保护框架；尚未改造业务 API 与组件

### 阶段二：API 加固与页面接入（Day 2）
1) 改造 `app/api/chat/route.ts`，使用 `auth()` 获取 userId，移除对 body.userId 的信任
2) 加固 `/api/users/**`、`/api/admin/**` 的鉴权与角色校验
3) 删除 `contexts/auth-context.tsx`，替换所有 `useAuth()` 调用
4) 重构 `components/auth/invite-code-auth.tsx`：注册成功后 `signIn('credentials', ...)` -> 跳转 `/workspace`
5) 重构 `components/auth/user-menu.tsx`：使用 `useSession()/signOut()`
6) 评估并移除 `components/auth/auth-guard.tsx`（或以 `useSession()` 版本替代）

预期结果：
- 受保护路由与 API 都依赖 NextAuth 会话；UI 通过 useSession 显示用户信息

### 阶段三：测试、打磨与文档（Day 3）
1) 单元/集成测试：auth callbacks、middleware 路由匹配、API 401/403 行为
2) 手动验证流程（见下节）
3) 文档完善：本文件 + 新建 `docs/鉴权设计与接入.md`（架构、变量、常见问题）

预期结果：
- 完整的验证通过，文档齐备，可平滑交接

---

## 三、文件变更清单

### 新建
- `auth.ts`：NextAuth 配置（Credentials + Prisma Adapter + callbacks + 导出 helpers）
- `middleware.ts`：路由保护（认证与管理员角色）
- （可选）`app/api/auth/[...nextauth]/route.ts`：若采用 handlers 方式，也可只在 `auth.ts` 导出 `handlers` 并路由到此

### 修改
- `prisma/schema.prisma`：新增 NextAuth 模型 + `User.emailVerified?`
- `app/layout.tsx`：包裹 `<SessionProvider>`
- `app/api/chat/route.ts`：使用 `auth()` 获取 session/userId；禁止信任 body.userId
- `components/auth/invite-code-auth.tsx`：注册成功后调用 `signIn('credentials', ...)`
- `components/auth/user-menu.tsx`：改 `useSession()/signOut()`

### 删除（或标记废弃）
- `contexts/auth-context.tsx`：删除
- `components/auth/auth-guard.tsx`：删除或改为 useSession 版（若确需）

---

## 四、测试验证步骤

### A. 单元/集成（建议）
- callbacks.session：当 user 存在时，注入 `id/role/...` 字段
- middleware：
  - 未认证访问 `/workspace` -> 重定向 `/`
  - 非管理员访问 `/admin` -> 403/重定向
- API：
  - 未认证访问 `/api/chat` -> 401
  - 已认证访问 `/api/chat` -> 200

### B. 手动验证（开发环境）
1) 准备环境变量：`NEXTAUTH_URL`、`NEXTAUTH_SECRET`、`DEV_LOGIN_CODE`、数据库连接
2) 运行 `pnpm dev`
3) 邀请码注册：
   - 页面输入邀请码 -> /api/invite-codes/verify 成功
   - 注册表单提交 -> /api/invite-codes/register 成功
   - 前端自动执行 `signIn('credentials', { email, code: DEV_LOGIN_CODE, redirect: false })`
4) 访问 `/workspace`：应已登录可用
5) 调用 `/api/chat`：应返回 200，且服务端记录使用 session.user.id
6) 测试 `/admin`：非管理员应被拒绝，管理员账号可访问
7) 点击用户菜单退出 `signOut()`，再访问 `/workspace` 应被拦截到 `/`

---

## 五、风险点与注意事项

- DEV_LOGIN_CODE（极重要）
  - 仅开发环境使用；生产环境禁用该 Provider 或不配置该变量
  - authorize 必须严格校验 `code === DEV_LOGIN_CODE`
- session 字段注入
  - 控制注入字段体积（仅注入前端必须展示字段，如 `id`, `role`, `displayName`, `currentMonthUsage`, `monthlyTokenLimit`）
  - 避免注入敏感信息
- API 安全约束
  - 一律以 session.user.id 为准，不信任 body.userId
  - 管理端 API 强制 role 校验
- 迁移顺序
  - 先引入 SessionProvider 与 middleware（不破坏 UI），再改 API 与组件；逐步可验证
- 未来迁移
  - 从 Credentials 迁移到 Email/OAuth：
    - 保留 Prisma Adapter 与 session callbacks
    - 替换 Provider；删除 DEV_LOGIN_CODE

---

## 六、里程碑与时间安排（建议）
- Day 1：依赖安装、auth.ts、Prisma 迁移、middleware、SessionProvider
- Day 2：API 加固、组件迁移、删除 AuthContext
- Day 3：测试与文档完善

---

## 七、常见问题（FAQ）
- Q: 邀请码注册后如何自动登录？
  - A: register 成功后，前端调用 `signIn('credentials', { email, code: DEV_LOGIN_CODE, redirect: false })`，然后路由到 `/workspace`。
- Q: 如何显示用户用量配额？
  - A: 在 `callbacks.session` 中把必要字段注入到 `session.user`；`useSession()` 直接消费。
- Q: 还需要前端 AuthGuard 吗？
  - A: 推荐依赖 `middleware` 做强保护；如需防止首屏闪烁，可以保留一个轻量 `useSession()` 守卫。

