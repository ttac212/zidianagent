#!/bin/bash

# 智点AI平台 - 服务器初始化脚本
# 用途：在全新的Ubuntu 22.04服务器上一键安装所有必需软件
# 使用：chmod +x setup-server.sh && sudo ./setup-server.sh

set -e  # 遇到错误立即退出

echo "========================================="
echo "智点AI平台 - 服务器初始化"
echo "========================================="

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo "错误：请使用root权限运行此脚本"
    echo "使用方法：sudo ./setup-server.sh"
    exit 1
fi

# 1. 更新系统
echo ""
echo "[1/8] 更新系统软件包..."
apt update && apt upgrade -y

# 2. 安装基础工具
echo ""
echo "[2/8] 安装基础工具..."
apt install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    ufw \
    fail2ban \
    unzip \
    ca-certificates \
    gnupg \
    lsb-release

# 3. 安装Docker
echo ""
echo "[3/8] 安装Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
    echo "✓ Docker安装成功"
else
    echo "✓ Docker已安装，跳过"
fi

# 4. 安装Docker Compose
echo ""
echo "[4/8] 安装Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    apt install -y docker-compose
    echo "✓ Docker Compose安装成功"
else
    echo "✓ Docker Compose已安装，跳过"
fi

# 5. 安装Node.js和pnpm（用于本地管理脚本）
echo ""
echo "[5/8] 安装Node.js 20 和 pnpm..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    npm install -g pnpm@9.6.0
    echo "✓ Node.js和pnpm安装成功"
else
    echo "✓ Node.js已安装，跳过"
fi

# 6. 安装Nginx
echo ""
echo "[6/8] 安装Nginx..."
if ! command -v nginx &> /dev/null; then
    apt install -y nginx
    systemctl start nginx
    systemctl enable nginx
    echo "✓ Nginx安装成功"
else
    echo "✓ Nginx已安装，跳过"
fi

# 7. 安装Certbot（Let's Encrypt SSL证书）
echo ""
echo "[7/8] 安装Certbot..."
if ! command -v certbot &> /dev/null; then
    apt install -y certbot python3-certbot-nginx
    echo "✓ Certbot安装成功"
else
    echo "✓ Certbot已安装，跳过"
fi

# 8. 配置防火墙
echo ""
echo "[8/8] 配置防火墙..."
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw reload
echo "✓ 防火墙配置完成"

# 创建项目目录
echo ""
echo "创建项目目录..."
mkdir -p /app/zhidian-ai
chown -R $SUDO_USER:$SUDO_USER /app/zhidian-ai
echo "✓ 项目目录创建完成：/app/zhidian-ai"

# 显示版本信息
echo ""
echo "========================================="
echo "安装完成！版本信息："
echo "========================================="
echo "Docker版本：$(docker --version)"
echo "Docker Compose版本：$(docker-compose --version)"
echo "Node.js版本：$(node --version)"
echo "pnpm版本：$(pnpm --version)"
echo "Nginx版本：$(nginx -v 2>&1)"
echo "========================================="
echo ""
echo "下一步操作："
echo "1. 将项目代码上传到：/app/zhidian-ai"
echo "2. 配置环境变量：.env.production"
echo "3. 配置Nginx：/etc/nginx/sites-available/zhidian-ai"
echo "4. 启动服务：cd /app/zhidian-ai && docker-compose up -d"
echo ""
echo "详细步骤请参考：DEPLOYMENT-CHINA.md"
echo ""
