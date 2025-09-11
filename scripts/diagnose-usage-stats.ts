/**
 * 诊断使用量统计问题
 */

import { prisma } from '../lib/prisma'

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

// ---- CLI & Utils ----

type CliOptions = { days: number; limit: number; json: boolean }

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { days: 7, limit: 20, json: false }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const [k, v] = a.includes('=') ? a.split('=') : [a, undefined]
    switch (k) {
      case '--days':
        opts.days = v ? parseInt(v, 10) : parseInt(argv[++i] || '7', 10)
        break
      case '--limit':
        opts.limit = v ? parseInt(v, 10) : parseInt(argv[++i] || '20', 10)
        break
      case '--json':
        opts.json = true
        break
      default:
        // ignore unknown
        break
    }
  }
  if (!Number.isFinite(opts.days) || opts.days <= 0) opts.days = 7
  if (!Number.isFinite(opts.limit) || opts.limit <= 0) opts.limit = 20
  return opts
}

function startDateDaysAgo(days: number): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - days)
  return d
}

function cfmt(text: string, color: keyof typeof colors, enabled: boolean) {
  return enabled ? colors[color] + text + colors.reset : text
}


// ---- Enhanced Diagnosis ----
async function diagnoseUsageStatsEnhanced(opts: CliOptions) {
  const useColor = !opts.json
  const result: any = { summary: {}, recentUsage: [], recentAIMessages: [], users: [], inconsistencies: [] as any[] }
  let exitCode = 0
  try {
    const since = startDateDaysAgo(opts.days)

    // 1) UsageStats 基本统计
    const [totalRecords, totalOnlyRecords, nullModelRecords, modelSpecificRecords] = await Promise.all([
      prisma.usageStats.count(),
      prisma.usageStats.count({ where: { modelId: '_total' } }),
      prisma.usageStats.count({ where: { modelId: null } }),
      prisma.usageStats.count({ where: { AND: [{ modelId: { not: null } }, { modelId: { not: '_total' } }] } })
    ])

    // 2) 最近使用记录（按时间窗 + 限制）
    const recentRecords = await prisma.usageStats.findMany({
      where: { date: { gte: since } },
      take: opts.limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, userId: true, date: true, modelId: true, modelProvider: true,
        totalTokens: true, apiCalls: true, createdAt: true,
        user: { select: { email: true } }
      }
    })

    // 3) Message token 记录（时间窗）
    const [messagesWithTokens, messagesWithoutTokens] = await Promise.all([
      prisma.message.count({ where: { totalTokens: { gt: 0 }, createdAt: { gte: since } } }),
      prisma.message.count({ where: { totalTokens: { lte: 0 }, createdAt: { gte: since } } })
    ])

    const recentAIMessages = await prisma.message.findMany({
      where: { role: 'ASSISTANT', createdAt: { gte: since } },
      take: opts.limit,
      orderBy: { createdAt: 'desc' },
      select: { id: true, modelId: true, promptTokens: true, completionTokens: true, totalTokens: true, createdAt: true, conversation: { select: { title: true } } }
    })

    // 4) 用户配额与使用
    const users = await prisma.user.findMany({ select: { id: true, email: true, currentMonthUsage: true, totalTokenUsed: true, monthlyTokenLimit: true } })

    // 5) 一致性检查：_total vs. per-model 按日按用户
    const rangeRecords = await prisma.usageStats.findMany({
      where: { date: { gte: since } },
      select: { userId: true, date: true, modelId: true, apiCalls: true, totalTokens: true }
    })

    type Agg = { totalTokens: number; apiCalls: number }
    const groups = new Map<string, { total?: Agg; perModel: Agg }>()

    for (const r of rangeRecords) {
      const key = `${r.userId}|${r.date.toISOString().slice(0, 10)}`
      if (!groups.has(key)) groups.set(key, { perModel: { totalTokens: 0, apiCalls: 0 } })
      const g = groups.get(key)!
      if (r.modelId === '_total') {
        g.total = { totalTokens: r.totalTokens, apiCalls: r.apiCalls }
      } else if (r.modelId) {
        g.perModel.totalTokens += r.totalTokens
        g.perModel.apiCalls += r.apiCalls
      }
    }

    const inconsistencies: any[] = []
    const TOKEN_ABS_TOL = 50
    const TOKEN_REL_TOL = 0.05 // 5%
    const CALLS_ABS_TOL = 1
    const CALLS_REL_TOL = 0.05

    for (const [key, g] of groups) {
      if (!g.total) continue // 缺少 _total 记录，暂不判定
      const t = g.total
      const m = g.perModel
      const tokenDiff = Math.abs((t.totalTokens || 0) - (m.totalTokens || 0))
      const callsDiff = Math.abs((t.apiCalls || 0) - (m.apiCalls || 0))
      const tokenRel = t.totalTokens > 0 ? tokenDiff / t.totalTokens : 0
      const callsRel = t.apiCalls > 0 ? callsDiff / t.apiCalls : 0
      const bad = (tokenDiff > TOKEN_ABS_TOL && tokenRel > TOKEN_REL_TOL) || (callsDiff > CALLS_ABS_TOL && callsRel > CALLS_REL_TOL)
      if (bad) {
        inconsistencies.push({ key, total: t, perModel: m, tokenDiff, tokenRel, callsDiff, callsRel })
      }
    }

    // 汇总结果
    result.summary = {
      options: opts,
      totalRecords, totalOnlyRecords, nullModelRecords, modelSpecificRecords,
      messagesWithTokens, messagesWithoutTokens,
      users: users.length,
      inconsistencies: inconsistencies.length
    }
    result.recentUsage = recentRecords.map(r => ({ user: r.user?.email, date: r.date, modelId: r.modelId, tokens: r.totalTokens, apiCalls: r.apiCalls }))
    result.recentAIMessages = recentAIMessages.map(m => ({ conversation: m.conversation?.title, tokens: m.totalTokens, createdAt: m.createdAt, modelId: m.modelId }))
    result.users = users.map(u => ({ email: u.email, month: u.currentMonthUsage, limit: u.monthlyTokenLimit, pct: u.monthlyTokenLimit ? +(u.currentMonthUsage / u.monthlyTokenLimit * 100).toFixed(2) : null }))
    result.inconsistencies = inconsistencies

    // 文本输出
    if (!opts.json) {
      )
      .slice(0,10)}): withTokens=${messagesWithTokens}, withoutTokens=${messagesWithoutTokens}`)

      if (recentRecords.length) {
        )
        for (const r of recentRecords) {
          .slice(0,10)}, tokens: ${r.totalTokens}, calls: ${r.apiCalls}`)
        }
      }
      if (recentAIMessages.length) {
        )
        for (const m of recentAIMessages) {
          }`)
        }
      }

      )
      for (const u of result.users) {
        `:''}`)
      }

      if (inconsistencies.length) {
        exitCode = 2
        )
        const sample = inconsistencies.slice(0, Math.min(10, inconsistencies.length))
        for (const it of sample) {
          .toFixed(1)}%), calls diff=${it.callsDiff} (${(it.callsRel*100).toFixed(1)}%)`)
        }
      } else {
        )
      }

      // 结论与建议
      )
      }
  } catch (error) {
    exitCode = 3
    if (!opts.json) {
      , error)
    } else {
      result.error = (error as Error)?.message || String(error)
    }
  } finally {
    try { await prisma.$disconnect() } catch {}
    if (opts.json) {
      )
    }
    process.exitCode = exitCode
  }
}
// 运行诊断（CLI）
if (require.main === module) {
  const opts = parseArgs(process.argv)
  diagnoseUsageStatsEnhanced(opts).catch(err => {
    process.exitCode = 3
  })
}

export { diagnoseUsageStatsEnhanced as diagnoseUsageStats }