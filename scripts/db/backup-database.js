#!/usr/bin/env node
/**
 * 智点AI平台 - 数据库备份脚本
 * 
 * 功能:
 * 1. 支持SQLite和PostgreSQL数据库备份
 * 2. 自动创建带时间戳的备份文件
 * 3. 支持多种备份策略(完整备份/增量备份/结构备份)
 * 4. 自动清理过期备份文件
 * 
 * 使用方法:
 * node scripts/backup-database.js [选项]
 * 
 * 选项:
 * --type=full|schema|data    备份类型(默认:full)
 * --keep=7                   保留天数(默认:7天)
 * --format=db|sql            备份格式(默认:db)
 * --compress                 是否压缩(可选)
 */

const fs = require('fs')
const path = require('path')
const { execSync, spawn } = require('child_process')
const { createReadStream, createWriteStream } = require('fs')
const { createGzip } = require('zlib')

// 备份配置
const BACKUP_CONFIG = {
  // 备份目录
  backupDir: path.join(__dirname, '../backups/database'),
  
  // SQLite数据库路径
  sqliteDbPath: path.join(__dirname, '../prisma/dev.db'),
  
  // Prisma Schema路径
  schemaPath: path.join(__dirname, '../prisma/schema.prisma'),
  
  // 默认保留天数
  defaultKeepDays: 7,
  
  // 支持的备份类型
  backupTypes: ['full', 'schema', 'data'],
  
  // 支持的备份格式
  formats: ['db', 'sql']
}

class DatabaseBackup {
  constructor(options = {}) {
    this.options = {
      type: options.type || 'full',
      keepDays: parseInt(options.keep) || BACKUP_CONFIG.defaultKeepDays,
      format: options.format || 'db',
      compress: options.compress || false,
      ...options
    }
    
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]
    this.backupDir = path.join(BACKUP_CONFIG.backupDir, new Date().toISOString().split('T')[0])
  }

  /**
   * 执行数据库备份
   */
  async execute() {
    try {
      // 创建备份目录
      await this.ensureBackupDirectory()
      
      // 执行备份
      const backupFile = await this.performBackup()
      
      // 验证备份
      await this.verifyBackup(backupFile)
      
      // 清理过期备份
      await this.cleanupOldBackups()
      
      // 生成备份报告
      const report = await this.generateBackupReport(backupFile)
      
      }`)
      
      return { success: true, backupFile, report }
      
    } catch (error) {
      throw error
    }
  }

  /**
   * 确保备份目录存在
   */
  async ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true })
      }
  }

  /**
   * 执行实际备份操作
   */
  async performBackup() {
    const databaseUrl = process.env.DATABASE_URL || `file:${BACKUP_CONFIG.sqliteDbPath}`
    
    if (databaseUrl.includes('sqlite') || databaseUrl.startsWith('file:')) {
      return await this.backupSQLite()
    } else if (databaseUrl.includes('postgresql')) {
      return await this.backupPostgreSQL()
    } else {
      throw new Error('不支持的数据库类型')
    }
  }

  /**
   * SQLite数据库备份
   */
  async backupSQLite() {
    const backupFileName = `sqlite_${this.options.type}_${this.timestamp}`
    let backupFile
    
    switch (this.options.type) {
      case 'full':
        // 完整备份 - 直接复制数据库文件
        backupFile = path.join(this.backupDir, `${backupFileName}.db`)
        fs.copyFileSync(BACKUP_CONFIG.sqliteDbPath, backupFile)
        
        // 同时备份schema文件
        const schemaBackupFile = path.join(this.backupDir, `schema_${this.timestamp}.prisma`)
        fs.copyFileSync(BACKUP_CONFIG.schemaPath, schemaBackupFile)
        
        break
        
      case 'schema':
        // 仅备份数据库结构
        backupFile = path.join(this.backupDir, `${backupFileName}.sql`)
        await this.exportSQLiteSchema(backupFile)
        break
        
      case 'data':
        // 仅备份数据 (SQLite较复杂,使用完整备份)
        backupFile = path.join(this.backupDir, `${backupFileName}_dataonly.db`)
        fs.copyFileSync(BACKUP_CONFIG.sqliteDbPath, backupFile)
        `)
        break
        
      default:
        throw new Error(`不支持的备份类型: ${this.options.type}`)
    }

    // 可选压缩
    if (this.options.compress) {
      const compressedFile = await this.compressFile(backupFile)
      fs.unlinkSync(backupFile) // 删除未压缩文件
      backupFile = compressedFile
    }

    return backupFile
  }

  /**
   * PostgreSQL数据库备份
   */
  async backupPostgreSQL() {
    const backupFileName = `postgres_${this.options.type}_${this.timestamp}.sql`
    const backupFile = path.join(this.backupDir, backupFileName)
    
    // 解析数据库连接信息
    const dbUrl = new URL(process.env.DATABASE_URL)
    const dbConfig = {
      host: dbUrl.hostname,
      port: dbUrl.port || 5432,
      username: dbUrl.username,
      password: dbUrl.password,
      database: dbUrl.pathname.slice(1)
    }

    let pgDumpCmd
    
    switch (this.options.type) {
      case 'full':
        pgDumpCmd = `PGPASSWORD="${dbConfig.password}" pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database}`
        break
        
      case 'schema':
        pgDumpCmd = `PGPASSWORD="${dbConfig.password}" pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} --schema-only`
        break
        
      case 'data':
        pgDumpCmd = `PGPASSWORD="${dbConfig.password}" pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} --data-only`
        break
        
      default:
        throw new Error(`不支持的备份类型: ${this.options.type}`)
    }

    try {
      const output = execSync(pgDumpCmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 })
      fs.writeFileSync(backupFile, output)
      } catch (error) {
      throw new Error(`PostgreSQL备份失败: ${error.message}`)
    }

    // 可选压缩
    if (this.options.compress) {
      const compressedFile = await this.compressFile(backupFile)
      fs.unlinkSync(backupFile)
      return compressedFile
    }

    return backupFile
  }

  /**
   * 导出SQLite数据库结构
   */
  async exportSQLiteSchema(outputFile) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', ['-e', `
        const { PrismaClient } = require('@prisma/client')
        const fs = require('fs')
        
        async function exportSchema() {
          const prisma = new PrismaClient()
          try {
            // 获取所有表的结构
            const tables = await prisma.$queryRaw\`
              SELECT sql FROM sqlite_master 
              WHERE type='table' AND name NOT LIKE 'sqlite_%'
            \`
            
            let schemaSQL = '-- SQLite Schema Export\\n'
            schemaSQL += '-- Generated on: ' + new Date().toISOString() + '\\n\\n'
            
            tables.forEach(table => {
              if (table.sql) {
                schemaSQL += table.sql + ';\\n\\n'
              }
            })
            
            fs.writeFileSync('${outputFile}', schemaSQL)
            } catch (error) {
            process.exit(1)
          } finally {
            await prisma.$disconnect()
          }
        }
        
        exportSchema()
      `])

      child.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Schema导出失败，退出码: ${code}`))
        }
      })
    })
  }

  /**
   * 压缩备份文件
   */
  async compressFile(filePath) {
    return new Promise((resolve, reject) => {
      const compressedPath = `${filePath}.gz`
      const readStream = createReadStream(filePath)
      const writeStream = createWriteStream(compressedPath)
      const gzip = createGzip()

      readStream
        .pipe(gzip)
        .pipe(writeStream)
        .on('finish', () => {
          }`)
          resolve(compressedPath)
        })
        .on('error', reject)
    })
  }

  /**
   * 验证备份文件
   */
  async verifyBackup(backupFile) {
    try {
      const stats = fs.statSync(backupFile)
      
      if (stats.size === 0) {
        throw new Error('备份文件为空')
      }
      
      }`)
      
      // 对于SQLite文件，可以尝试打开验证
      if (backupFile.endsWith('.db') && !backupFile.endsWith('.gz')) {
        await this.verifySQLiteBackup(backupFile)
      }
      
      return true
      
    } catch (error) {
      throw new Error(`备份文件验证失败: ${error.message}`)
    }
  }

  /**
   * 验证SQLite备份文件
   */
  async verifySQLiteBackup(backupFile) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', ['-e', `
        const { PrismaClient } = require('@prisma/client')
        
        async function verifyBackup() {
          const prisma = new PrismaClient({
            datasources: {
              db: { url: 'file:${backupFile}' }
            }
          })
          
          try {
            // 尝试查询用户表验证
            const userCount = await prisma.user.count()
            } catch (error) {
            process.exit(1)
          } finally {
            await prisma.$disconnect()
          }
        }
        
        verifyBackup()
      `])

      child.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`SQLite备份验证失败`))
        }
      })
    })
  }

  /**
   * 清理过期备份文件
   */
  async cleanupOldBackups() {
    try {
      const backupRootDir = BACKUP_CONFIG.backupDir
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.options.keepDays)
      
      if (!fs.existsSync(backupRootDir)) {
        return
      }

      const directories = fs.readdirSync(backupRootDir)
        .filter(dir => {
          const dirPath = path.join(backupRootDir, dir)
          return fs.statSync(dirPath).isDirectory()
        })

      let cleanedCount = 0
      let cleanedSize = 0

      for (const dir of directories) {
        const dirDate = new Date(dir)
        
        if (dirDate < cutoffDate) {
          const dirPath = path.join(backupRootDir, dir)
          const files = fs.readdirSync(dirPath)
          
          for (const file of files) {
            const filePath = path.join(dirPath, file)
            const stats = fs.statSync(filePath)
            cleanedSize += stats.size
            fs.unlinkSync(filePath)
          }
          
          fs.rmdirSync(dirPath)
          cleanedCount++
          }
      }

      if (cleanedCount > 0) {
        }`)
      }

    } catch (error) {
      }
  }

  /**
   * 生成备份报告
   */
  async generateBackupReport(backupFile) {
    const stats = fs.statSync(backupFile)
    
    const report = {
      timestamp: new Date().toISOString(),
      backupType: this.options.type,
      backupFormat: this.options.format,
      backupFile: path.basename(backupFile),
      fileSize: stats.size,
      fileSizeFormatted: this.formatFileSize(stats.size),
      compressed: this.options.compress,
      keepDays: this.options.keepDays,
      databaseType: process.env.DATABASE_URL?.includes('postgresql') ? 'PostgreSQL' : 'SQLite'
    }

    // 保存报告文件
    const reportFile = path.join(this.backupDir, `backup_report_${this.timestamp}.json`)
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2))

    return report
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// 命令行接口
async function main() {
  try {
    // 解析命令行参数
    const args = process.argv.slice(2)
    const options = {}
    
    args.forEach(arg => {
      if (arg.startsWith('--')) {
        const [key, value] = arg.substring(2).split('=')
        options[key] = value || true
      }
    })

    // 显示帮助信息
    if (options.help) {
      full    - 完整备份(数据+结构)
    schema  - 仅备份数据库结构
    data    - 仅备份数据
  
  --keep=7                   保留天数 (默认: 7天)
  --format=db|sql           备份格式 (默认: db)
  --compress                是否压缩备份文件
  --help                    显示帮助信息

示例:
  node scripts/backup-database.js                    # 默认完整备份
  node scripts/backup-database.js --type=schema      # 仅备份结构
  node scripts/backup-database.js --compress         # 压缩备份
  node scripts/backup-database.js --keep=30          # 保留30天
      `)
      return
    }

    // 执行备份
    const backup = new DatabaseBackup(options)
    const result = await backup.execute()
    
    process.exit(0)
    
  } catch (error) {
    process.exit(1)
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main()
}

module.exports = { DatabaseBackup }