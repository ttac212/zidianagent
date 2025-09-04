"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, PieChart, Pie, Cell } from "recharts"
import { Users, MessageSquare, Activity, TrendingUp, Clock, Zap, AlertCircle } from "lucide-react"

interface AdminStats {
  overview: {
    totalUsers: number
    activeUsers: number
    totalSessions: number
    totalTokensUsed: number
    totalDocuments: number
    totalApiCalls: number
  }
  usageTrend: Array<{
    date: string
    users: number
    sessions: number
    tokens: number
    apiCalls: number
  }>
  userDistribution: Array<{
    role: string
    count: number
    percentage: number
  }>
  featureUsage: Array<{
    feature: string
    usage: number
    growth: string
  }>
  systemPerformance: {
    avgResponseTime: string
    uptime: string
    errorRate: string
    throughput: number
  }
}

const chartConfig = {
  users: {
    label: "用户数",
    color: "hsl(142, 76%, 36%)",
  },
  sessions: {
    label: "会话数",
    color: "hsl(142, 76%, 56%)",
  },
  tokens: {
    label: "Token使用",
    color: "hsl(142, 76%, 76%)",
  },
  apiCalls: {
    label: "API调用",
    color: "hsl(142, 76%, 86%)",
  },
}

const COLORS = ["hsl(142, 76%, 36%)", "hsl(142, 76%, 56%)", "hsl(142, 76%, 76%)"]

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("7d")

  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/stats?timeRange=${timeRange}`)
      const result = await response.json()

      if (result.success) {
        setStats(result.data)
      }
    } catch (error) {
      setStats({
        overview: {
          totalUsers: 0,
          activeUsers: 0,
          totalSessions: 0,
          totalTokensUsed: 0,
          totalDocuments: 0,
          totalApiCalls: 0,
        },
        usageTrend: [],
        userDistribution: [],
        featureUsage: [],
        systemPerformance: {
          avgResponseTime: "0",
          uptime: "0",
          errorRate: "0",
          throughput: 0,
        },
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [timeRange])

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toLocaleString()
  }

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 时间范围选择 */}
      <div className="flex justify-end">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1d">今天</SelectItem>
            <SelectItem value="7d">7天</SelectItem>
            <SelectItem value="30d">30天</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 概览统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.overview?.totalUsers || 0)}</div>
            <p className="text-xs text-muted-foreground">活跃用户: {formatNumber(stats.overview?.activeUsers || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总会话数</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.overview?.totalSessions || 0)}</div>
            <p className="text-xs text-muted-foreground">API调用: {formatNumber(stats.overview?.totalApiCalls || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Token使用量</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.overview?.totalTokensUsed || 0)}</div>
            <p className="text-xs text-muted-foreground">文档数: {formatNumber(stats.overview?.totalDocuments || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* 使用趋势图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>使用趋势</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.usageTrend && stats.usageTrend.length > 0 ? (
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={stats.usageTrend}>
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatNumber} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                    <Area
                      dataKey="users"
                      type="natural"
                      fill={chartConfig.users.color}
                      fillOpacity={0.4}
                      stroke={chartConfig.users.color}
                      stackId="a"
                    />
                    <Area
                      dataKey="sessions"
                      type="natural"
                      fill={chartConfig.sessions.color}
                      fillOpacity={0.4}
                      stroke={chartConfig.sessions.color}
                      stackId="a"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">暂无数据</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>用户角色分布</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.userDistribution && stats.userDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.userDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ role, percentage }) => `${role} ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {stats.userDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">暂无数据</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 功能使用统计和系统性能 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>功能使用统计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.featureUsage && stats.featureUsage.length > 0 ? (
                stats.featureUsage.map((feature) => (
                  <div key={feature.feature} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{feature.feature}</div>
                      <div className="text-sm text-muted-foreground">{formatNumber(feature.usage)} 次使用</div>
                    </div>
                    <div
                      className={`text-sm font-medium ${Number.parseFloat(feature.growth) >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {Number.parseFloat(feature.growth) >= 0 ? "+" : ""}
                      {feature.growth}%
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">暂无功能使用数据</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>系统性能</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>平均响应时间</span>
                </div>
                <span className="font-medium">{stats.systemPerformance?.avgResponseTime || "0"}ms</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span>系统正常运行时间</span>
                </div>
                <span className="font-medium">{stats.systemPerformance?.uptime || "0"}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span>错误率</span>
                </div>
                <span className="font-medium">{stats.systemPerformance?.errorRate || "0"}%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span>吞吐量</span>
                </div>
                <span className="font-medium">{formatNumber(stats.systemPerformance?.throughput || 0)}/min</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
