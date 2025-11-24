# 生产环境部署指南

## 🇨🇳 中国用户特别提示

**如果您的主要用户在中国大陆，请先阅读：** [**中国用户部署指南 (DEPLOYMENT-CHINA.md)**](./DEPLOYMENT-CHINA.md)

⚠️ **重要：** Vercel 默认域名 `*.vercel.app` 在中国访问可能不稳定或无法访问。

**推荐方案：** Vercel + 自定义域名 + Cloudflare CDN
- ✅ 中国访问速度快
- ✅ 成本最低（免费起步）
- ✅ 部署简单
- ✅ 无需备案

详细步骤请查看 **DEPLOYMENT-CHINA.md**

---

## 📋 目录
- [部署前准备](#部署前准备)
- [方案一：Vercel + Neon PostgreSQL](#方案一vercel--neon-postgresql推荐)
- [方案二：Railway 一体化部署](#方案二railway-一体化部署)
- [部署后配置](#部署后配置)
- [常见问题](#常见问题)

---

## 部署前准备

### 1. 环境检查清单

在开始部署前，请确认您已准备好以下内容：

- [ ] Git仓库（GitHub/GitLab/Bitbucket）
- [ ] 以下API密钥：
  - [ ] ZenMux API Key（必需，获取地址：https://zenmux.ai）
  - [ ] TikHub API Key（必需，获取地址：https://user.tikhub.io）
  - [ ] 302.AI API Key（可选，备选方案）
- [ ] 生成NextAuth密钥：`openssl rand -hex 32`
- [ ] 设置强管理员密码

### 2. 本地构建测试

部署前建议先在本地验证构建成功：

```bash
# 运行完整检查
pnpm deploy:check

# 如果通过，说明代码可以部署
```

### 3. 数据库迁移准备

⚠️ **重要：生产环境必须使用PostgreSQL**

将 `prisma/schema.prisma` 中的数据源改为：

```prisma
datasource db {
  provider = "postgresql"  // 从 sqlite 改为 postgresql
  url      = env("DATABASE_URL")
}
```

---

## 方案一：Vercel + Neon PostgreSQL（推荐）

### 为什么选择这个方案？
- ✅ Vercel是Next.js原生平台，零配置优化
- ✅ 全球CDN加速，访问速度最快
- ✅ 自动HTTPS证书，无需配置
- ✅ Neon提供免费PostgreSQL（3GB存储，足够中小项目）
- ✅ Git推送自动部署，CI/CD开箱即用

---

### 步骤1：创建Neon PostgreSQL数据库

1. **注册Neon账号**
   - 访问：https://console.neon.tech/
   - 使用GitHub账号快速登录

2. **创建数据库项目**
   - 点击"Create a project"
   - 项目名称：`zhidian-ai-prod`
   - Region选择：**AWS Asia Pacific (Singapore)** 或离用户最近的区域
   - PostgreSQL版本：默认最新版即可

3. **获取连接字符串**
   - 项目创建后，在Dashboard可以看到连接信息
   - 复制 **Connection String**（格式如下）：
     ```
     postgresql://username:password@ep-xxx-xxx.aws.neon.tech/neondb?sslmode=require
     ```
   - ⚠️ 保存好这个连接字符串，后面配置环境变量时需要

4. **Neon免费额度**
   - 3 GB数据存储
   - 每月300小时计算时间
   - 10个分支（用于开发/测试环境）

---

### 步骤2：部署到Vercel

1. **登录Vercel**
   - 访问：https://vercel.com/
   - 使用GitHub账号登录

2. **导入项目**
   - 点击"Add New..." → "Project"
   - 选择您的Git仓库（例如：`zhidian-ai-platform`）
   - 如果是私有仓库，需要授权Vercel访问

3. **配置构建设置**
   ```
   Framework Preset: Next.js
   Root Directory: ./
   Build Command: pnpm build
   Install Command: pnpm install
   Output Directory: .next (自动检测)
   Node.js Version: 20.x
   ```

4. **配置环境变量（重要！）**

   在"Environment Variables"部分添加以下变量：

   ```bash
   # === 核心配置 ===
   NEXTAUTH_URL=https://your-app-name.vercel.app
   NEXTAUTH_SECRET=<运行 openssl rand -hex 32 生成的密钥>

   # === 数据库（使用Neon连接字符串）===
   DATABASE_URL=postgresql://username:password@ep-xxx.aws.neon.tech/neondb?sslmode=require

   # === AI服务（ZenMux主要提供商）===
   ZENMUX_API_BASE=https://zenmux.ai/api/v1
   ZENMUX_API_KEY=<你的ZenMux API Key>
   ZENMUX_DEFAULT_MODEL=anthropic/claude-sonnet-4.5

   # === 模型配置 ===
   MODEL_ALLOWLIST=anthropic/claude-sonnet-4.5,google/gemini-3-pro-preview,openai/gpt-5.1
   NEXT_PUBLIC_MODEL_ALLOWLIST=anthropic/claude-sonnet-4.5,google/gemini-3-pro-preview,openai/gpt-5.1

   # === TikHub数据源 ===
   TIKHUB_API_BASE_URL=https://api.tikhub.dev
   TIKHUB_API_KEY=<你的TikHub API Key>

   # === 可选：302.AI备选 ===
   LLM_API_BASE=https://api.302.ai/v1
   LLM_API_KEY=<你的302.AI API Key>
   DOUBAO_ASR_API_URL=https://api.302.ai/doubao/largemodel/recognize

   # === 功能配置 ===
   NEXT_PUBLIC_CONNECTION_MONITORING=enabled
   NEXT_PUBLIC_APP_NAME=支点有星辰

   # === 生产环境认证（非常重要！）===
   ADMIN_LOGIN_PASSWORD=<设置一个强密码，至少16位>
   ```

   **⚠️ 安全提醒：**
   - 绝对不要设置 `DEV_LOGIN_CODE`（这会允许任何人注册）
   - `ADMIN_LOGIN_PASSWORD` 必须是强密码
   - 所有密钥都只在生产环境设置，不要提交到Git

5. **开始部署**
   - 点击"Deploy"按钮
   - Vercel会自动构建和部署
   - 部署过程大约2-5分钟

---

### 步骤3：初始化数据库

部署成功后，需要运行Prisma迁移来创建数据库表：

**方法A：使用本地终端（推荐）**

```bash
# 1. 下载生产环境变量到本地
npx vercel env pull .env.production

# 2. 生成Prisma Client
pnpm db:generate

# 3. 推送数据库Schema（创建所有表）
DATABASE_URL="<Neon连接字符串>" npx prisma db push

# 4. 验证数据库
DATABASE_URL="<Neon连接字符串>" npx prisma studio
```

**方法B：使用Neon SQL Editor**

1. 在Neon Console → SQL Editor
2. 运行以下命令生成SQL：
   ```bash
   npx prisma migrate diff \
     --from-empty \
     --to-schema-datamodel prisma/schema.prisma \
     --script > migration.sql
   ```
3. 将生成的SQL复制到Neon SQL Editor执行

---

### 步骤4：创建管理员账户

数据库初始化后，创建第一个管理员账户：

```bash
# 使用生产数据库连接创建用户
DATABASE_URL="<Neon连接字符串>" npx tsx scripts/create-user.ts \
  admin@your-company.com \
  "系统管理员" \
  ADMIN \
  1000000
```

**创建更多用户：**

```bash
# 创建普通用户（月限额100k tokens）
DATABASE_URL="<Neon连接字符串>" npx tsx scripts/create-user.ts \
  user@example.com \
  "张三" \
  USER \
  100000

# 查看所有用户
DATABASE_URL="<Neon连接字符串>" npx tsx scripts/manage-users.ts list
```

---

### 步骤5：验证部署

1. **访问应用**
   - 打开 `https://your-app-name.vercel.app`
   - 检查页面是否正常加载

2. **测试登录**
   - 访问 `/login` 页面
   - 使用创建的管理员邮箱 + `ADMIN_LOGIN_PASSWORD` 登录
   - ⚠️ 如果登录失败，检查环境变量配置

3. **测试核心功能**
   - [ ] 创建新对话，测试AI回复
   - [ ] 检查商家数据同步功能
   - [ ] 测试抖音视频分析功能

4. **检查日志**
   - Vercel Dashboard → 项目 → Deployments → 最新部署 → Function Logs
   - 查看是否有错误或警告

---

### 步骤6：配置自定义域名（可选）

1. **在Vercel中添加域名**
   - 项目设置 → Domains
   - 输入您的域名（例如：`ai.your-company.com`）

2. **配置DNS记录**
   - 在您的域名DNS服务商添加CNAME记录：
     ```
     类型: CNAME
     主机: ai
     值: cname.vercel-dns.com
     ```

3. **更新环境变量**
   - 将 `NEXTAUTH_URL` 更新为您的自定义域名
   - 重新部署应用

---

## 方案二：Railway 一体化部署

### 为什么选择Railway？
- ✅ 应用和数据库在同一平台管理
- ✅ 自动提供PostgreSQL数据库
- ✅ 配置更简单，适合快速上线
- ✅ 内置监控和日志系统
- ✅ 支持定时任务（Cron）

### 步骤1：创建Railway项目

1. **注册登录**
   - 访问：https://railway.app/
   - 使用GitHub账号登录

2. **创建新项目**
   - Dashboard → "New Project"
   - 选择 "Deploy from GitHub repo"
   - 授权并选择您的项目仓库

---

### 步骤2：添加PostgreSQL数据库

1. **添加数据库服务**
   - 项目内点击 "New" → "Database" → "PostgreSQL"
   - Railway会自动创建并启动数据库

2. **获取连接信息**
   - 数据库会自动注入环境变量 `DATABASE_URL`
   - 可以在数据库服务的"Variables"标签查看

---

### 步骤3：配置应用服务

1. **配置构建命令**
   - 选择GitHub仓库服务
   - Settings → Build：
     ```
     Build Command: pnpm install && pnpm db:generate && pnpm build
     Start Command: pnpm start
     ```

2. **添加环境变量**
   - Settings → Variables
   - 添加以下变量（参考方案一的环境变量列表）：
     ```bash
     NEXTAUTH_URL=${{RAILWAY_PUBLIC_DOMAIN}}
     NEXTAUTH_SECRET=<生成的密钥>
     # DATABASE_URL 自动注入，无需手动配置
     ZENMUX_API_BASE=https://zenmux.ai/api/v1
     ZENMUX_API_KEY=<你的Key>
     # ... 其他变量
     ```

3. **设置端口**
   - Railway会自动检测端口3007
   - 如需修改，添加环境变量：`PORT=3007`

---

### 步骤4：部署和初始化

1. **触发部署**
   - 保存配置后，Railway会自动开始构建
   - 查看部署日志：Deployments → 最新部署 → View Logs

2. **初始化数据库**
   - 等待应用启动成功
   - 使用Railway终端或本地终端执行：
     ```bash
     # Railway提供了内置终端
     pnpm db:push
     npx tsx scripts/create-user.ts admin@example.com "管理员" ADMIN 1000000
     ```

3. **获取公网域名**
   - Settings → Networking → Generate Domain
   - Railway会提供一个 `.up.railway.app` 域名

---

### 步骤5：配置自定义域名（可选）

1. **添加域名**
   - Settings → Networking → Custom Domain
   - 输入您的域名

2. **配置DNS**
   - 添加CNAME记录指向Railway提供的地址

---

## 部署后配置

### 1. 设置定时任务（商家数据同步）

如果需要自动同步商家数据，可以使用以下方式：

**Vercel部署：使用Vercel Cron**

1. 创建 `vercel.json`：
   ```json
   {
     "crons": [
       {
         "path": "/api/merchants/cron-sync",
         "schedule": "0 */6 * * *"
       }
     ]
   }
   ```

2. 创建API路由 `app/api/merchants/cron-sync/route.ts`

**Railway部署：使用Railway Cron**

1. 在项目中添加新服务 → "Cron Job"
2. 配置运行命令：
   ```bash
   npx tsx scripts/batch-enhance-all-merchants.ts
   ```
3. 设置Cron表达式：`0 */6 * * *`（每6小时）

---

### 2. 配置监控和告警

**Vercel Analytics（推荐）**

1. 项目设置 → Analytics
2. 启用 Web Analytics
3. 查看访问量、性能指标

**Sentry错误追踪（可选）**

1. 注册 https://sentry.io/
2. 添加环境变量：
   ```bash
   SENTRY_DSN=<你的Sentry DSN>
   ```
3. 安装依赖：
   ```bash
   pnpm add @sentry/nextjs
   ```

---

### 3. 数据备份策略

**Neon自动备份**
- Neon自动每天备份数据
- 保留7天备份历史
- 可在Console手动触发备份

**Railway自动备份**
- Railway Pro计划提供自动备份
- 免费计划建议手动备份：
  ```bash
  pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
  ```

---

## 常见问题

### Q1: 部署后登录显示401错误

**原因：** 环境变量配置错误或未生效

**解决方案：**
1. 检查 `NEXTAUTH_URL` 是否与实际域名一致
2. 确认 `NEXTAUTH_SECRET` 已设置
3. 重新部署触发环境变量更新
4. 检查是否误设置了 `DEV_LOGIN_CODE`（生产环境禁止）

---

### Q2: 数据库连接超时

**原因：** Prisma连接池配置或网络问题

**解决方案：**
```bash
# 在DATABASE_URL后添加连接池参数
DATABASE_URL="postgresql://...?sslmode=require&connection_limit=5&pool_timeout=10"
```

---

### Q3: 构建失败："Cannot find module prisma"

**原因：** Prisma Client未生成

**解决方案：**
```bash
# 确保构建命令包含prisma generate
Build Command: pnpm install && pnpm db:generate && pnpm build
```

---

### Q4: AI回复报错"API Key invalid"

**原因：** ZenMux或TikHub API Key配置错误

**解决方案：**
1. 检查环境变量拼写：`ZENMUX_API_KEY`、`TIKHUB_API_KEY`
2. 确认API Key在对应平台仍然有效
3. 检查是否有前后空格
4. 测试API Key：
   ```bash
   curl -H "Authorization: Bearer $ZENMUX_API_KEY" \
     https://zenmux.ai/api/v1/models
   ```

---

### Q5: 如何回滚到上一个版本？

**Vercel：**
1. Deployments → 选择之前的成功部署
2. 点击三个点 → "Promote to Production"

**Railway：**
1. Deployments → 选择之前的部署
2. 点击"Redeploy"

---

### Q6: 如何查看生产环境日志？

**Vercel：**
- Dashboard → 项目 → Deployments → Function Logs
- 支持实时日志流

**Railway：**
- 项目 → 服务 → View Logs
- 支持按时间范围筛选

---

### Q7: 数据库存储空间不足怎么办？

**Neon免费计划（3GB）：**
1. 升级到Pro计划（$19/月，无限存储）
2. 或清理历史数据：
   ```sql
   DELETE FROM messages WHERE createdAt < NOW() - INTERVAL '90 days';
   DELETE FROM usage_stats WHERE date < NOW() - INTERVAL '180 days';
   ```

**Railway：**
- 免费计划共享1GB
- 升级到Developer计划（$5/月）

---

### Q8: 如何添加新用户？

**方法1：使用脚本（推荐）**
```bash
DATABASE_URL="<生产数据库URL>" npx tsx scripts/create-user.ts \
  newuser@example.com \
  "新用户" \
  USER \
  100000
```

**方法2：使用Prisma Studio**
```bash
DATABASE_URL="<生产数据库URL>" npx prisma studio
```

---

## 性能优化建议

### 1. 启用CDN加速

- Vercel自动提供全球CDN
- Railway需要手动配置Cloudflare

### 2. 数据库查询优化

```bash
# 检查慢查询
DATABASE_URL="..." npx tsx scripts/project-health-check.js

# 创建缺失的索引
npx prisma db push
```

### 3. 图片和静态资源优化

- 使用Next.js Image组件自动优化图片
- 配置 `next.config.js`：
  ```javascript
  images: {
    domains: ['your-cdn.com'],
    formats: ['image/webp', 'image/avif']
  }
  ```

---

## 安全检查清单

部署前请确认：

- [ ] 移除所有 `DEV_LOGIN_CODE` 配置
- [ ] 设置强 `ADMIN_LOGIN_PASSWORD`（至少16位，包含大小写字母数字符号）
- [ ] 所有API Key使用环境变量，不提交到Git
- [ ] 启用HTTPS（Vercel和Railway自动提供）
- [ ] 配置CORS策略（如果有前后端分离）
- [ ] 定期轮换API密钥
- [ ] 启用数据库SSL连接（Neon默认启用）

---

## 成本估算

### Vercel + Neon（推荐起步配置）

| 服务 | 计划 | 月费用 | 限制 |
|------|------|--------|------|
| Vercel | Hobby | $0 | 100GB带宽，1000次构建 |
| Neon | Free | $0 | 3GB存储，300小时计算 |
| **总计** | | **$0** | 适合中小项目 |

**升级选项：**
- Vercel Pro: $20/月（无限带宽）
- Neon Pro: $19/月（无限存储）

### Railway（一体化方案）

| 计划 | 月费用 | 包含资源 |
|------|--------|----------|
| Trial | $0 | $5免费额度，试用期内够用 |
| Developer | $5 | $5免费额度 + 按量计费 |
| Pro | $20 | $10免费额度 + 更多资源 |

**预估成本：**
- 中小流量（<10k PV/月）：约$10-15/月
- 中等流量（50k PV/月）：约$30-50/月

---

## 技术支持

如遇到部署问题：

1. **查看日志**：先检查部署日志和应用日志
2. **项目健康检查**：
   ```bash
   DATABASE_URL="..." npx tsx scripts/project-health-check.js
   ```
3. **GitHub Issues**：在项目仓库提交Issue
4. **官方文档**：
   - [Vercel文档](https://vercel.com/docs)
   - [Railway文档](https://docs.railway.app/)
   - [Neon文档](https://neon.tech/docs)

---

## 下一步

部署完成后，建议：

1. [ ] 配置监控和告警
2. [ ] 设置数据库自动备份
3. [ ] 配置定时任务（商家数据同步）
4. [ ] 优化SEO配置
5. [ ] 添加Google Analytics或其他分析工具
6. [ ] 配置Sentry错误追踪
7. [ ] 编写运维文档

---

**祝部署顺利！🚀**
