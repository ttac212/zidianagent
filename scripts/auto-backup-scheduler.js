#!/usr/bin/env node
/**
 * 智点AI平台 - 自动化备份调度器
 * 
 * 功能:
 * 1. 定时自动备份数据库
 * 2. 支持多种备份策略和频率
 * 3. 自动清理过期备份
 * 4. 备份健康监控和告警
 * 5. 支持云存储上传
 * 
 * 使用方法:
 * node scripts/auto-backup-scheduler.js [选项]
 * 
 * 或作为服务运行:
 * pm2 start scripts/auto-backup-scheduler.js --name="db-backup-scheduler"
 */

const cron = require('node-cron')
const fs = require('fs')
const path = require('path')
const { DatabaseBackup } = require('./backup-database')

// 自动备份配置
const AUTO_BACKUP_CONFIG = {
  // 备份计划配置
  schedules: {
    // 每日完整备份 (凌晨2点)
    daily: {
      enabled: true,
      cron: '0 2 * * *',
      type: 'full',
      compress: true,
      keepDays: 30,
      description: '每日完整备份'
    },
    
    // 每6小时增量备份
    incremental: {
      enabled: true,
      cron: '0 */6 * * *',
      type: 'data',
      compress: true,
      keepDays: 7,
      description: '每6小时增量备份'
    },
    
    // 每周结构备份 (周日凌晨1点)
    weekly: {
      enabled: true,
      cron: '0 1 * * 0',
      type: 'schema',
      compress: false,
      keepDays: 90,
      description: '每周结构备份'
    },
    
    // 每月归档备份 (每月1号凌晨0点)
    monthly: {
      enabled: true,
      cron: '0 0 1 * *',
      type: 'full',
      compress: true,
      keepDays: 365,
      description: '每月归档备份'
    }
  },
  
  // 监控配置
  monitoring: {
    enabled: true,
    healthCheckInterval: 60 * 1000, // 60秒
    alertThreshold: 3, // 连续失败3次后告警
    maxBackupSize: 500 * 1024 * 1024, // 500MB
    minBackupSize: 1024, // 1KB
  },
  
  // 通知配置
  notifications: {
    enabled: false,
    webhook: process.env.BACKUP_WEBHOOK_URL,
    email: process.env.BACKUP_EMAIL,
    slack: process.env.BACKUP_SLACK_WEBHOOK
  },
  
  // 云存储配置
  cloudStorage: {
    enabled: false,
    provider: 'aws', // aws, azure, gcp
    config: {
      bucket: process.env.BACKUP_S3_BUCKET,
      accessKey: process.env.BACKUP_S3_ACCESS_KEY,
      secretKey: process.env.BACKUP_S3_SECRET_KEY,
      region: process.env.BACKUP_S3_REGION || 'us-east-1'
    }
  }
}

class AutoBackupScheduler {
  constructor(config = AUTO_BACKUP_CONFIG) {
    this.config = config
    this.jobs = new Map()
    this.stats = {
      totalBackups: 0,
      successfulBackups: 0,
      failedBackups: 0,
      lastBackupTime: null,
      consecutiveFailures: 0,
      startTime: new Date()
    }
    
    // 加载历史统计
    this.loadStats()
  }

  /**
   * 启动自动备份调度器
   */
  start() {
    .toISOString()}`)
    
    // 注册所有备份任务
    this.registerBackupJobs()
    
    // 启动健康监控
    if (this.config.monitoring.enabled) {
      this.startHealthMonitoring()
    }
    
    // 显示调度状态
    this.displayScheduleStatus()
    
    // 注册进程退出处理
    this.registerExitHandlers()
    
    }

  /**
   * 注册所有备份任务
   */
  registerBackupJobs() {
    const schedules = this.config.schedules
    
    Object.entries(schedules).forEach(([name, schedule]) => {
      if (!schedule.enabled) {
        return
      }
      
      try {
        const job = cron.schedule(schedule.cron, () => {
          this.executeBackupJob(name, schedule)
        }, {
          scheduled: false,
          timezone: 'Asia/Shanghai'
        })
        
        this.jobs.set(name, job)
        job.start()
        
        } catch (error) {
        }
    })
  }

  /**
   * 执行备份任务
   */
  async executeBackupJob(jobName, schedule) {
    const startTime = Date.now()
    
    try {
      .toISOString()}`)
      
      // 创建备份实例
      const backup = new DatabaseBackup({
        type: schedule.type,
        format: 'db',
        compress: schedule.compress,
        keep: schedule.keepDays
      })
      
      // 执行备份
      const result = await backup.execute()
      
      // 更新统计信息
      this.updateStats(true, Date.now() - startTime)
      
      // 记录成功日志
      await this.logBackupResult(jobName, true, result, Date.now() - startTime)
      
      // 发送成功通知
      if (this.config.notifications.enabled) {
        await this.sendNotification('success', jobName, result)
      }
      
      // 上传到云存储
      if (this.config.cloudStorage.enabled) {
        await this.uploadToCloud(result.backupFile)
      }
      
      - startTime}ms`)
      
    } catch (error) {
      // 更新统计信息
      this.updateStats(false, Date.now() - startTime)
      
      // 记录失败日志
      await this.logBackupResult(jobName, false, { error: error.message }, Date.now() - startTime)
      
      // 发送失败通知
      if (this.config.notifications.enabled) {
        await this.sendNotification('error', jobName, { error: error.message })
      }
      
      // 检查是否需要告警
      this.checkAlertThreshold()
    }
  }

  /**
   * 更新统计信息
   */
  updateStats(success, duration) {
    this.stats.totalBackups++
    
    if (success) {
      this.stats.successfulBackups++
      this.stats.consecutiveFailures = 0
      this.stats.lastBackupTime = new Date()
    } else {
      this.stats.failedBackups++
      this.stats.consecutiveFailures++
    }
    
    // 持久化统计信息
    this.saveStats()
  }

  /**
   * 记录备份结果
   */
  async logBackupResult(jobName, success, result, duration) {
    const logDir = path.join(__dirname, '../logs/backup')
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      jobName,
      success,
      duration,
      result,
      stats: { ...this.stats }
    }
    
    const logFile = path.join(logDir, `backup-${new Date().toISOString().split('T')[0]}.log`)
    const logLine = JSON.stringify(logEntry) + '\n'
    
    fs.appendFileSync(logFile, logLine)
  }

  /**
   * 启动健康监控
   */
  startHealthMonitoring() {
    setInterval(() => {
      this.performHealthCheck()
    }, this.config.monitoring.healthCheckInterval)
    
    }

  /**
   * 执行健康检查
   */
  performHealthCheck() {
    const now = Date.now()
    const stats = this.stats
    
    // 检查最近备份时间
    const timeSinceLastBackup = stats.lastBackupTime 
      ? now - stats.lastBackupTime.getTime()
      : now - stats.startTime.getTime()
      
    const hoursSinceLastBackup = timeSinceLastBackup / (1000 * 60 * 60)
    
    // 健康检查指标
    const healthMetrics = {
      timestamp: new Date().toISOString(),
      totalBackups: stats.totalBackups,
      successRate: stats.totalBackups > 0 
        ? ((stats.successfulBackups / stats.totalBackups) * 100).toFixed(2)
        : 0,
      consecutiveFailures: stats.consecutiveFailures,
      hoursSinceLastBackup: hoursSinceLastBackup.toFixed(1),
      runningTime: ((now - stats.startTime.getTime()) / (1000 * 60 * 60)).toFixed(1)
    }
    
    // 检查异常情况
    const issues = []
    
    if (stats.consecutiveFailures >= this.config.monitoring.alertThreshold) {
      issues.push(`连续失败 ${stats.consecutiveFailures} 次`)
    }
    
    if (hoursSinceLastBackup > 25) { // 超过25小时没有成功备份
      issues.push(`超过${hoursSinceLastBackup.toFixed(1)}小时未成功备份`)
    }
    
    // 记录健康状态
    if (issues.length > 0) {
      }`)
      
      if (this.config.notifications.enabled) {
        this.sendHealthAlert(healthMetrics, issues)
      }
    } else {
      // 每小时输出一次健康状态
      if (Math.floor(now / (1000 * 60 * 60)) !== Math.floor((now - this.config.monitoring.healthCheckInterval) / (1000 * 60 * 60))) {
        }
    }
  }

  /**
   * 检查告警阈值
   */
  checkAlertThreshold() {
    if (this.stats.consecutiveFailures >= this.config.monitoring.alertThreshold) {
      if (this.config.notifications.enabled) {
        this.sendCriticalAlert()
      }
    }
  }

  /**
   * 发送通知
   */
  async sendNotification(type, jobName, data) {
    try {
      const notification = {
        type,
        jobName,
        timestamp: new Date().toISOString(),
        data,
        stats: { ...this.stats }
      }
      
      // Webhook通知
      if (this.config.notifications.webhook) {
        await this.sendWebhookNotification(notification)
      }
      
      // 邮件通知 (需要实现)
      if (this.config.notifications.email) {
        await this.sendEmailNotification(notification)
      }
      
      // Slack通知 (需要实现)
      if (this.config.notifications.slack) {
        await this.sendSlackNotification(notification)
      }
      
    } catch (error) {
      }
  }

  /**
   * 发送Webhook通知
   */
  async sendWebhookNotification(notification) {
    const fetch = require('node-fetch')
    
    const response = await fetch(this.config.notifications.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification)
    })
    
    if (!response.ok) {
      throw new Error(`Webhook响应错误: ${response.status}`)
    }
    
    }

  /**
   * 发送健康告警
   */
  async sendHealthAlert(metrics, issues) {
    const alert = {
      type: 'health_alert',
      severity: 'warning',
      timestamp: new Date().toISOString(),
      message: `备份系统健康告警: ${issues.join(', ')}`,
      metrics,
      issues
    }
    
    if (this.config.notifications.webhook) {
      await this.sendWebhookNotification(alert)
    }
  }

  /**
   * 发送严重告警
   */
  async sendCriticalAlert() {
    const alert = {
      type: 'critical_alert',
      severity: 'critical',
      timestamp: new Date().toISOString(),
      message: `数据库备份系统严重故障: 连续失败 ${this.stats.consecutiveFailures} 次`,
      stats: { ...this.stats }
    }
    
    if (this.config.notifications.webhook) {
      await this.sendWebhookNotification(alert)
    }
  }

  /**
   * 上传到云存储
   */
  async uploadToCloud(backupFile) {
    try {
      // 根据配置的云存储提供商执行上传
      switch (this.config.cloudStorage.provider) {
        case 'aws':
          await this.uploadToS3(backupFile)
          break
        case 'azure':
          await this.uploadToAzure(backupFile)
          break
        case 'gcp':
          await this.uploadToGCP(backupFile)
          break
        default:
          throw new Error(`不支持的云存储提供商: ${this.config.cloudStorage.provider}`)
      }
      
      } catch (error) {
      throw error
    }
  }

  /**
   * 上传到AWS S3
   */
  async uploadToS3(backupFile) {
    // 简化的S3上传逻辑 (需要安装aws-sdk)
    const AWS = require('aws-sdk')
    
    const s3 = new AWS.S3({
      accessKeyId: this.config.cloudStorage.config.accessKey,
      secretAccessKey: this.config.cloudStorage.config.secretKey,
      region: this.config.cloudStorage.config.region
    })
    
    const fileStream = fs.createReadStream(backupFile)
    const fileName = path.basename(backupFile)
    const s3Key = `database-backups/${new Date().toISOString().split('T')[0]}/${fileName}`
    
    const uploadParams = {
      Bucket: this.config.cloudStorage.config.bucket,
      Key: s3Key,
      Body: fileStream,
      ServerSideEncryption: 'AES256'
    }
    
    await s3.upload(uploadParams).promise()
    }

  /**
   * 显示调度状态
   */
  displayScheduleStatus() {
    this.jobs.forEach((job, name) => {
      const schedule = this.config.schedules[name]
      })
    
    - this.stats.startTime) / (1000 * 60 * 60)).toFixed(1)} 小时`)
  }

  /**
   * 加载历史统计
   */
  loadStats() {
    try {
      const statsFile = path.join(__dirname, '../temp/backup-stats.json')
      
      if (fs.existsSync(statsFile)) {
        const savedStats = JSON.parse(fs.readFileSync(statsFile, 'utf8'))
        
        // 合并统计信息，但保持启动时间
        this.stats = {
          ...savedStats,
          startTime: new Date(),
          lastBackupTime: savedStats.lastBackupTime ? new Date(savedStats.lastBackupTime) : null
        }
        
        }
      
    } catch (error) {
      }
  }

  /**
   * 保存统计信息
   */
  saveStats() {
    try {
      const tempDir = path.join(__dirname, '../temp')
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }
      
      const statsFile = path.join(tempDir, 'backup-stats.json')
      fs.writeFileSync(statsFile, JSON.stringify(this.stats, null, 2))
      
    } catch (error) {
      }
  }

  /**
   * 停止调度器
   */
  stop() {
    // 停止所有cron任务
    this.jobs.forEach((job, name) => {
      job.stop()
      })
    
    // 保存最终统计信息
    this.saveStats()
    
    }

  /**
   * 注册进程退出处理
   */
  registerExitHandlers() {
    // 优雅退出处理
    const gracefulShutdown = (signal) => {
      this.stop()
      process.exit(0)
    }
    
    process.on('SIGTERM', gracefulShutdown)
    process.on('SIGINT', gracefulShutdown)
    
    // 未捕获异常处理
    process.on('uncaughtException', (error) => {
      this.saveStats()
      process.exit(1)
    })
    
    process.on('unhandledRejection', (reason, promise) => {
      this.saveStats()
    })
  }
}

// 命令行接口
async function main() {
  try {
    const args = process.argv.slice(2)
    const options = {}
    
    args.forEach(arg => {
      if (arg.startsWith('--')) {
        const [key, value] = arg.substring(2).split('=')
        options[key] = value || true
      }
    })

    if (options.help) {
      --status            显示调度器状态
  --help              显示帮助信息

环境变量:
  BACKUP_WEBHOOK_URL      通知Webhook地址
  BACKUP_EMAIL           通知邮箱地址
  BACKUP_SLACK_WEBHOOK   Slack通知地址
  BACKUP_S3_BUCKET       S3存储桶名称
  BACKUP_S3_ACCESS_KEY   S3访问密钥
  BACKUP_S3_SECRET_KEY   S3秘密密钥
  BACKUP_S3_REGION       S3区域

示例:
  node scripts/auto-backup-scheduler.js              # 启动调度器
  node scripts/auto-backup-scheduler.js --test       # 测试备份
  pm2 start scripts/auto-backup-scheduler.js --name="backup-scheduler"
      `)
      return
    }

    // 测试模式
    if (options.test) {
      const backup = new DatabaseBackup({
        type: 'full',
        compress: true,
        keep: 7
      })
      
      const result = await backup.execute()
      return
    }

    // 启动调度器
    const scheduler = new AutoBackupScheduler()
    scheduler.start()
    
    // 保持进程运行
    `)
    
  } catch (error) {
    process.exit(1)
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main()
}

module.exports = { AutoBackupScheduler, AUTO_BACKUP_CONFIG }