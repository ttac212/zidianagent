# 🚀 智点AI平台 - 快速部署指南

> 5分钟了解如何部署，选择最适合你的方案

## 📌 一句话总结

**中国用户必读：** Vercel默认域名在中国不稳定，需要自定义域名+Cloudflare CDN

## 🎯 三种方案快速对比

| | 方案一 | 方案二 | 方案三 |
|---|---|---|---|
| **名称** | Vercel + Cloudflare | 阿里云/腾讯云 Docker | 腾讯云 Serverless |
| **适合场景** | 个人、初创、中小流量 | 企业、高流量 | 预算有限、流量不稳定 |
| **月费用** | ¥4-8 | ¥200-350 | ¥50-150 |
| **访问速度** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **部署难度** | ⭐ 简单 | ⭐⭐⭐ 较难 | ⭐⭐ 中等 |
| **需要备案** | ❌ 不需要 | ✅ 需要 | ✅ 需要 |
| **推荐指数** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

## 🏆 推荐方案（95%场景适用）

### 方案一：Vercel + Cloudflare CDN

**总成本：** ¥50-100/年（仅域名费）

**5步快速部署：**

1. **购买域名**（¥50/年）
   - 阿里云：https://wanwang.aliyun.com/
   - 腾讯云：https://dnspod.cloud.tencent.com/

2. **部署到Vercel**（10分钟）
   - 注册 https://vercel.com/
   - 导入Git仓库
   - 配置环境变量

3. **配置Cloudflare CDN**（10分钟）
   - 注册 https://www.cloudflare.com/（免费）
   - 添加网站
   - 修改DNS服务器

4. **绑定域名**（5分钟）
   - Cloudflare添加CNAME记录
   - Vercel绑定自定义域名

5. **初始化数据库**（5分钟）
   - 注册 https://console.neon.tech/（免费3GB）
   - 运行 `pnpm db:push`
   - 创建管理员账户

**详细步骤：** 查看 [DEPLOYMENT-CHINA.md](./DEPLOYMENT-CHINA.md)

---

## 📋 部署前准备（3个必备项）

### 1. 修改数据库配置

编辑 `prisma/schema.prisma`：

```diff
datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 2. 获取API密钥

- ✅ **ZenMux API Key**（必需）：https://zenmux.ai
- ✅ **TikHub API Key**（必需）：https://user.tikhub.io
- ⚪ 302.AI API Key（可选）：https://302.ai

### 3. 生成认证密钥

```bash
# 生成NextAuth密钥
openssl rand -hex 32

# 设置管理员密码（至少16位，包含字母数字符号）
ADMIN_LOGIN_PASSWORD=your-strong-password
```

---

## 🔧 环境变量配置（核心）

复制以下模板，替换 `<你的值>` 部分：

```bash
# 核心配置
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<openssl rand -hex 32生成>

# 数据库（使用Neon）
DATABASE_URL=postgresql://user:password@ep-xxx.aws.neon.tech/dbname?sslmode=require

# AI服务
ZENMUX_API_BASE=https://zenmux.ai/api/v1
ZENMUX_API_KEY=<你的ZenMux Key>
ZENMUX_DEFAULT_MODEL=anthropic/claude-sonnet-4.5

# 模型配置
MODEL_ALLOWLIST=anthropic/claude-sonnet-4.5,google/gemini-3-pro-preview,openai/gpt-5.1
NEXT_PUBLIC_MODEL_ALLOWLIST=anthropic/claude-sonnet-4.5,google/gemini-3-pro-preview,openai/gpt-5.1

# TikHub数据源
TIKHUB_API_BASE_URL=https://api.tikhub.dev
TIKHUB_API_KEY=<你的TikHub Key>

# 生产环境认证
ADMIN_LOGIN_PASSWORD=<设置强密码>
```

⚠️ **生产环境绝对不能设置：** `DEV_LOGIN_CODE`

---

## ✅ 部署验证（5项测试）

部署完成后，测试以下功能：

```bash
# 1. 访问首页
curl -I https://your-domain.com

# 2. 检查DNS解析
nslookup your-domain.com

# 3. 检查Cloudflare CDN
curl -I https://your-domain.com | grep cf-ray

# 4. 测试登录功能
# 浏览器访问 https://your-domain.com/login

# 5. 测试对话功能
# 登录后创建新对话
```

---

## ❓ 常见问题 3 连击

### Q1: 我必须购买域名吗？

**答：** 是的，如果中国用户访问的话。

- Vercel默认域名 `*.vercel.app` 在中国不稳定
- 域名费用约¥50-100/年
- 推荐在阿里云或腾讯云购买

### Q2: Cloudflare需要付费吗？

**答：** 不需要，免费版完全够用。

- ✅ 免费版包含：无限流量、全球CDN、SSL证书
- 只有需要高级功能才需要升级（$20/月）

### Q3: 我没有服务器经验，能部署吗？

**答：** 完全可以！

- 方案一（Vercel+Cloudflare）无需服务器知识
- 只需要会：注册账号、复制粘贴、点击按钮
- 按照文档步骤操作即可（约30-45分钟）

---

## 📚 完整文档索引

| 文档 | 适用场景 | 时长 |
|------|---------|------|
| **本文档** | 快速了解方案 | 5分钟 |
| [DEPLOYMENT-CHINA.md](./DEPLOYMENT-CHINA.md) | 中国用户详细部署 | 30分钟 |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 海外用户部署 | 30分钟 |
| [CLAUDE.md](./CLAUDE.md) | 项目完整文档 | 60分钟 |

---

## 🆘 遇到问题？

### 按以下顺序排查：

1. **查看常见问题**
   - [DEPLOYMENT-CHINA.md - 常见问题解答](./DEPLOYMENT-CHINA.md#-常见问题解答)
   - 10个高频问题已收录

2. **检查日志**
   - Vercel: Dashboard → Deployments → Function Logs
   - 本地: `pnpm deploy:check`

3. **自助诊断**
   ```bash
   # DNS检查
   nslookup your-domain.com

   # 连接测试
   curl -I https://your-domain.com

   # 数据库测试
   DATABASE_URL="..." npx prisma studio
   ```

4. **获取帮助**
   - GitHub Issues
   - 项目文档技术支持部分

---

## 🎯 下一步行动

选择你的路径：

### 路径A：立即开始部署（推荐）

```bash
# 1. 修改数据库配置
# 编辑 prisma/schema.prisma，改为 postgresql

# 2. 验证构建
pnpm deploy:check

# 3. 按照 DEPLOYMENT-CHINA.md 开始部署
```

### 路径B：先仔细阅读文档

1. 阅读 [DEPLOYMENT-CHINA.md](./DEPLOYMENT-CHINA.md)（30分钟）
2. 准备域名和API密钥
3. 预估时间和成本
4. 开始部署

### 路径C：观望一下再决定

1. 查看 [方案对比](./DEPLOYMENT-CHINA.md#-方案对比)
2. 计算成本：[成本明细](./DEPLOYMENT-CHINA.md#q10-成本大概多少如何控制成本)
3. 评估技术能力要求
4. 咨询技术支持

---

## 💡 专业建议

### 新手建议

- ✅ 先用方案一（Vercel+Cloudflare）
- ✅ 流量大了再考虑迁移到方案二
- ✅ 不要一开始就追求完美
- ✅ 遇到问题先查文档，再问人

### 老手建议

- ✅ 方案一也很强，不要小看
- ✅ 除非高并发，否则不需要自建服务器
- ✅ Cloudflare CDN效果很好
- ✅ 成本控制优先

---

**准备好了吗？开始你的部署之旅吧！🚀**

详细步骤请查看：[DEPLOYMENT-CHINA.md](./DEPLOYMENT-CHINA.md)
