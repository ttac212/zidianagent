/**
 * 数据库完整性检查脚本
 * 使用 Prisma Client 验证数据一致性和完整性
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error', 'warn']
})

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function log(message: string, color: keyof typeof colors = 'reset') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  }

interface CheckResult {
  name: string
  passed: boolean
  details: string
  count?: number
  issues?: any[]
}

class DatabaseIntegrityChecker {
  private results: CheckResult[] = []

  // 检查数据库连接
  async checkConnection(): Promise<CheckResult> {
    log('🔌 检查数据库连接...', 'cyan')
    
    try {
      await prisma.$connect()
      const result = await prisma.$queryRaw`SELECT 1 as test`
      
      log('✅ 数据库连接正常', 'green')
      return {
        name: '数据库连接',
        passed: true,
        details: '连接测试成功'
      }
    } catch (error) {
      log(`❌ 数据库连接失败: ${error instanceof Error ? error.message : '未知错误'}`, 'red')
      return {
        name: '数据库连接',
        passed: false,
        details: `连接失败: ${error instanceof Error ? error.message : '未知错误'}`
      }
    }
  }

  // 检查表结构和计数
  async checkTableStructure(): Promise<CheckResult> {
    log('📊 检查表结构和数据计数...', 'cyan')
    
    try {
      const counts = await Promise.all([
        prisma.user.count(),
        prisma.conversation.count(),
        prisma.message.count(),
        prisma.usageStats.count(),
        prisma.account.count(),
        prisma.session.count(),
        prisma.inviteCode.count()
      ])

      const [userCount, convCount, msgCount, statsCount, accountCount, sessionCount, inviteCount] = counts

      log(`📈 数据统计:`, 'blue')
      log(`   用户: ${userCount}`, 'blue')
      log(`   对话: ${convCount}`, 'blue') 
      log(`   消息: ${msgCount}`, 'blue')
      log(`   统计: ${statsCount}`, 'blue')
      log(`   账户: ${accountCount}`, 'blue')
      log(`   会话: ${sessionCount}`, 'blue')
      log(`   邀请码: ${inviteCount}`, 'blue')

      log('✅ 表结构检查通过', 'green')
      
      return {
        name: '表结构',
        passed: true,
        details: `所有表正常访问，总记录数: ${counts.reduce((a, b) => a + b, 0)}`
      }
    } catch (error) {
      log(`❌ 表结构检查失败: ${error instanceof Error ? error.message : '未知错误'}`, 'red')
      return {
        name: '表结构',
        passed: false,
        details: `检查失败: ${error instanceof Error ? error.message : '未知错误'}`
      }
    }
  }

  // 检查对话消息计数一致性
  async checkConversationMessageConsistency(): Promise<CheckResult> {
    log('💬 检查对话消息计数一致性...', 'cyan')
    
    try {
      // 获取所有对话及其实际消息数
      const conversations = await prisma.conversation.findMany({
        include: {
          _count: {
            select: { messages: true }
          }
        }
      })

      const inconsistentConversations = conversations.filter(conv => 
        conv.messageCount !== conv._count.messages
      )

      if (inconsistentConversations.length > 0) {
        log(`⚠️  发现 ${inconsistentConversations.length} 个对话的消息计数不一致`, 'yellow')
        
        inconsistentConversations.slice(0, 3).forEach(conv => {
          log(`   对话 ${conv.id}: 记录=${conv.messageCount}, 实际=${conv._count.messages}`, 'yellow')
        })

        return {
          name: '对话消息计数',
          passed: false,
          details: `${inconsistentConversations.length} 个对话计数不一致`,
          count: inconsistentConversations.length,
          issues: inconsistentConversations.map(c => ({
            id: c.id,
            recorded: c.messageCount,
            actual: c._count.messages
          }))
        }
      } else {
        log('✅ 对话消息计数一致性检查通过', 'green')
        return {
          name: '对话消息计数',
          passed: true,
          details: '所有对话的消息计数正确'
        }
      }
    } catch (error) {
      log(`❌ 对话消息计数检查失败: ${error instanceof Error ? error.message : '未知错误'}`, 'red')
      return {
        name: '对话消息计数',
        passed: false,
        details: `检查失败: ${error instanceof Error ? error.message : '未知错误'}`
      }
    }
  }

  // 检查Token统计一致性
  async checkTokenConsistency(): Promise<CheckResult> {
    log('🪙 检查Token统计一致性...', 'cyan')
    
    try {
      // 获取对话的Token统计
      const conversations = await prisma.conversation.findMany({
        include: {
          messages: {
            select: {
              promptTokens: true,
              completionTokens: true
            }
          }
        }
      })

      const inconsistentConversations = conversations.filter(conv => {
        const actualTokens = conv.messages.reduce((sum, msg) =>
          sum + (msg.promptTokens + msg.completionTokens), 0)
        return Math.abs(conv.totalTokens - actualTokens) > 1 // 允许1个token的误差
      })

      if (inconsistentConversations.length > 0) {
        log(`⚠️  发现 ${inconsistentConversations.length} 个对话的Token统计不一致`, 'yellow')

        inconsistentConversations.slice(0, 3).forEach(conv => {
          const actualTokens = conv.messages.reduce((sum, msg) =>
            sum + (msg.promptTokens + msg.completionTokens), 0)
          log(`   对话 ${conv.id}: 记录=${conv.totalTokens}, 实际=${actualTokens}`, 'yellow')
        })

        return {
          name: 'Token统计',
          passed: false,
          details: `${inconsistentConversations.length} 个对话Token统计不一致`,
          count: inconsistentConversations.length
        }
      } else {
        log('✅ Token统计一致性检查通过', 'green')
        return {
          name: 'Token统计',
          passed: true,
          details: '所有对话的Token统计正确'
        }
      }
    } catch (error) {
      log(`❌ Token统计检查失败: ${error instanceof Error ? error.message : '未知错误'}`, 'red')
      return {
        name: 'Token统计',
        passed: false,
        details: `检查失败: ${error instanceof Error ? error.message : '未知错误'}`
      }
    }
  }

  // 检查用户配额统计
  async checkUserUsageConsistency(): Promise<CheckResult> {
    log('👤 检查用户配额统计一致性...', 'cyan')
    
    try {
      // 获取当月开始时间
      const currentMonth = new Date()
      currentMonth.setDate(1)
      currentMonth.setHours(0, 0, 0, 0)

      const users = await prisma.user.findMany({
        include: {
          usageStats: {
            where: {
              date: {
                gte: currentMonth
              }
            }
          }
        }
      })

      const inconsistentUsers = users.filter(user => {
        const calculatedUsage = user.usageStats.reduce((sum, stat) =>
          sum + stat.promptTokens + stat.completionTokens, 0)
        return Math.abs(user.currentMonthUsage - calculatedUsage) > 10 // 允许10个token的误差
      })

      if (inconsistentUsers.length > 0) {
        log(`⚠️  发现 ${inconsistentUsers.length} 个用户的配额统计不一致`, 'yellow')
        
        inconsistentUsers.slice(0, 3).forEach(user => {
          const calculatedUsage = user.usageStats.reduce((sum, stat) =>
          sum + stat.promptTokens + stat.completionTokens, 0)
          log(`   用户 ${user.email}: 记录=${user.currentMonthUsage}, 计算=${calculatedUsage}`, 'yellow')
        })

        return {
          name: '用户配额统计',
          passed: false,
          details: `${inconsistentUsers.length} 个用户配额统计不一致`,
          count: inconsistentUsers.length
        }
      } else {
        log('✅ 用户配额统计一致性检查通过', 'green')
        return {
          name: '用户配额统计',
          passed: true,
          details: '所有用户的配额统计正确'
        }
      }
    } catch (error) {
      log(`❌ 用户配额统计检查失败: ${error instanceof Error ? error.message : '未知错误'}`, 'red')
      return {
        name: '用户配额统计',
        passed: false,
        details: `检查失败: ${error instanceof Error ? error.message : '未知错误'}`
      }
    }
  }

  // 检查孤儿记录
  async checkOrphanRecords(): Promise<CheckResult> {
    log('👻 检查孤儿记录...', 'cyan')
    
    try {
      // 检查没有对话的消息
      const orphanMessages = await prisma.message.count({
        where: {
          conversation: undefined
        }
      })

      // 检查没有用户的对话
      const orphanConversations = await prisma.conversation.count({
        where: {
          user: undefined
        }
      })

      // 检查没有用户的统计记录
      const orphanStats = await prisma.usageStats.count({
        where: {
          user: undefined
        }
      })

      const totalOrphans = orphanMessages + orphanConversations + orphanStats

      if (totalOrphans > 0) {
        log(`⚠️  发现孤儿记录:`, 'yellow')
        if (orphanMessages > 0) log(`   孤儿消息: ${orphanMessages} 条`, 'yellow')
        if (orphanConversations > 0) log(`   孤儿对话: ${orphanConversations} 个`, 'yellow')
        if (orphanStats > 0) log(`   孤儿统计: ${orphanStats} 条`, 'yellow')

        return {
          name: '孤儿记录',
          passed: false,
          details: `发现 ${totalOrphans} 条孤儿记录`,
          count: totalOrphans
        }
      } else {
        log('✅ 未发现孤儿记录', 'green')
        return {
          name: '孤儿记录',
          passed: true,
          details: '数据关联完整'
        }
      }
    } catch (error) {
      log(`❌ 孤儿记录检查失败: ${error instanceof Error ? error.message : '未知错误'}`, 'red')
      return {
        name: '孤儿记录',
        passed: false,
        details: `检查失败: ${error instanceof Error ? error.message : '未知错误'}`
      }
    }
  }

  // 检查约束和索引
  async checkConstraintsAndIndexes(): Promise<CheckResult> {
    log('🏗️  检查数据约束...', 'cyan')
    
    try {
      // 检查重复的用户邮箱
      const duplicateEmails = await prisma.$queryRaw<Array<{email: string, count: number}>>`
        SELECT email, COUNT(*) as count 
        FROM users 
        GROUP BY email 
        HAVING COUNT(*) > 1
      `

      // 检查重复的邀请码
      const duplicateInviteCodes = await prisma.$queryRaw<Array<{code: string, count: number}>>`
        SELECT code, COUNT(*) as count 
        FROM invite_codes 
        GROUP BY code 
        HAVING COUNT(*) > 1
      `

      const issues = []
      
      if (duplicateEmails.length > 0) {
        issues.push(`重复邮箱: ${duplicateEmails.length} 个`)
        duplicateEmails.forEach(dup => {
          log(`   重复邮箱: ${dup.email} (${dup.count} 次)`, 'yellow')
        })
      }

      if (duplicateInviteCodes.length > 0) {
        issues.push(`重复邀请码: ${duplicateInviteCodes.length} 个`)
      }

      if (issues.length > 0) {
        return {
          name: '数据约束',
          passed: false,
          details: issues.join('; '),
          count: issues.length
        }
      } else {
        log('✅ 数据约束检查通过', 'green')
        return {
          name: '数据约束',
          passed: true,
          details: '所有唯一约束正常'
        }
      }
    } catch (error) {
      log(`❌ 数据约束检查失败: ${error instanceof Error ? error.message : '未知错误'}`, 'red')
      return {
        name: '数据约束',
        passed: false,
        details: `检查失败: ${error instanceof Error ? error.message : '未知错误'}`
      }
    }
  }

  // 执行所有检查
  async runAllChecks(): Promise<CheckResult[]> {
    log('🚀 开始数据库完整性检查...', 'magenta')
    
    try {
      this.results = []

      // 依次执行所有检查
      this.results.push(await this.checkConnection())
      
      if (this.results[0].passed) {
        this.results.push(await this.checkTableStructure())
        this.results.push(await this.checkConversationMessageConsistency())
        this.results.push(await this.checkTokenConsistency())
        this.results.push(await this.checkUserUsageConsistency())
        this.results.push(await this.checkOrphanRecords())
        this.results.push(await this.checkConstraintsAndIndexes())
      } else {
        log('❌ 数据库连接失败，跳过其他检查', 'red')
      }

      this.generateReport()
      return this.results

    } catch (error) {
      log(`💥 检查过程异常: ${error instanceof Error ? error.message : '未知错误'}`, 'red')
      throw error
    } finally {
      await prisma.$disconnect()
    }
  }

  // 生成检查报告
  generateReport() {
    log('\n📊 数据库完整性检查报告', 'magenta')
    log('='.repeat(50), 'blue')

    const passedCount = this.results.filter(r => r.passed).length
    const failedCount = this.results.length - passedCount

    this.results.forEach(result => {
      const status = result.passed ? '✅ 通过' : '❌ 失败'
      const color = result.passed ? 'green' : 'red'
      log(`${status} ${result.name}: ${result.details}`, color)
    })

    // 总体评分
    const score = Math.round((passedCount / this.results.length) * 100)
    const scoreColor = score >= 90 ? 'green' : score >= 70 ? 'yellow' : 'red'
    
    log(`\n🎯 完整性评分: ${score}% (${passedCount}/${this.results.length} 通过)`, scoreColor)

    // 修复建议
    if (failedCount > 0) {
      log('\n🔧 修复建议:', 'blue')
      
      this.results.filter(r => !r.passed).forEach(result => {
        if (result.name === '对话消息计数' && result.issues) {
          log('  • 运行消息计数修复脚本', 'yellow')
        } else if (result.name === 'Token统计') {
          log('  • 重新计算Token统计', 'yellow')
        } else if (result.name === '孤儿记录') {
          log('  • 清理孤儿记录或修复关联', 'yellow')
        } else if (result.name === '数据约束') {
          log('  • 处理重复数据', 'yellow')
        }
      })
    }

    if (score >= 90) {
      log('\n🎊 数据库状态优秀！', 'green')
    } else if (score >= 70) {
      log('\n⚠️  数据库基本正常，建议处理发现的问题。', 'yellow')
    } else {
      log('\n🚨 数据库存在重要问题，需要立即修复！', 'red')
    }
  }
}

// 执行检查
async function main() {
  const checker = new DatabaseIntegrityChecker()
  
  try {
    await checker.runAllChecks()
    log('\n🏁 数据库完整性检查完成!', 'magenta')
  } catch (error) {
    log(`💥 检查执行失败: ${error instanceof Error ? error.message : '未知错误'}`, 'red')
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}