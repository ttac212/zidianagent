"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Header } from "@/components/header"
import { toast } from "sonner"
import { useSession, signOut } from "next-auth/react"
import {
  User,
  Mail,
  Lock,
  Palette,
  Layout,
  BarChart3,
  Settings,
  Calendar,
  Zap,
  Eye,
  EyeOff,
  LogOut,
  ChartColumn,
} from "lucide-react"
import { StatsCardsGridSkeleton, UsageDetailCardSkeleton } from "@/components/ui/stats-card-skeleton"
import { ModelUsageCards } from "@/components/stats/model-usage-cards"
import { ConnectionStatus } from "@/components/ui/connection-status"
import { ConnectionRecovery } from "@/components/ui/connection-recovery"

interface UsageData {
  date: string
  tokens: number
  requests: number
}

interface ModelUsageData {
  displayName: string
  provider: string
  totalTokens: number
  requests: number
  promptTokens: number
  completionTokens: number
  percentage: number
  formattedTokens: string
  formattedRequests: string
}

interface ModelStatsResponse {
  success: boolean
  data: {
    totalStats: {
      totalTokens: number
      totalRequests: number
      formattedTokens: string
      formattedRequests: string
      avgTokensPerRequest: number
    }
    modelStats: Record<string, ModelUsageData>
    dailyStats: Array<{
      date: string
      models: Record<string, { tokens: number; requests: number }>
    }>
    summary: {
      queryDays: number
      totalModels: number
      mostUsedModel: string | null
      leastUsedModel: string | null
      hasData: boolean
    }
  }
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const [activeTab, setActiveTab] = useState("usage")
  const [showPassword, setShowPassword] = useState(false)

  // 账户设置状态
  const [email, setEmail] = useState("user@example.com")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // 偏好设置状态
  const [theme, setTheme] = useState("system")
  const [language, setLanguage] = useState("zh-CN")
  const [autoSave, setAutoSave] = useState(true)
  const [notifications, setNotifications] = useState(true)

  // 用量真实数据
  const [usageData, setUsageData] = useState<UsageData[]>([])
  const [loadingUsage, setLoadingUsage] = useState(false)
  const [usageError, setUsageError] = useState<string | null>(null)

  // 模型统计数据
  const [modelStats, setModelStats] = useState<ModelStatsResponse['data'] | null>(null)
  const [loadingModelStats, setLoadingModelStats] = useState(false)
  const [modelStatsError, setModelStatsError] = useState<string | null>(null)

  // 连接监控状态
  const [showConnectionRecovery, setShowConnectionRecovery] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const handleUpdateEmail = () => {
    toast.success("邮箱更新成功")
  }

  const handleUpdatePassword = () => {
    if (newPassword !== confirmPassword) {
      toast.error("新密码与确认密码不匹配")
      return
    }
    toast.success("密码更新成功")
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  // 连接状态变化处理
  const handleConnectionStatusChange = (connected: boolean) => {
    if (!connected) {
      setConnectionError("连接已断开，可能是服务器重启或网络问题")
      setShowConnectionRecovery(true)
    } else {
      setConnectionError(null)
      setShowConnectionRecovery(false)
    }
  }

  // 连接恢复成功处理
  const handleConnectionRecovery = () => {
    setShowConnectionRecovery(false)
    setConnectionError(null)
    toast.success("连接已恢复，正在重新加载数据...")
    
    // 重新获取数据
    if (status === 'authenticated') {
      fetchUsage()
      fetchModelStats()
    }
  }

  // 获取当前用户ID：优先 useSession，兜底 /api/auth/me
  const fetchCurrentUserId = async (): Promise<string | null> => {
    const idFromSession = (session as any)?.user?.id
    return (idFromSession as string) || null
  }

  const fetchUsage = async () => {
    setLoadingUsage(true)
    setUsageError(null)
    try {
      const userId = await fetchCurrentUserId()
      if (!userId) {
        setUsageError("未登录或无法获取用户信息")
        setUsageData([])
        return
      }
      const res = await fetch(`/api/users/${userId}`)
      if (!res.ok) throw new Error("获取使用量失败")
      const result = await res.json()
      const stats = (result?.data?.usageStats || []) as Array<{ date: string; totalTokens: number; apiCalls: number }>
      
      // 方案：使用Map确保日期唯一性，并智能合并重复数据
      const dateMap = new Map<string, { tokens: number; requests: number; count: number }>()
      
      stats.forEach((item) => {
        const dateKey = new Date(item.date).toISOString().split("T")[0]
        const existing = dateMap.get(dateKey)
        
        if (existing) {
          // 合并重复日期的数据
          existing.tokens += item.totalTokens || 0
          existing.requests += item.apiCalls || 0
          existing.count += 1
        } else {
          // 创建新记录
          dateMap.set(dateKey, {
            tokens: item.totalTokens || 0,
            requests: item.apiCalls || 0,
            count: 1
          })
        }
      })
      
      const mapped: UsageData[] = Array.from(dateMap.entries())
        .map(([date, data]) => ({
          date,
          tokens: data.tokens,
          requests: data.requests,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      
      // 调试信息：记录重复数据情况
      const duplicateCount = Array.from(dateMap.values()).filter(d => d.count > 1).length
      if (duplicateCount > 0) {
        }
      setUsageData(mapped)
    } catch (e: any) {
      setUsageError(e?.message || "获取使用量失败")
      setUsageData([])
    } finally {
      setLoadingUsage(false)
    }
  }

  // 获取模型统计数据
  const fetchModelStats = async () => {
    setLoadingModelStats(true)
    setModelStatsError(null)
    try {
      const userId = await fetchCurrentUserId()
      if (!userId) {
        setModelStatsError("未登录或无法获取用户信息")
        setModelStats(null)
        return
      }
      
      const res = await fetch(`/api/users/${userId}/model-stats?days=30`)
      if (!res.ok) throw new Error("获取模型统计失败")
      
      const result: ModelStatsResponse = await res.json()
      if (result.success) {
        setModelStats(result.data)
      } else {
        throw new Error("API返回失败状态")
      }
    } catch (e: any) {
      setModelStatsError(e?.message || "获取模型统计失败")
      setModelStats(null)
    } finally {
      setLoadingModelStats(false)
    }
  }

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchUsage()
    fetchModelStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, (session as any)?.user?.id])

  const totalTokens = usageData.reduce((sum, data) => sum + data.tokens, 0)
  const totalRequests = usageData.reduce((sum, data) => sum + data.requests, 0)
  const avgTokensPerRequest = totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">设置</h1>
                <p className="text-muted-foreground">管理您的账户、偏好设置和API配置</p>
              </div>
              
              {/* 连接状态指示器 */}
              <ConnectionStatus
                size="md"
                showDetails={true}
                onStatusChange={handleConnectionStatusChange}
                className="ml-4"
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="usage" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                用量
              </TabsTrigger>
              <TabsTrigger value="account" className="gap-2">
                <User className="h-4 w-4" />
                账户
              </TabsTrigger>
              <TabsTrigger value="preferences" className="gap-2">
                <Settings className="h-4 w-4" />
                偏好
              </TabsTrigger>
            </TabsList>

            {/* 用量统计 */}
            <TabsContent value="usage" className="space-y-6">
              {/* 数据卡片网格 - 带加载状态 */}
              {loadingUsage ? (
                <StatsCardsGridSkeleton />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Zap className="h-8 w-8 text-primary/60" />
                        <div>
                          <p className="text-sm text-muted-foreground">总Token使用</p>
                          <p className="text-2xl font-semibold">{totalTokens.toLocaleString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <ChartColumn className="h-8 w-8 text-primary/60" />
                        <div>
                          <p className="text-sm text-muted-foreground">总请求数</p>
                          <p className="text-2xl font-semibold">{totalRequests}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-8 w-8 text-primary/60" />
                        <div>
                          <p className="text-sm text-muted-foreground">平均Token/请求</p>
                          <p className="text-2xl font-semibold">{avgTokensPerRequest}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* 模型使用分布 - 新增功能 */}
              {modelStatsError ? (
                <Card className="border-destructive">
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-destructive">{modelStatsError}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={fetchModelStats}
                      className="mt-2"
                    >
                      重新加载
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <ModelUsageCards 
                  modelStats={modelStats?.modelStats || {}}
                  totalStats={modelStats?.totalStats || {
                    totalTokens: 0,
                    totalRequests: 0,
                    formattedTokens: "0",
                    formattedRequests: "0"
                  }}
                  loading={loadingModelStats}
                  className="mt-6"
                />
              )}

              {/* 使用情况详细卡片 - 带加载状态 */}
              {loadingUsage ? (
                <UsageDetailCardSkeleton />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>最近30天使用情况</CardTitle>
                    <CardDescription>Token使用量和请求数统计</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {usageData.length === 0 ? (
                        <p className="text-sm text-muted-foreground">暂无数据</p>
                      ) : (
                        usageData.map((data, index) => (
                          <div key={`usage-${data.date}-${index}`} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>{data.date}</span>
                              <div className="flex items-center gap-4">
                                <span className="text-muted-foreground">{data.tokens} tokens</span>
                                <span className="text-muted-foreground">{data.requests} 请求</span>
                              </div>
                            </div>
                            <Progress value={(data.tokens / Math.max(1, ...usageData.map((d) => d.tokens))) * 100} />
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 账户管理 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    账户管理
                  </CardTitle>
                  <CardDescription>管理您的账户设置</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      signOut({ callbackUrl: '/login' })
                    }}
                    className="gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 账户设置 */}
            <TabsContent value="account" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    邮箱设置
                  </CardTitle>
                  <CardDescription>管理您的账户与偏好设置</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">邮箱地址</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <Button onClick={handleUpdateEmail}>更新邮箱</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    密码设置
                  </CardTitle>
                  <CardDescription>重设您的登录密码</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">当前密码</Label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">新密码</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">确认新密码</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleUpdatePassword}>更新密码</Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 偏好设置 */}
            <TabsContent value="preferences" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    外观设置
                  </CardTitle>
                  <CardDescription>自定义界面主题和外观</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>主题选择</Label>
                    <Select value={theme} onValueChange={setTheme}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">浅色模式</SelectItem>
                        <SelectItem value="dark">深色模式</SelectItem>
                        <SelectItem value="system">跟随系统</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>语言设置</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zh-CN">简体中文</SelectItem>
                        <SelectItem value="en-US">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layout className="h-5 w-5" />
                    功能设置
                  </CardTitle>
                  <CardDescription>配置应用功能和行为</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>自动保存</Label>
                      <p className="text-sm text-muted-foreground">编辑时自动保存文档</p>
                    </div>
                    <Switch checked={autoSave} onCheckedChange={setAutoSave} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>桌面通知</Label>
                      <p className="text-sm text-muted-foreground">接收重要事件的桌面通知</p>
                    </div>
                    <Switch checked={notifications} onCheckedChange={setNotifications} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>


          </Tabs>
        </div>
      </main>
      
      {/* 连接恢复组件 */}
      <ConnectionRecovery
        show={showConnectionRecovery}
        errorType="server"
        errorMessage={connectionError || undefined}
        onRecovery={handleConnectionRecovery}
        onClose={() => setShowConnectionRecovery(false)}
        showDetailedStatus={true}
      />
    </div>
  )
}
