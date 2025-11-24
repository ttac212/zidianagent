#  中国用户部署指南

> 本指南专门针对中国大陆用户优化，解决 Vercel 默认域名访问问题

## 📖 阅读导航

- [快速选择方案](#快速选择你的部署方案) - **3分钟决策**
- [方案一：Vercel + Cloudflare](#方案一vercel--自定义域名--cloudflare-cdn最推荐) - **推荐方案，免费**
- [方案二：国内云服务商](#方案二国内云服务商阿里云腾讯云--docker) - **企业级方案**
- [方案三：Serverless](#方案三腾讯云serverless--云数据库) - **按量付费**
- [方案对比](#-方案对比) - **详细对比表**
- [访问速度优化](#-访问速度优化建议) - **性能调优**
- [常见问题](#-常见问题解答) - **疑难解答**

---

## 🎯 快速选择你的部署方案

### 决策树（30秒快速选择）

```
是否有自己的域名？
│
├─ 是 → 预算如何？
│      │
│      ├─ 预算有限（< ¥100/年）
│      │  └─ ✅ 方案一：Vercel + Cloudflare（推荐）
│      │
│      └─ 预算充足（¥200-300/月）+ 需要最快速度
│         └─ ✅ 方案二：阿里云/腾讯云 Docker
│
└─ 否 → 需要购买域名（¥50-100/年）
       └─ ✅ 方案一：Vercel + Cloudflare（推荐）
```

### 三句话总结

| 场景 | 推荐方案 |
|------|---------|
| 💡 **个人项目、初创公司、中小流量** | **方案一** - Vercel + Cloudflare（免费起步，需域名） |
| 🏢 **企业级应用、高流量、需要备案** | **方案二** - 阿里云/腾讯云 Docker（¥200-300/月） |
| 💰 **预算有限、流量不稳定** | **方案三** - 腾讯云 Serverless（¥50-150/月，按量付费） |

---

## 🇨🇳 中国访问情况分析

### ❌ 存在问题的服务

| 服务 | 访问状态 | 影响 | 解决方案 |
|------|---------|------|---------|
| Vercel默认域名 `*.vercel.app` | ⚠️ 不稳定/速度慢 | 用户无法访问应用 | **使用自定义域名+CDN** |
| Railway默认域名 `*.railway.app` | ⚠️ 访问慢 | 用户体验差 | 使用自定义域名 |
| GitHub | ⚠️ 访问慢 | CI/CD部署慢 | 使用Gitee镜像或手动部署 |

### ✅ 正常访问的服务

- **Neon PostgreSQL**（新加坡节点）：✅ 正常
- **ZenMux API**：✅ 正常
- **TikHub API**（api.tikhub.dev）：✅ 专门提供中国节点
- **302.AI**：✅ 国内可正常访问
- **Cloudflare CDN**：✅ 在中国有节点

---

## 🎯 推荐部署方案（中国用户）

### 方案一：Vercel + 自定义域名 + Cloudflare CDN（最推荐）

**原理：**
- 使用Vercel部署（开发体验好）
- 通过自己的域名 + Cloudflare CDN加速
- **完全避开 vercel.app 域名**

**优势：**
- ✅ 中国用户访问速度快（Cloudflare在中国有节点）
- ✅ 保留Vercel的开发体验
- ✅ 自动HTTPS
- ✅ 成本低（Cloudflare免费）

#### 详细步骤

**第1步：准备域名**

1. 购买域名（推荐国内服务商）：
   - 阿里云：https://wanwang.aliyun.com/
   - 腾讯云：https://dnspod.cloud.tencent.com/
   - 建议使用：`.com` / `.cn` / `.net`

2. 域名需要备案（如果服务器在中国境内）
   - ⚠️ Vercel服务器在海外，**无需备案**
   - 但建议备案以获得更好的国内访问速度

**第2步：部署到Vercel**

按照 `DEPLOYMENT.md` 的"方案一"完成Vercel部署，但**不要使用默认域名**。

**第3步：配置Cloudflare CDN**

1. **注册Cloudflare**
   - 访问：https://www.cloudflare.com/
   - 创建账号（免费计划即可）

2. **添加网站**
   - Dashboard → 添加站点
   - 输入您的域名（例如：`your-domain.com`）
   - 选择免费计划

3. **修改DNS服务器**
   - Cloudflare会提供2个NS服务器地址：
     ```
     名称服务器1: nina.ns.cloudflare.com
     名称服务器2: walt.ns.cloudflare.com
     ```
   - 在您的域名注册商（阿里云/腾讯云）修改DNS服务器为Cloudflare提供的地址

4. **等待DNS生效**
   - 通常需要10分钟 - 48小时
   - Cloudflare会发送邮件通知生效

**第4步：配置DNS记录指向Vercel**

在Cloudflare DNS设置中添加：

```
类型: CNAME
名称: @（或 www）
目标: cname.vercel-dns.com
代理状态: 已代理（橙色云朵）
TTL: 自动
```

如果要同时支持裸域名和www：

```
# 记录1：裸域名
类型: CNAME
名称: @
目标: cname.vercel-dns.com
代理状态: 已代理

# 记录2：www子域名
类型: CNAME
名称: www
目标: cname.vercel-dns.com
代理状态: 已代理
```

**第5步：在Vercel添加自定义域名**

1. Vercel项目设置 → Domains
2. 添加您的域名：`your-domain.com` 和 `www.your-domain.com`
3. Vercel会自动验证并配置

**第6步：Cloudflare优化配置**

在Cloudflare控制台进行以下优化：

1. **SSL/TLS设置**
   - SSL/TLS → 概述 → 加密模式：**完全（严格）**

2. **速度优化**
   - Speed → Optimization
   - ✅ 启用 Auto Minify（HTML、CSS、JS）
   - ✅ 启用 Brotli 压缩
   - ✅ 启用 Early Hints

3. **缓存配置**
   - Caching → Configuration
   - 缓存级别：标准
   - 浏览器缓存TTL：4小时

4. **中国网络优化（付费功能）**
   - Network → 中国网络
   - 如果预算允许，可开启 China Network（$100/月）
   - **免费版已经足够快**

**第7步：更新环境变量**

在Vercel项目中更新：

```bash
NEXTAUTH_URL=https://your-domain.com
```

重新部署生效。

**第8步：测试访问速度**

使用国内测速工具验证：
- https://www.17ce.com/
- https://www.boce.com/

---

### 方案二：国内云服务商（阿里云/腾讯云）+ Docker

**适用场景：**
- 需要最快的国内访问速度
- 愿意自己运维服务器
- 有服务器管理经验

**优势：**
- ✅ 访问速度最快（服务器在国内）
- ✅ 完全可控
- ✅ 可以使用已备案域名

**劣势：**
- ❌ 需要自己管理服务器
- ❌ 成本较高（服务器 + 数据库）
- ❌ 需要处理运维问题

#### 详细步骤

**第1步：购买云服务器**

**阿里云ECS**（推荐配置）：
- CPU：2核
- 内存：4GB
- 带宽：5Mbps
- 系统：Ubuntu 22.04 LTS
- 区域：选择离用户最近的（华东/华北/华南）
- 预估费用：约¥200-300/月

**腾讯云轻量应用服务器**：
- 配置同上
- 预估费用：约¥180-280/月

**第2步：配置服务器环境**

```bash
# 1. 连接服务器
ssh root@your-server-ip

# 2. 更新系统
apt update && apt upgrade -y

# 3. 安装Docker
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

# 4. 安装Docker Compose
apt install docker-compose -y

# 5. 安装Node.js和pnpm（用于数据库迁移）
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pnpm

# 6. 创建项目目录
mkdir -p /app/zhidian-ai
cd /app/zhidian-ai
```

**第3步：创建Docker Compose配置**

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  # PostgreSQL数据库
  postgres:
    image: postgres:15-alpine
    container_name: zhidian-postgres
    restart: always
    environment:
      POSTGRES_DB: zhidianai
      POSTGRES_USER: zhidian
      POSTGRES_PASSWORD: <设置强密码>
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zhidian"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Next.js应用
  app:
    image: node:20-alpine
    container_name: zhidian-app
    restart: always
    working_dir: /app
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://zhidian:<密码>@postgres:5432/zhidianai
      NEXTAUTH_URL: https://your-domain.com
      NEXTAUTH_SECRET: <生成的密钥>
      ZENMUX_API_BASE: https://zenmux.ai/api/v1
      ZENMUX_API_KEY: <你的Key>
      ZENMUX_DEFAULT_MODEL: anthropic/claude-sonnet-4.5
      MODEL_ALLOWLIST: anthropic/claude-sonnet-4.5,google/gemini-3-pro-preview
      NEXT_PUBLIC_MODEL_ALLOWLIST: anthropic/claude-sonnet-4.5,google/gemini-3-pro-preview
      TIKHUB_API_BASE_URL: https://api.tikhub.dev
      TIKHUB_API_KEY: <你的Key>
      LLM_API_BASE: https://api.302.ai/v1
      LLM_API_KEY: <你的Key>
      DOUBAO_ASR_API_URL: https://api.302.ai/doubao/largemodel/recognize
      NEXT_PUBLIC_CONNECTION_MONITORING: enabled
      NEXT_PUBLIC_APP_NAME: 支点有星辰
      ADMIN_LOGIN_PASSWORD: <设置强密码>
    volumes:
      - ./app:/app
      - /app/node_modules
    ports:
      - "3007:3007"
    depends_on:
      postgres:
        condition: service_healthy
    command: sh -c "pnpm install && pnpm db:generate && pnpm db:push && pnpm start"

volumes:
  postgres_data:
```

**第4步：部署应用**

```bash
# 1. 克隆代码（如果使用GitHub）
git clone https://github.com/your-username/zhidian-ai.git app
cd app

# 或者从本地上传代码
# scp -r ./* root@your-server-ip:/app/zhidian-ai/app/

# 2. 修改prisma/schema.prisma
# 将 provider 改为 "postgresql"

# 3. 启动服务
cd /app/zhidian-ai
docker-compose up -d

# 4. 查看日志
docker-compose logs -f app

# 5. 检查服务状态
docker-compose ps
```

**第5步：配置Nginx反向代理**

```bash
# 1. 安装Nginx
apt install nginx -y

# 2. 创建Nginx配置
cat > /etc/nginx/sites-available/zhidian-ai <<'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # 强制HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL证书（后面配置）
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 日志
    access_log /var/log/nginx/zhidian-access.log;
    error_log /var/log/nginx/zhidian-error.log;

    # 反向代理到Next.js
    location / {
        proxy_pass http://localhost:3007;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # SSE支持（聊天流式响应）
        proxy_buffering off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # 静态文件缓存
    location /_next/static {
        proxy_pass http://localhost:3007;
        proxy_cache_valid 200 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# 3. 启用配置
ln -s /etc/nginx/sites-available/zhidian-ai /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

**第6步：配置SSL证书**

使用Let's Encrypt免费证书：

```bash
# 1. 安装Certbot
apt install certbot python3-certbot-nginx -y

# 2. 获取证书
certbot --nginx -d your-domain.com -d www.your-domain.com

# 3. 自动续期（Certbot会自动配置）
systemctl status certbot.timer
```

**第7步：创建管理员账户**

```bash
cd /app/zhidian-ai/app

docker-compose exec app npx tsx scripts/create-user.ts \
  admin@your-company.com \
  "系统管理员" \
  ADMIN \
  1000000
```

**第8步：配置防火墙**

```bash
# 开放必要端口
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

**第9步：设置自动备份**

创建备份脚本 `/app/backup.sh`：

```bash
#!/bin/bash
BACKUP_DIR="/app/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份数据库
docker-compose exec -T postgres pg_dump -U zhidian zhidianai | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# 删除7天前的备份
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_$DATE.sql.gz"
```

设置定时任务：

```bash
chmod +x /app/backup.sh

# 添加到crontab（每天凌晨2点备份）
crontab -e
# 添加：
0 2 * * * /app/backup.sh >> /var/log/backup.log 2>&1
```

---

### 方案三：腾讯云Serverless + 云数据库

**适用场景：**
- 流量不高但需要稳定性
- 不想管理服务器
- 预算有限

**步骤：**

1. 使用腾讯云Serverless Framework部署Next.js
2. 使用腾讯云PostgreSQL（TencentDB）
3. 配置CDN加速

**优势：**
- ✅ 按量付费，成本低
- ✅ 自动扩缩容
- ✅ 国内访问快

**预估费用：** ¥50-150/月

---

## 🚀 访问速度优化建议

### 1. CDN配置优化

**Cloudflare设置：**
```
缓存级别：标准
浏览器缓存TTL：4小时
Auto Minify：✅ 全部启用
Brotli压缩：✅ 启用
HTTP/3：✅ 启用
```

### 2. Next.js性能优化

在 `next.config.js` 中添加：

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 压缩输出
  compress: true,

  // 图片优化
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 86400,
  },

  // 启用SWC minify
  swcMinify: true,

  // 生产模式优化
  productionBrowserSourceMaps: false,

  // 页面静态化
  output: 'standalone',
}

module.exports = nextConfig
```

### 3. 数据库连接优化

对于中国用户，建议使用Neon的新加坡节点：

```bash
# Neon创建项目时选择：
Region: AWS Asia Pacific (Singapore)
```

如果连接慢，可以添加连接池配置：

```bash
DATABASE_URL="postgresql://...?pgbouncer=true&connection_limit=10"
```

---

## 📊 方案对比

| 方案 | 访问速度 | 部署难度 | 运维成本 | 月费用 | 推荐指数 |
|------|---------|---------|---------|--------|---------|
| Vercel + Cloudflare | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 无 | ¥0-50 | ⭐⭐⭐⭐⭐ |
| 阿里云/腾讯云 Docker | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 中 | ¥200-300 | ⭐⭐⭐⭐ |
| 腾讯云Serverless | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 低 | ¥50-150 | ⭐⭐⭐⭐ |

---

## 🎯 最终推荐

### 对于大多数中国用户：

**推荐：Vercel + 自定义域名 + Cloudflare CDN**

**理由：**
1. ✅ **成本最低**（免费或极低成本）
2. ✅ **部署最简单**（Git推送自动部署）
3. ✅ **访问速度快**（Cloudflare在中国有节点）
4. ✅ **无需运维**（完全托管）
5. ✅ **开发体验好**（Vercel原生支持Next.js）

**唯一要求：** 有自己的域名（约¥50-100/年）

### 对于企业级用户或高流量场景：

**推荐：阿里云/腾讯云 + Docker**

**理由：**
1. ✅ **访问速度最快**（服务器在国内）
2. ✅ **完全可控**（数据在自己服务器）
3. ✅ **支持备案域名**（合规要求）
4. ✅ **可扩展性强**（可以升级配置）

---

## ⚠️ 重要提醒

### 1. 域名备案

- 如果使用国内云服务商（阿里云/腾讯云），**域名必须备案**
- Vercel海外服务器，**无需备案**
- 备案流程约需15-20个工作日

### 2. 网络合规

确保以下API在中国可访问：
- ✅ ZenMux API（可访问）
- ✅ TikHub API（api.tikhub.dev，专门提供中国节点）
- ✅ 302.AI（国内可访问）

### 3. 数据安全

- 使用国内云服务商时，注意数据合规要求
- 建议启用数据加密和定期备份

---

## 🧪 测试清单

部署后，使用国内网络测试：

- [ ] 首页加载速度（目标：< 2秒）
- [ ] 登录功能正常
- [ ] 对话流式响应正常
- [ ] 商家数据同步正常
- [ ] 抖音视频分析功能正常
- [ ] 图片和静态资源加载速度
- [ ] 移动端访问体验

**测速工具：**
- https://www.17ce.com/（国内多节点测速）
- https://www.boce.com/（全国ping测试）

---

## ❓ 常见问题解答

### Q1: 我没有域名，可以先用 Vercel 默认域名测试吗？

**答：** 可以，但仅供测试。

- ✅ **开发测试**：可以用 `*.vercel.app` 在本地或海外测试
- ❌ **生产环境**：中国用户无法稳定访问，必须使用自定义域名

**建议：** 先购买域名（¥50-100/年），再进行部署。

---

### Q2: 哪里购买域名比较好？

**推荐国内服务商：**

1. **阿里云（万网）** - https://wanwang.aliyun.com/
   - 优势：稳定，价格合理，支持支付宝
   - 首年：.com 约¥55，.cn 约¥29

2. **腾讯云（DNSPod）** - https://dnspod.cloud.tencent.com/
   - 优势：操作简单，与腾讯云集成好
   - 首年：.com 约¥55

3. **GoDaddy** - https://www.godaddy.com/
   - 优势：国际知名，续费价格稳定
   - 首年：.com 约$10-15

**注意事项：**
- ⚠️ 注意续费价格（通常比首年贵）
- ⚠️ 如果用方案二（国内服务商），域名必须在同一平台（方便备案）
- ✅ 如果用方案一（Vercel），任何平台购买都可以

---

### Q3: Cloudflare 免费版够用吗？需要升级吗？

**答：** 免费版完全够用！

**免费版包含：**
- ✅ 无限流量
- ✅ 全球 CDN（包括中国节点）
- ✅ 免费 SSL 证书
- ✅ DDoS 防护
- ✅ 基础缓存
- ✅ DNS 管理

**什么时候需要升级？**
- 需要更详细的分析数据（Pro $20/月）
- 需要图片优化功能（Pro $20/月）
- 需要中国网络加速（Enterprise $200+/月，一般不需要）

**结论：** 95%的场景免费版足够。

---

### Q4: DNS 修改后多久生效？访问还是失败怎么办？

**生效时间：**
- 通常：10-30分钟
- 最长：48小时
- 建议等待1小时后测试

**检查方法：**

```bash
# 1. 检查DNS是否解析成功
nslookup your-domain.com

# 2. 检查Cloudflare是否生效（应该看到CF的IP）
ping your-domain.com

# 3. 检查SSL证书
curl -I https://your-domain.com
```

**常见问题：**
- ❌ DNS未生效 → 等待或清除本地DNS缓存（`ipconfig /flushdns`）
- ❌ 502错误 → Vercel域名未绑定
- ❌ SSL证书错误 → Cloudflare SSL设置改为"完全（严格）"

---

### Q5: 使用方案一后，访问速度还是慢怎么办？

**排查步骤：**

1. **确认Cloudflare代理已启用**
   - DNS记录旁边应该是橙色云朵 🟠
   - 如果是灰色云朵，点击启用

2. **检查响应头确认CDN生效**
   ```bash
   curl -I https://your-domain.com
   # 应该看到：cf-ray: xxx（表示通过Cloudflare）
   ```

3. **优化Cloudflare设置**
   - Speed → Optimization → 启用所有优化
   - Caching → Configuration → 缓存级别：标准

4. **测试不同地区速度**
   - 使用 https://www.17ce.com/ 多节点测速
   - 如果只有个别地区慢，可能是运营商问题

5. **如果还是慢，考虑升级方案二**
   - 使用国内服务器（阿里云/腾讯云）
   - 速度会明显提升

---

### Q6: 方案一和方案二该怎么选？

**选择方案一（Vercel + Cloudflare）如果：**
- ✅ 预算有限（只需域名费¥50-100/年）
- ✅ 不想管理服务器
- ✅ 流量不算特别大（< 100k PV/月）
- ✅ 对速度要求不是极致（< 2秒可接受）
- ✅ 不需要备案

**选择方案二（阿里云/腾讯云）如果：**
- ✅ 预算充足（¥200-300/月）
- ✅ 需要最快访问速度（< 0.5秒）
- ✅ 高流量（> 100k PV/月）
- ✅ 企业级应用，需要备案
- ✅ 需要更多控制权（数据库调优、自定义服务器配置）

**实际建议：**
- 95%的项目用方案一足够
- 先从方案一开始，流量大了再迁移到方案二

---

### Q7: 备案需要多久？流程复杂吗？

**备案时间：**
- 提交材料：1-2天
- 审核通过：10-20个工作日
- 总计：约15-25天

**备案流程（以阿里云为例）：**

1. **准备材料**
   - 营业执照（企业）或身份证（个人）
   - 域名证书
   - 服务器信息

2. **提交初审**
   - 阿里云ICP备案系统提交
   - 上传证件照片
   - 填写网站信息

3. **拍照核验**
   - 阿里云提供幕布或APP人脸识别
   - 上传核验照片

4. **管局审核**
   - 提交到省通信管理局
   - 等待审核（10-20天）

5. **备案成功**
   - 获得ICP备案号
   - 网站底部显示备案号

**注意：**
- ⚠️ 只有使用国内服务器才需要备案
- ⚠️ Vercel（方案一）不需要备案
- ⚠️ 备案期间域名无法访问（可以先用临时域名）

---

### Q8: 数据库用 SQLite 可以吗？必须用 PostgreSQL 吗？

**答：必须用 PostgreSQL（或其他生产级数据库）**

**为什么不能用 SQLite：**
- ❌ Vercel/Railway 不支持文件系统持久化
- ❌ 每次部署会丢失数据
- ❌ 不支持并发写入
- ❌ 性能差

**PostgreSQL 优势：**
- ✅ 云数据库独立部署，数据永久保存
- ✅ 支持高并发
- ✅ 免费额度（Neon 3GB）
- ✅ 自动备份

**修改方法：**

编辑 `prisma/schema.prisma`：

```prisma
datasource db {
  provider = "postgresql"  // 改这里
  url      = env("DATABASE_URL")
}
```

然后运行：
```bash
pnpm db:generate
pnpm db:push
```

---

### Q9: 部署后如何更新代码？

**Vercel（方案一）：**
```bash
# 本地修改代码后
git add .
git commit -m "更新描述"
git push origin main

# Vercel 自动检测到 push，自动构建部署
# 约2-5分钟后生效
```

**阿里云/腾讯云（方案二）：**
```bash
# 1. 连接服务器
ssh root@your-server-ip

# 2. 进入项目目录
cd /app/zhidian-ai/app

# 3. 拉取最新代码
git pull origin main

# 4. 重启容器
cd ..
docker-compose down
docker-compose up -d --build

# 5. 查看日志
docker-compose logs -f app
```

---

### Q10: 成本大概多少？如何控制成本？

**方案一成本明细（Vercel + Cloudflare）：**

| 项目 | 费用 | 备注 |
|------|------|------|
| 域名 | ¥50-100/年 | 首年优惠，续费稍贵 |
| Vercel | ¥0 | Hobby计划免费 |
| Cloudflare | ¥0 | 免费计划 |
| Neon PostgreSQL | ¥0 | 3GB免费 |
| **总计** | **¥50-100/年** | **约 ¥4-8/月** |

**什么时候需要升级：**
- Vercel：流量超100GB/月（升级到Pro $20/月）
- Neon：存储超3GB（升级到Pro $19/月）

**方案二成本明细（阿里云）：**

| 项目 | 费用 | 备注 |
|------|------|------|
| ECS服务器（2核4G） | ¥150-250/月 | 按年付费有折扣 |
| PostgreSQL数据库 | ¥50-100/月 | 或使用Docker自建免费 |
| 带宽费用 | 包含在服务器费用中 | 超出按量计费 |
| **总计** | **¥200-350/月** | **约 ¥2400-4200/年** |

**省钱建议：**
1. ✅ 优先使用方案一，够用且便宜
2. ✅ 阿里云/腾讯云按年付费有折扣（约7-8折）
3. ✅ 关注云服务商促销活动（双11、618）
4. ✅ 使用CDN降低服务器带宽成本
5. ✅ 定期清理数据库无用数据

---

## 📞 技术支持

### 遇到问题怎么办？

**1. 查看文档**
- 本文档（DEPLOYMENT-CHINA.md）
- 主部署文档（DEPLOYMENT.md）
- 项目README（CLAUDE.md）

**2. 自助排查**
```bash
# 检查DNS解析
nslookup your-domain.com

# 检查服务状态
curl -I https://your-domain.com

# 查看Vercel部署日志
vercel logs

# 查看数据库连接
DATABASE_URL="..." npx prisma studio
```

**3. 日志查看**

**Vercel：**
- Dashboard → 项目 → Deployments → 最新部署 → Function Logs

**阿里云/腾讯云：**
```bash
# 应用日志
docker-compose logs -f app

# Nginx日志
tail -f /var/log/nginx/zhidian-error.log
```

**4. 常见错误代码**

| 错误码 | 原因 | 解决方法 |
|--------|------|---------|
| 502 Bad Gateway | Vercel域名未绑定 | 在Vercel添加自定义域名 |
| 504 Gateway Timeout | 数据库连接超时 | 检查DATABASE_URL配置 |
| ECONNREFUSED | 端口未开放 | 检查防火墙和Docker端口映射 |
| Prisma Client未生成 | 构建步骤缺失 | 确保运行了`pnpm db:generate` |

**5. 获取帮助**
- 📧 邮件：在项目README查找联系方式
- 💬 GitHub Issues：提交问题到项目仓库
- 📚 官方文档：
  - [Vercel文档](https://vercel.com/docs)
  - [Cloudflare文档](https://developers.cloudflare.com/)
  - [Neon文档](https://neon.tech/docs)

---

## 🎓 学习资源

### 相关技术文档

- **Next.js部署**: https://nextjs.org/docs/deployment
- **Prisma迁移**: https://www.prisma.io/docs/concepts/components/prisma-migrate
- **Docker教程**: https://docs.docker.com/get-started/
- **Nginx配置**: https://nginx.org/en/docs/

### 视频教程推荐

- B站搜索：「Vercel部署Next.js」
- B站搜索：「Cloudflare CDN配置」
- B站搜索：「阿里云服务器配置」

---

## ✅ 部署检查清单

部署前请确认：

**环境准备：**
- [ ] 已购买域名（如需方案一）
- [ ] 已注册Cloudflare账号（如需方案一）
- [ ] 已注册Vercel账号
- [ ] 已注册Neon账号（或其他PostgreSQL提供商）
- [ ] 已获取所有必需的API Key（ZenMux、TikHub等）

**代码准备：**
- [ ] 已将 `prisma/schema.prisma` 改为 PostgreSQL
- [ ] 已运行 `pnpm deploy:check` 验证构建成功
- [ ] 已配置所有环境变量
- [ ] 已删除 `DEV_LOGIN_CODE`（生产环境禁止）

**部署步骤：**
- [ ] 已完成Vercel部署
- [ ] 已配置Cloudflare CDN
- [ ] 已绑定自定义域名
- [ ] 已初始化数据库（`db:push`）
- [ ] 已创建管理员账户

**验证测试：**
- [ ] 访问域名正常加载
- [ ] 登录功能正常
- [ ] 对话功能正常
- [ ] 速度测试通过（< 2秒）
- [ ] 移动端访问正常

---

**祝您部署顺利！🚀**

如有疑问，欢迎参考上述常见问题或联系技术支持。
