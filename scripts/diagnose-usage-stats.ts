/**
 * 使用量统计诊断工具
 * 用于检查和分析系统中的使用量统计数据一致性
 */

import { prisma } from '../lib/prisma'
import type { User, UsageStats, Message } from '@prisma/client'

// ========== 配置常量 ==========
const CONFIG = {
  tolerance: {
    token: { absolute: 50, relative: 0.05 },  // 5% 相对容差
    calls: { absolute: 1, relative: 0.05 }
  },
  colors: {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
  }
} as const

// ========== 类型定义 ==========
interface DiagnosticOptions {
  days: number
  limit: number
  json: boolean
}

interface CollectedData {
  stats: {
    total: number
    totalOnly: number
    nullModel: number
    modelSpecific: number
  }
  messages: {
    withTokens: number
    withoutTokens: number
    recent: Array<{
      id: string
      modelId: string | null
      totalTokens: number
      createdAt: Date
      conversation?: { title: string | null }
    }>
  }
  usage: {
    recent: Array<{
      userId: string
      date: Date
      modelId: string | null
      totalTokens: number
      apiCalls: number
      user?: { email: string | null }
    }>
  }
  users: Array<{
    id: string
    email: string | null
    currentMonthUsage: number
    monthlyTokenLimit: number | null
  }>
}

interface ConsistencyIssue {
  key: string
  total: { totalTokens: number; apiCalls: number }
  perModel: { totalTokens: number; apiCalls: number }
  tokenDiff: number
  tokenRel: number
  callsDiff: number
  callsRel: number
}

interface AnalysisResult {
  summary: {
    options: DiagnosticOptions
    stats: CollectedData['stats']
    messages: Omit<CollectedData['messages'], 'recent'>
    users: number
    inconsistencies: number
  }
  recentUsage: Array<{
    user?: string | null
    date: Date
    modelId: string | null
    tokens: number
    apiCalls: number
  }>
  recentAIMessages: Array<{
    conversation?: string | null
    tokens: number
    createdAt: Date
    modelId: string | null
  }>
  users: Array<{
    email: string | null
    month: number
    limit: number | null
    pct: number | null
  }>
  inconsistencies: ConsistencyIssue[]
  error?: string
}

// ========== 工具函数 ==========
class Utils {
  static parseArgs(argv: string[]): DiagnosticOptions {
    const opts: DiagnosticOptions = { days: 7, limit: 20, json: false }
    
    for (let i = 2; i < argv.length; i++) {
      const arg = argv[i]
      const [key, value] = arg.includes('=') ? arg.split('=') : [arg, undefined]
      
      switch (key) {
        case '--days':
          opts.days = value ? parseInt(value, 10) : parseInt(argv[++i] || '7', 10)
          break
        case '--limit':
          opts.limit = value ? parseInt(value, 10) : parseInt(argv[++i] || '20', 10)
          break
        case '--json':
          opts.json = true
          break
      }
    }
    
    // 验证参数
    if (!Number.isFinite(opts.days) || opts.days <= 0) opts.days = 7
    if (!Number.isFinite(opts.limit) || opts.limit <= 0) opts.limit = 20
    
    return opts
  }

  static getStartDate(daysAgo: number): Date {
    const date = new Date()
    date.setUTCHours(0, 0, 0, 0)
    date.setUTCDate(date.getUTCDate() - daysAgo)
    return date
  }

  static colorize(text: string, color: keyof typeof CONFIG.colors, enabled: boolean): string {
    return enabled ? CONFIG.colors[color] + text + CONFIG.colors.reset : text
  }
}

// ========== 数据收集器 ==========
class DataCollector {
  constructor(private options: DiagnosticOptions) {}

  async collect(): Promise<CollectedData> {
    const since = Utils.getStartDate(this.options.days)
    
    const [stats, messages, usage, users] = await Promise.all([
      this.collectStats(),
      this.collectMessages(since),
      this.collectUsage(since),
      this.collectUsers()
    ])

    return { stats, messages, usage, users }
  }

  private async collectStats(): Promise<CollectedData['stats']> {
    const [total, totalOnly, nullModel, modelSpecific] = await Promise.all([
      prisma.usageStats.count(),
      prisma.usageStats.count({ where: { modelId: '_total' } }),
      prisma.usageStats.count({ where: { modelId: null } }),
      prisma.usageStats.count({ 
        where: { 
          AND: [
            { modelId: { not: null } }, 
            { modelId: { not: '_total' } }
          ] 
        } 
      })
    ])

    return { total, totalOnly, nullModel, modelSpecific }
  }

  private async collectMessages(since: Date): Promise<CollectedData['messages']> {
    const [withTokens, withoutTokens, recent] = await Promise.all([
      prisma.message.count({
        where: {
          OR: [
            { promptTokens: { gt: 0 } },
            { completionTokens: { gt: 0 } }
          ],
          createdAt: { gte: since }
        }
      }),
      prisma.message.count({
        where: {
          AND: [
            { promptTokens: { lte: 0 } },
            { completionTokens: { lte: 0 } }
          ],
          createdAt: { gte: since }
        } 
      }),
      prisma.message.findMany({
        where: { role: 'ASSISTANT', createdAt: { gte: since } },
        take: this.options.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          modelId: true,
          promptTokens: true,
          completionTokens: true,
          createdAt: true,
          conversation: { select: { title: true } }
        }
      })
    ])

    // Map recent messages to include totalTokens
    const mappedRecent = recent.map(msg => ({
      id: msg.id,
      modelId: msg.modelId,
      totalTokens: msg.promptTokens + msg.completionTokens,
      createdAt: msg.createdAt,
      conversation: msg.conversation
    }))

    return { withTokens, withoutTokens, recent: mappedRecent }
  }

  private async collectUsage(since: Date): Promise<CollectedData['usage']> {
    const recent = await prisma.usageStats.findMany({
      where: { date: { gte: since } },
      take: this.options.limit,
      orderBy: { createdAt: 'desc' },
      select: {
        userId: true,
        date: true,
        modelId: true,
        promptTokens: true,
        completionTokens: true,
        apiCalls: true,
        user: { select: { email: true } }
      }
    })

    // Map to include totalTokens
    const mappedRecent = recent.map(r => ({
      ...r,
      totalTokens: r.promptTokens + r.completionTokens
    }))

    return { recent: mappedRecent }
  }

  private async collectUsers(): Promise<CollectedData['users']> {
    return prisma.user.findMany({ 
      select: { 
        id: true, 
        email: true, 
        currentMonthUsage: true, 
        monthlyTokenLimit: true 
      } 
    })
  }
}

// ========== 一致性分析器 ==========
class ConsistencyAnalyzer {
  async analyze(data: CollectedData, since: Date): Promise<ConsistencyIssue[]> {
    const records = await this.fetchRecordsForAnalysis(since)
    const groups = this.groupRecordsByUserAndDate(records)
    return this.findInconsistencies(groups)
  }

  private async fetchRecordsForAnalysis(since: Date) {
    return prisma.usageStats.findMany({
      where: { date: { gte: since } },
      select: {
        userId: true,
        date: true,
        modelId: true,
        apiCalls: true,
        promptTokens: true,
        completionTokens: true
      }
    })
  }

  private groupRecordsByUserAndDate(records: any[]) {
    type Aggregation = { totalTokens: number; apiCalls: number }
    const groups = new Map<string, { total?: Aggregation; perModel: Aggregation }>()

    for (const record of records) {
      const key = `${record.userId}|${record.date.toISOString().slice(0, 10)}`
      
      if (!groups.has(key)) {
        groups.set(key, { perModel: { totalTokens: 0, apiCalls: 0 } })
      }
      
      const group = groups.get(key)!
      
      if (record.modelId === '_total') {
        group.total = {
          totalTokens: record.promptTokens + record.completionTokens,
          apiCalls: record.apiCalls
        }
      } else if (record.modelId) {
        group.perModel.totalTokens += (record.promptTokens + record.completionTokens)
        group.perModel.apiCalls += record.apiCalls
      }
    }

    return groups
  }

  private findInconsistencies(groups: Map<string, any>): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = []
    const { tolerance } = CONFIG

    for (const [key, group] of groups) {
      if (!group.total) continue // 缺少 _total 记录，暂不判定

      const tokenDiff = Math.abs((group.total.totalTokens || 0) - (group.perModel.totalTokens || 0))
      const callsDiff = Math.abs((group.total.apiCalls || 0) - (group.perModel.apiCalls || 0))
      
      const tokenRel = group.total.totalTokens > 0 
        ? tokenDiff / group.total.totalTokens 
        : 0
      const callsRel = group.total.apiCalls > 0 
        ? callsDiff / group.total.apiCalls 
        : 0

      const hasTokenIssue = tokenDiff > tolerance.token.absolute && tokenRel > tolerance.token.relative
      const hasCallsIssue = callsDiff > tolerance.calls.absolute && callsRel > tolerance.calls.relative

      if (hasTokenIssue || hasCallsIssue) {
        issues.push({
          key,
          total: group.total,
          perModel: group.perModel,
          tokenDiff,
          tokenRel,
          callsDiff,
          callsRel
        })
      }
    }

    return issues
  }
}

// ========== 报告生成器 ==========
class ReportGenerator {
  generateReport(
    data: CollectedData, 
    inconsistencies: ConsistencyIssue[], 
    options: DiagnosticOptions
  ): AnalysisResult {
    const result: AnalysisResult = {
      summary: {
        options,
        stats: data.stats,
        messages: {
          withTokens: data.messages.withTokens,
          withoutTokens: data.messages.withoutTokens
        },
        users: data.users.length,
        inconsistencies: inconsistencies.length
      },
      recentUsage: data.usage.recent.map(r => ({
        user: r.user?.email,
        date: r.date,
        modelId: r.modelId,
        tokens: r.totalTokens,
        apiCalls: r.apiCalls
      })),
      recentAIMessages: data.messages.recent.map(m => ({
        conversation: m.conversation?.title,
        tokens: m.totalTokens,
        createdAt: m.createdAt,
        modelId: m.modelId
      })),
      users: data.users.map(u => ({
        email: u.email,
        month: u.currentMonthUsage,
        limit: u.monthlyTokenLimit,
        pct: u.monthlyTokenLimit 
          ? +(u.currentMonthUsage / u.monthlyTokenLimit * 100).toFixed(2) 
          : null
      })),
      inconsistencies
    }

    return result
  }

  printTextReport(result: AnalysisResult, since: Date): void {
    const c = (text: string, color: keyof typeof CONFIG.colors) => 
      Utils.colorize(text, color, true)

    // 标题
    console.log(c(`\n=== 使用量统计诊断（最近 ${result.summary.options.days} 天）===`, 'cyan'))
    
    // 统计摘要
    const { stats } = result.summary
    console.log(`UsageStats: total=${stats.total}, _total=${stats.totalOnly}, null=${stats.nullModel}, per-model=${stats.modelSpecific}`)
    console.log(`Messages (since ${since.toISOString().slice(0,10)}): withTokens=${result.summary.messages.withTokens}, withoutTokens=${result.summary.messages.withoutTokens}`)

    // 最近使用记录
    if (result.recentUsage.length) {
      console.log(c(`\n最近 UsageStats 记录（${result.recentUsage.length}）:`, 'blue'))
      for (const r of result.recentUsage) {
        console.log(`  用户: ${r.user || 'N/A'}, 模型: ${r.modelId}, 日期: ${r.date.toISOString().slice(0,10)}, tokens: ${r.tokens}, calls: ${r.apiCalls}`)
      }
    }

    // 最近 AI 消息
    if (result.recentAIMessages.length) {
      console.log(c(`\n最近 AI 消息（${result.recentAIMessages.length}）:`, 'blue'))
      for (const m of result.recentAIMessages) {
        console.log(`  对话: ${m.conversation || ''}, 模型: ${m.modelId}, tokens: ${m.tokens}, 时间: ${m.createdAt.toISOString()}`)
      }
    }

    // 用户用量概览
    console.log(c(`\n用户用量概览（${result.users.length}）:`, 'blue'))
    for (const u of result.users) {
      console.log(`  用户: ${u.email}, 本月: ${u.month}/${u.limit}${u.pct != null ? ` (${u.pct}%)` : ''}`)
    }

    // 一致性问题
    if (result.inconsistencies.length) {
      console.log(c(`\n发现 ${result.inconsistencies.length} 个 _total 与各模型统计不一致项：`, 'yellow'))
      const sample = result.inconsistencies.slice(0, Math.min(10, result.inconsistencies.length))
      for (const it of sample) {
        console.log(`  ${it.key}: tokens diff=${it.tokenDiff} (${(it.tokenRel * 100).toFixed(1)}%), calls diff=${it.callsDiff} (${(it.callsRel * 100).toFixed(1)}%)`)
      }
    } else {
      console.log(c(`\n未发现 _total 与各模型统计不一致项`, 'green'))
    }

    // 建议
    console.log(c(`\n建议:`, 'cyan'))
    console.log(`- 确认聊天 API 统计写入流程（预记录/完成记录）是否存在失败路径未回补`)
    console.log(`- 检查日期归零（UTC 0 点）与 _total/模型项写入时机是否一致`)
    console.log(`- 如为生产环境，建议引入幂等 requestId 与定时对账作业`)
  }
}

// ========== 主诊断器 ==========
class UsageStatsDiagnostic {
  private collector: DataCollector
  private analyzer: ConsistencyAnalyzer
  private reporter: ReportGenerator

  constructor(options: DiagnosticOptions) {
    this.collector = new DataCollector(options)
    this.analyzer = new ConsistencyAnalyzer()
    this.reporter = new ReportGenerator()
  }

  async diagnose(): Promise<{ result: AnalysisResult; exitCode: number }> {
    let exitCode = 0
    let result: AnalysisResult

    try {
      const since = Utils.getStartDate(this.collector['options'].days)
      
      // 收集数据
      const data = await this.collector.collect()
      
      // 分析一致性
      const inconsistencies = await this.analyzer.analyze(data, since)
      
      // 生成报告
      result = this.reporter.generateReport(
        data, 
        inconsistencies, 
        this.collector['options']
      )

      // 设置退出码
      if (inconsistencies.length > 0) {
        exitCode = 2
      }

      // 输出报告
      if (!this.collector['options'].json) {
        this.reporter.printTextReport(result, since)
      } else {
        console.log(JSON.stringify(result, null, 2))
      }

      return { result, exitCode }

    } catch (error) {
      exitCode = 3
      const errorMessage = (error as Error)?.message || String(error)
      
      if (!this.collector['options'].json) {
        console.error(Utils.colorize('诊断使用量统计时出错:', 'red', true), error)
      } else {
        result = { error: errorMessage } as any
        console.log(JSON.stringify(result, null, 2))
      }
      
      return { result: result!, exitCode }
    } finally {
      try { 
        await prisma.$disconnect() 
      } catch {}
    }
  }
}

// ========== CLI 入口 ==========
async function main() {
  const options = Utils.parseArgs(process.argv)
  const diagnostic = new UsageStatsDiagnostic(options)
  const { exitCode } = await diagnostic.diagnose()
  process.exitCode = exitCode
}

// 运行诊断（CLI）
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal:', err)
    process.exitCode = 3
  })
}

// 导出供其他模块使用
export async function diagnoseUsageStats(options?: Partial<DiagnosticOptions>) {
  const opts = {
    days: options?.days ?? 7,
    limit: options?.limit ?? 20,
    json: options?.json ?? false
  }
  const diagnostic = new UsageStatsDiagnostic(opts)
  return diagnostic.diagnose()
}