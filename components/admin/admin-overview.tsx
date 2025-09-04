"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, Key, MessageSquare, FileText, Activity, RefreshCw } from "lucide-react"

interface SystemStats {
  totalUsers: number
  activeUsers: number
  totalKeys: number
  activeKeys: number
  totalConversations: number
  totalDocuments: number
  systemStatus: "healthy" | "warning" | "error"
  lastUpdated: string
}

export function AdminOverview() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      setLoading(true)
      // 模拟API调用
      await new Promise((resolve) => setTimeout(resolve, 1000))

      setStats({
        totalUsers: 1247,
        activeUsers: 892,
        totalKeys: 156,
        activeKeys: 134,
        totalConversations: 8934,
        totalDocuments: 2156,
        systemStatus: "healthy",
        lastUpdated: new Date().toLocaleString("zh-CN"),
      })
    } catch (error) {
      } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>数据加载失败</p>
        <Button onClick={fetchStats} className="mt-4 bg-transparent" variant="outline">
          重新加载
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 系统状态 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                系统状态
              </CardTitle>
              <CardDescription>最后更新: {stats.lastUpdated}</CardDescription>
            </div>
            <Badge variant={stats.systemStatus === "healthy" ? "default" : "destructive"}>
              {stats.systemStatus === "healthy" ? "正常运行" : "异常"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium">API服务</p>
                <p className="text-xs text-muted-foreground">正常</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium">数据库</p>
                <p className="text-xs text-muted-foreground">正常</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium">存储服务</p>
                <p className="text-xs text-muted-foreground">正常</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总用户数</p>
                <p className="text-2xl font-semibold">{stats.totalUsers}</p>
                <p className="text-xs text-muted-foreground">活跃: {stats.activeUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Key className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">API密钥</p>
                <p className="text-2xl font-semibold">{stats.totalKeys}</p>
                <p className="text-xs text-muted-foreground">活跃: {stats.activeKeys}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">对话总数</p>
                <p className="text-2xl font-semibold">{stats.totalConversations}</p>
                <p className="text-xs text-muted-foreground">本月新增</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">文档总数</p>
                <p className="text-2xl font-semibold">{stats.totalDocuments}</p>
                <p className="text-xs text-muted-foreground">已创建</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 快速操作 */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
          <CardDescription>常用管理功能</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto p-4 flex flex-col gap-2 bg-transparent">
              <Users className="h-6 w-6" />
              <span>用户管理</span>
              <span className="text-xs text-muted-foreground">管理用户权限和状态</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col gap-2 bg-transparent">
              <Key className="h-6 w-6" />
              <span>密钥分发</span>
              <span className="text-xs text-muted-foreground">生成和管理API密钥</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col gap-2 bg-transparent" onClick={fetchStats}>
              <RefreshCw className="h-6 w-6" />
              <span>刷新数据</span>
              <span className="text-xs text-muted-foreground">更新系统统计信息</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
