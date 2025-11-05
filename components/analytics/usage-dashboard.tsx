/**
 * 使用量分析仪表板
 * 基于 Prisma + React Query 的实时数据可视化
 */

'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useUsageStats, useUserQuota } from '@/hooks/api/use-usage-stats'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

interface UsageDashboardProps {
  userId: string
  days?: number
}

export function UsageDashboard({ userId, days = 30 }: UsageDashboardProps) {
  const { data: statsData, isLoading: statsLoading } = useUsageStats(userId, days)
  const { data: quotaData, isLoading: quotaLoading } = useUserQuota(userId)

  // 计算配额使用率
  const usageRate = quotaData
    ? (quotaData.currentMonthUsage / quotaData.monthlyTokenLimit) * 100
    : 0

  // 处理趋势数据：将每日数据转换为图表格式
  const trendData = statsData?.dailyStats.map((day) => {
    const totalTokens = Object.values(day.models).reduce(
      (sum, model) => sum + model.tokens,
      0
    )
    return {
      date: new Date(day.date).toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
      }),
      tokens: totalTokens,
    }
  })

  // 处理模型分布数据：转换为图表格式
  const modelData = statsData
    ? Object.entries(statsData.modelStats).map(([modelId, stats]) => ({
        modelId: stats.displayName || modelId,
        tokens: stats.totalTokens,
        requests: stats.requests,
      }))
    : []

  return (
    <div className="space-y-6">
      {/* 配额概览 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="本月使用量"
          value={quotaData?.currentMonthUsage || 0}
          unit="tokens"
          loading={quotaLoading}
        />
        <MetricCard
          title="月度限额"
          value={quotaData?.monthlyTokenLimit || 0}
          unit="tokens"
          loading={quotaLoading}
        />
        <MetricCard
          title="使用率"
          value={parseFloat(usageRate.toFixed(1))}
          unit="%"
          loading={quotaLoading}
          trend={usageRate > 80 ? 'warning' : 'normal'}
        />
      </div>

      {/* 总体统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title={`最近${days}天总Token`}
          value={statsData?.totalStats.totalTokens || 0}
          unit="tokens"
          loading={statsLoading}
        />
        <MetricCard
          title="总请求数"
          value={statsData?.totalStats.totalRequests || 0}
          unit="次"
          loading={statsLoading}
        />
        <MetricCard
          title="平均每次请求"
          value={statsData?.totalStats.avgTokensPerRequest || 0}
          unit="tokens"
          loading={statsLoading}
        />
      </div>

      {/* Token使用趋势 */}
      <Card>
        <CardHeader>
          <CardTitle>Token使用趋势 (最近{days}天)</CardTitle>
          <CardDescription>查看每日Token消耗情况</CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : !trendData || trendData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              暂无数据
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="tokens"
                  name="Token使用量"
                  stroke="#8884d8"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 模型使用分布 */}
      <Card>
        <CardHeader>
          <CardTitle>模型使用分布</CardTitle>
          <CardDescription>各模型Token消耗和调用次数</CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : !modelData || modelData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              暂无数据
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={modelData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="modelId" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="tokens" name="Token数" fill="#8884d8" />
                <Bar dataKey="requests" name="调用次数" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 模型详细统计表格 */}
      {statsData && statsData.summary.hasData && (
        <Card>
          <CardHeader>
            <CardTitle>模型详细统计</CardTitle>
            <CardDescription>各模型使用详情</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">模型</th>
                    <th className="text-left py-2 px-4">提供商</th>
                    <th className="text-right py-2 px-4">Token数</th>
                    <th className="text-right py-2 px-4">请求次数</th>
                    <th className="text-right py-2 px-4">占比</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(statsData.modelStats).map(([modelId, stats]) => (
                    <tr key={modelId} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-4">{stats.displayName}</td>
                      <td className="py-2 px-4 text-muted-foreground">{stats.provider}</td>
                      <td className="text-right py-2 px-4 font-mono">
                        {stats.formattedTokens}
                      </td>
                      <td className="text-right py-2 px-4 font-mono">
                        {stats.formattedRequests}
                      </td>
                      <td className="text-right py-2 px-4">
                        <span className="text-muted-foreground">{stats.percentage}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// 指标卡片组件
interface MetricCardProps {
  title: string
  value: number
  unit: string
  loading?: boolean
  trend?: 'normal' | 'warning' | 'danger'
}

function MetricCard({ title, value, unit, loading, trend = 'normal' }: MetricCardProps) {
  const trendColors = {
    normal: 'text-foreground',
    warning: 'text-yellow-600',
    danger: 'text-red-600',
  }

  const formatValue = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M`
    if (val >= 1000) return `${(val / 1000).toFixed(2)}K`
    return val.toLocaleString()
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${trendColors[trend]}`}>
              {formatValue(value)}
            </span>
            <span className="text-sm text-muted-foreground">{unit}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
