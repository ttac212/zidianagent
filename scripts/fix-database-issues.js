#!/usr/bin/env node

/**
 * 数据库问题修复工具
 * 解决外键约束、孤立记录、性能优化等问题
 */

const { PrismaClient } = require('@prisma/client')

class DatabaseHealthFixer {
  constructor() {
    this.prisma = new PrismaClient({
      log: ['warn', 'error']
    })
  }

  async runHealthCheck() {
    console.log('🔧 开始数据库健康检查和修复...\n')
    
    try {
      await this.prisma.$connect()
      console.log('✅ 数据库连接成功')
      
      // 1. 检查并修复孤立的UsageStats记录
      await this.fixOrphanedUsageStats()
      
      // 2. 应用SQLite优化配置
      await this.applySqliteOptimizations()
      
      // 3. 验证外键约束
      await this.validateForeignKeys()
      
      // 4. 重建索引（如果需要）
      await this.optimizeIndexes()
      
      // 5. 数据库完整性检查
      await this.checkDataIntegrity()
      
      console.log('\n🎉 数据库健康检查和修复完成!')
      
    } catch (error) {
      console.error('❌ 修复过程中出现错误:', error)
      throw error
    } finally {
      await this.prisma.$disconnect()
    }
  }

  async fixOrphanedUsageStats() {
    console.log('\n1️⃣ 检查孤立的UsageStats记录...')
    
    try {
      // 找出没有对应用户的UsageStats记录
      const orphanedStats = await this.prisma.$queryRaw`
        SELECT DISTINCT us.userId 
        FROM usage_stats us 
        LEFT JOIN users u ON us.userId = u.id 
        WHERE u.id IS NULL
      `
      
      if (orphanedStats.length === 0) {
        console.log('✅ 未发现孤立的UsageStats记录')
        return
      }
      
      console.log(`⚠️  发现 ${orphanedStats.length} 个孤立用户ID的统计记录`)
      
      // 删除孤立记录
      for (const orphan of orphanedStats) {
        const deletedCount = await this.prisma.usageStats.deleteMany({
          where: { userId: orphan.userId }
        })
        console.log(`   删除用户 ${orphan.userId} 的 ${deletedCount.count} 条孤立记录`)
      }
      
      console.log('✅ 孤立记录清理完成')
      
    } catch (error) {
      console.error('❌ 清理孤立记录失败:', error.message)
      throw error
    }
  }

  async applySqliteOptimizations() {
    console.log('\n2️⃣ 应用SQLite优化配置...')
    
    const optimizations = [
      { cmd: 'PRAGMA journal_mode=WAL', desc: '启用WAL模式' },
      { cmd: 'PRAGMA cache_size=-16000', desc: '设置缓存大小(16MB)' },
      { cmd: 'PRAGMA synchronous=NORMAL', desc: '优化同步模式' },
      { cmd: 'PRAGMA busy_timeout=30000', desc: '设置繁忙超时(30s)' },
      { cmd: 'PRAGMA temp_store=memory', desc: '使用内存临时表' },
      { cmd: 'PRAGMA wal_autocheckpoint=1000', desc: 'WAL自动检查点' },
      { cmd: 'PRAGMA foreign_keys=ON', desc: '启用外键约束' }
    ]
    
    for (const opt of optimizations) {
      try {
        await this.prisma.$executeRawUnsafe(opt.cmd)
        console.log(`✅ ${opt.desc}`)
      } catch (error) {
        console.warn(`⚠️  ${opt.desc} 失败: ${error.message}`)
      }
    }
    
    // 验证配置
    try {
      const journalMode = await this.prisma.$queryRawUnsafe('PRAGMA journal_mode')
      const cacheSize = await this.prisma.$queryRawUnsafe('PRAGMA cache_size')
      const busyTimeout = await this.prisma.$queryRawUnsafe('PRAGMA busy_timeout')
      
      console.log(`   当前配置: journal_mode=${journalMode[0].journal_mode}, cache_size=${cacheSize[0].cache_size}, busy_timeout=${busyTimeout[0].busy_timeout}`)
    } catch (error) {
      console.warn('配置验证失败:', error.message)
    }
  }

  async validateForeignKeys() {
    console.log('\n3️⃣ 验证外键约束...')
    
    try {
      const result = await this.prisma.$queryRawUnsafe('PRAGMA foreign_key_check')
      
      if (result.length === 0) {
        console.log('✅ 外键约束验证通过')
      } else {
        console.warn('⚠️  发现外键约束问题:')
        result.forEach((issue, index) => {
          console.log(`   ${index + 1}. 表: ${issue.table}, 行ID: ${issue.rowid}, 父表: ${issue.parent}`)
        })
      }
    } catch (error) {
      console.error('❌ 外键验证失败:', error.message)
    }
  }

  async optimizeIndexes() {
    console.log('\n4️⃣ 索引优化...')
    
    try {
      // 重新分析统计信息
      await this.prisma.$executeRawUnsafe('ANALYZE')
      console.log('✅ 重新分析统计信息完成')
      
      // 检查索引使用情况
      const indexStats = await this.prisma.$queryRawUnsafe(`
        SELECT name, tbl_name, rootpage 
        FROM sqlite_master 
        WHERE type='index' AND tbl_name='usage_stats'
        ORDER BY name
      `)
      
      console.log(`   usage_stats表共有 ${indexStats.length} 个索引`)
      indexStats.forEach(idx => {
        console.log(`   - ${idx.name} (页: ${idx.rootpage})`)
      })
      
    } catch (error) {
      console.error('❌ 索引优化失败:', error.message)
    }
  }

  async checkDataIntegrity() {
    console.log('\n5️⃣ 数据完整性检查...')
    
    try {
      // 检查数据库完整性
      const integrityCheck = await this.prisma.$queryRawUnsafe('PRAGMA integrity_check(10)')
      
      if (integrityCheck.length === 1 && integrityCheck[0].integrity_check === 'ok') {
        console.log('✅ 数据库完整性检查通过')
      } else {
        console.warn('⚠️  数据库完整性问题:')
        integrityCheck.forEach((issue, index) => {
          console.log(`   ${index + 1}. ${issue.integrity_check}`)
        })
      }
      
      // 统计表记录数
      const stats = await this.getTableStats()
      console.log('\n📊 数据库统计:')
      Object.entries(stats).forEach(([table, count]) => {
        console.log(`   ${table}: ${count} 条记录`)
      })
      
    } catch (error) {
      console.error('❌ 完整性检查失败:', error.message)
    }
  }

  async getTableStats() {
    const tables = [
      'users', 'conversations', 'messages', 'usage_stats', 
      'invite_codes', 'merchants', 'documents'
    ]
    
    const stats = {}
    
    for (const table of tables) {
      try {
        const result = await this.prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${table}`)
        stats[table] = result[0].count
      } catch (error) {
        stats[table] = 'Error'
      }
    }
    
    return stats
  }
}

// 运行修复
async function main() {
  const fixer = new DatabaseHealthFixer()
  try {
    await fixer.runHealthCheck()
    process.exit(0)
  } catch (error) {
    console.error('\n💥 数据库修复失败:', error.message)
    process.exit(1)
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main()
}

module.exports = { DatabaseHealthFixer }