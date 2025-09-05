import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request as any })
    if (!token?.sub) return Response.json({ error: "未认证" }, { status: 401 })
    if ((token as any).role !== "ADMIN") return Response.json({ error: "无权限" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get("timeRange") || "7d"

    // 模拟统计数据
    const stats = generateMockStats(timeRange)

    return Response.json({
      success: true,
      data: stats,
    })
  } catch (_error) {
    return Response.json({ success: false, error: "获取统计数据失败" }, { status: 500 })
  }
}

function generateMockStats(timeRange: string) {
  const days = timeRange === "30d" ? 30 : timeRange === "7d" ? 7 : 1

  // 总体统计
  const overview = {
    totalUsers: Math.floor(Math.random() * 1000) + 500,
    activeUsers: Math.floor(Math.random() * 300) + 200,
    totalSessions: Math.floor(Math.random() * 5000) + 2000,
    totalTokensUsed: Math.floor(Math.random() * 1000000) + 500000,
    totalDocuments: Math.floor(Math.random() * 2000) + 1000,
    totalApiCalls: Math.floor(Math.random() * 50000) + 20000,
  }

  // 使用趋势
  const usageTrend = Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    }),
    users: Math.floor(Math.random() * 100) + 50,
    sessions: Math.floor(Math.random() * 500) + 200,
    tokens: Math.floor(Math.random() * 50000) + 10000,
    apiCalls: Math.floor(Math.random() * 2000) + 500,
  }))

  // 用户分布
  const userDistribution = [
    { role: "user", count: Math.floor(Math.random() * 400) + 200, percentage: 60 },
    { role: "premium", count: Math.floor(Math.random() * 200) + 100, percentage: 30 },
    { role: "admin", count: Math.floor(Math.random() * 50) + 20, percentage: 10 },
  ]

  // 功能使用统计
  const featureUsage = [
    { feature: "AI对话", usage: Math.floor(Math.random() * 10000) + 5000, growth: (Math.random() * 20 - 5).toFixed(1) },
    {
      feature: "文档管理",
      usage: Math.floor(Math.random() * 5000) + 2000,
      growth: (Math.random() * 20 - 5).toFixed(1),
    },
    {
      feature: "热门数据",
      usage: Math.floor(Math.random() * 3000) + 1000,
      growth: (Math.random() * 20 - 5).toFixed(1),
    },
    { feature: "反馈系统", usage: Math.floor(Math.random() * 1000) + 500, growth: (Math.random() * 20 - 5).toFixed(1) },
  ]

  // 系统性能
  const systemPerformance = {
    avgResponseTime: (Math.random() * 500 + 100).toFixed(0),
    uptime: (99.5 + Math.random() * 0.5).toFixed(2),
    errorRate: (Math.random() * 0.5).toFixed(3),
    throughput: Math.floor(Math.random() * 1000) + 500,
  }

  return {
    overview,
    usageTrend,
    userDistribution,
    featureUsage,
    systemPerformance,
  }
}
