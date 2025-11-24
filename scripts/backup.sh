#!/bin/bash

# 智点AI平台 - 自动备份脚本
# 功能：备份PostgreSQL数据库和代码
# 使用方法：
#   1. chmod +x backup.sh
#   2. 手动运行：./backup.sh
#   3. 添加到crontab：crontab -e
#      0 2 * * * /app/zhidian-ai/backup.sh >> /var/log/backup.log 2>&1

set -e

# ========================================
# 配置部分
# ========================================

BACKUP_DIR="/app/backups"
PROJECT_DIR="/app/zhidian-ai"
DATE=$(date +%Y%m%d_%H%M%S)
DATE_ONLY=$(date +%Y%m%d)
KEEP_DAYS=7  # 保留最近7天的备份
DOCKER_COMPOSE_FILE="$PROJECT_DIR/docker-compose.production.yml"

# ========================================
# 备份函数
# ========================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# 创建备份目录
mkdir -p $BACKUP_DIR/{database,code}

# ========================================
# 1. 备份数据库
# ========================================

log "开始备份数据库..."

DB_BACKUP_FILE="$BACKUP_DIR/database/db_${DATE}.sql.gz"

# 使用docker-compose执行pg_dump
cd $PROJECT_DIR
docker-compose -f $DOCKER_COMPOSE_FILE exec -T postgres \
    pg_dump -U zhidian zhidianai \
    | gzip > $DB_BACKUP_FILE

if [ $? -eq 0 ]; then
    DB_SIZE=$(du -h $DB_BACKUP_FILE | cut -f1)
    log "✓ 数据库备份成功：$DB_BACKUP_FILE (大小: $DB_SIZE)"
else
    log "✗ 数据库备份失败！"
    exit 1
fi

# ========================================
# 2. 备份代码（可选）
# ========================================

log "开始备份代码..."

CODE_BACKUP_FILE="$BACKUP_DIR/code/code_${DATE}.tar.gz"

# 排除node_modules和.next目录
tar -czf $CODE_BACKUP_FILE \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    --exclude='prisma/dev.db' \
    -C $PROJECT_DIR/app .

if [ $? -eq 0 ]; then
    CODE_SIZE=$(du -h $CODE_BACKUP_FILE | cut -f1)
    log "✓ 代码备份成功：$CODE_BACKUP_FILE (大小: $CODE_SIZE)"
else
    log "✗ 代码备份失败！"
    exit 1
fi

# ========================================
# 3. 清理旧备份
# ========================================

log "清理 ${KEEP_DAYS} 天前的备份..."

# 删除旧的数据库备份
DELETED_DB=$(find $BACKUP_DIR/database -name "db_*.sql.gz" -mtime +$KEEP_DAYS -delete -print | wc -l)
log "✓ 删除 $DELETED_DB 个旧数据库备份"

# 删除旧的代码备份
DELETED_CODE=$(find $BACKUP_DIR/code -name "code_*.tar.gz" -mtime +$KEEP_DAYS -delete -print | wc -l)
log "✓ 删除 $DELETED_CODE 个旧代码备份"

# ========================================
# 4. 显示备份统计
# ========================================

log "========================================="
log "备份完成！"
log "========================================="
log "数据库备份数量：$(ls -1 $BACKUP_DIR/database | wc -l)"
log "代码备份数量：$(ls -1 $BACKUP_DIR/code | wc -l)"
log "总占用空间：$(du -sh $BACKUP_DIR | cut -f1)"
log "========================================="

# ========================================
# 5. 可选：上传到对象存储（阿里云OSS/腾讯云COS）
# ========================================

# 如果安装了阿里云OSS CLI工具（ossutil）
# if command -v ossutil &> /dev/null; then
#     log "上传到阿里云OSS..."
#     ossutil cp $DB_BACKUP_FILE oss://your-bucket/backups/database/
#     log "✓ 上传完成"
# fi

# 如果安装了腾讯云COS CLI工具（coscmd）
# if command -v coscmd &> /dev/null; then
#     log "上传到腾讯云COS..."
#     coscmd upload $DB_BACKUP_FILE /backups/database/
#     log "✓ 上传完成"
# fi

# ========================================
# 6. 可选：发送通知（邮件/钉钉/企业微信）
# ========================================

# 示例：使用curl发送钉钉通知
# DINGTALK_WEBHOOK="https://oapi.dingtalk.com/robot/send?access_token=xxx"
# curl -X POST $DINGTALK_WEBHOOK \
#     -H 'Content-Type: application/json' \
#     -d "{
#         \"msgtype\": \"text\",
#         \"text\": {
#             \"content\": \"智点AI备份成功\\n时间：$DATE\\n数据库：$DB_SIZE\\n代码：$CODE_SIZE\"
#         }
#     }"

exit 0
