#!/bin/bash

# 智点AI平台 - 数据库恢复脚本
# 使用方法：
#   ./restore-database.sh /path/to/backup.sql.gz

set -e

if [ $# -eq 0 ]; then
    echo "错误：请提供备份文件路径"
    echo "使用方法：$0 <backup-file.sql.gz>"
    echo "示例：$0 /app/backups/database/db_20240101_120000.sql.gz"
    exit 1
fi

BACKUP_FILE=$1
PROJECT_DIR="/app/zhidian-ai"
DOCKER_COMPOSE_FILE="$PROJECT_DIR/docker-compose.production.yml"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "错误：备份文件不存在：$BACKUP_FILE"
    exit 1
fi

echo "========================================="
echo "智点AI平台 - 数据库恢复"
echo "========================================="
echo "备份文件：$BACKUP_FILE"
echo ""

read -p "警告：此操作将覆盖当前数据库！确认继续？(yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "取消操作"
    exit 0
fi

cd $PROJECT_DIR

echo ""
echo "[1/3] 停止应用..."
docker-compose -f $DOCKER_COMPOSE_FILE stop app

echo ""
echo "[2/3] 恢复数据库..."
gunzip < $BACKUP_FILE | docker-compose -f $DOCKER_COMPOSE_FILE exec -T postgres \
    psql -U zhidian zhidianai

if [ $? -eq 0 ]; then
    echo "✓ 数据库恢复成功"
else
    echo "✗ 数据库恢复失败！"
    exit 1
fi

echo ""
echo "[3/3] 重启应用..."
docker-compose -f $DOCKER_COMPOSE_FILE start app

echo ""
echo "========================================="
echo "恢复完成！"
echo "========================================="
