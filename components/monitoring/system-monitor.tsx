"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { Activity, Clock, AlertTriangle, TrendingUp, Database, Cpu } from "lucide-react"

interface SystemMetrics {
  responseTime: Array<{ time: string; value: number }>
  errorRate: Array<{ time: string; value: number }>
  throughput: Array<{ time: string; value: number }>
  stats: {
    avgResponseTime: number
    errorRate: number
    totalRequests: number
    uptime: number
  }
}

const chartConfig = {
  value: {
    label: "数值",
    color: "hsl(142, 76%, 36%)",
  },
}

export function SystemMonitor() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("1h")
  const [selectedMetric, setSelectedMetric] = useState("response_time")

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/analytics/metrics?metricType=${selectedMetric}&timeRange=${timeRange}`)
      const result = await response.json()

      if (result.success) {
        // 转换数据格式用于图表显示
        const chartData = result.data.metrics.map((metric: any) => ({
          time: new Date(metric.timestamp).toLocaleTimeString(),
          value: metric.value,
        }))

        setMetrics({
          responseTime: selectedMetric === "response_time" ? chartData : [],
          errorRate: selectedMetric === "error_rate" ? chartData : [],
          throughput: selectedMetric === "throughput" ? chartData : [],
          stats: {
            avgResponseTime: result.data.stats.avg,
            errorRate: 0.5, // 模拟数据
            totalRequests: result.data.stats.count,
            uptime: 99.9, // 模拟数据
          },
        })
      }
    } catch (error) {
      } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 30000) // 每30秒刷新一次
    return () => clearInterval(interval)
  }, [timeRange, selectedMetric])

  const getStatusColor = (value: number, type: string) => {
    switch (type) {
      case "response_time":
        return value < 200 ? "bg-green-500" : value < 500 ? "bg-yellow-500" : "bg-red-500"
      case "error_rate":
        return value < 1 ? "bg-green-500" : value < 5 ? "bg-yellow-500" : "bg-red-500"
      case "uptime":
        return value > 99 ? "bg-green-500" : value > 95 ? "bg-yellow-500" : "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载监控数据中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 控制面板 */}
      <div className="flex gap-4">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">1小时</SelectItem>
            <SelectItem value="24h">24小时</SelectItem>
            <SelectItem value="7d">7天</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedMetric} onValueChange={setSelectedMetric}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="response_time">响应时间</SelectItem>
            <SelectItem value="error_rate">错误率</SelectItem>
            <SelectItem value="throughput">吞吐量</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 系统状态概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均响应时间</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.stats.avgResponseTime.toFixed(0)}ms</div>
            <div className="flex items-center gap-2 mt-2">
              <div
                className={`w-2 h-2 rounded-full ${getStatusColor(metrics.stats.avgResponseTime, "response_time")}`}
              />
              <span className="text-xs text-muted-foreground">
                {metrics.stats.avgResponseTime < 200
                  ? "优秀"
                  : metrics.stats.avgResponseTime < 500
                    ? "良好"
                    : "需要优化"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">错误率</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.stats.errorRate}%</div>
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(metrics.stats.errorRate, "error_rate")}`} />
              <span className="text-xs text-muted-foreground">
                {metrics.stats.errorRate < 1 ? "优秀" : metrics.stats.errorRate < 5 ? "良好" : "需要关注"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总请求数</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.stats.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-2">过去{timeRange}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">系统正常运行时间</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.stats.uptime}%</div>
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(metrics.stats.uptime, "uptime")}`} />
              <span className="text-xs text-muted-foreground">系统稳定</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 实时监控图表 */}
      <Card>
        <CardHeader>
          <CardTitle>
            实时监控 -{" "}
            {selectedMetric === "response_time" ? "响应时间" : selectedMetric === "error_rate" ? "错误率" : "吞吐量"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={
                  selectedMetric === "response_time"
                    ? metrics.responseTime
                    : selectedMetric === "error_rate"
                      ? metrics.errorRate
                      : metrics.throughput
                }
              >
                <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <Line dataKey="value" type="monotone" stroke={chartConfig.value.color} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* 系统健康状态 */}
      <Card>
        <CardHeader>
          <CardTitle>系统健康状态</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-muted-foreground" />
                <span>数据库连接</span>
              </div>
              <Badge variant="default" className="bg-green-500">
                正常
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Cpu className="h-5 w-5 text-muted-foreground" />
                <span>CPU使用率</span>
              </div>
              <Badge variant="default" className="bg-yellow-500">
                45%
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <span>内存使用率</span>
              </div>
              <Badge variant="default" className="bg-green-500">
                62%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
