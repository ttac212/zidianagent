"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Header } from "@/components/header"
import { PageTransition } from "@/components/ui/page-transition"
import { ConnectionStatus } from "@/components/ui/connection-status"
import { 
  Activity,
  AlertCircle,
  CheckCircle,
  Code,
  Database,
  FileText,
  Globe,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  Settings,
  Terminal,
  Zap,
  Wrench
} from "lucide-react"

interface MCPTestResult {
  id: string
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
  duration?: number
  result?: any
  error?: string
  timestamp: number
}

interface MCPServer {
  id: string
  name: string
  description: string
  type: string
  enabled: boolean
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  toolsCount?: number
  responseTime?: number
  lastCheck?: string
  error?: string
}

interface MCPTool {
  name: string
  description: string
  serverId: string
  serverName: string
}

export default function MCPTestPage() {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [tools, setTools] = useState<MCPTool[]>([])
  const [testResults, setTestResults] = useState<MCPTestResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isTestRunning, setIsTestRunning] = useState(false)
  
  // 工具测试相关状态
  const [selectedTool, setSelectedTool] = useState('')
  const [toolArgs, setToolArgs] = useState('')

  // 获取MCP状态
  const fetchMCPStatus = async () => {
    try {
      const response = await fetch('/api/mcp')
      if (response.ok) {
        const data = await response.json()
        setServers(data.servers || [])
        setTools(data.tools || [])
      } else {
        addTestResult({
          id: `fetch-error-${Date.now()}`,
          name: 'MCP状态获取',
          status: 'error',
          error: `HTTP ${response.status}`
        })
      }
    } catch (error: any) {
      addTestResult({
        id: `fetch-error-${Date.now()}`,
        name: 'MCP状态获取',
        status: 'error',
        error: error.message
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMCPStatus()
    // 定期刷新状态
    const interval = setInterval(fetchMCPStatus, 10000) // 10秒刷新一次
    return () => clearInterval(interval)
  }, [])

  const addTestResult = (result: Omit<MCPTestResult, 'timestamp'>) => {
    setTestResults(prev => [...prev, { ...result, timestamp: Date.now() }])
  }

  const updateServerStatus = (serverId: string, status: MCPServer['status']) => {
    setServers(prev => prev.map(server => 
      server.id === serverId ? { ...server, status } : server
    ))
  }

  const connectToServer = async (serverId: string) => {
    updateServerStatus(serverId, 'connecting')
    const server = servers.find(s => s.id === serverId)
    
    addTestResult({
      id: `connect-${serverId}-${Date.now()}`,
      name: `连接到${server?.name || serverId}`,
      status: 'running'
    })

    try {
      const response = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect',
          serverId
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        updateServerStatus(serverId, 'connected')
        addTestResult({
          id: `connect-${serverId}-${Date.now()}`,
          name: `连接到${server?.name || serverId}`,
          status: 'success',
          duration: 1000,
          result: data.message
        })
        
        // 重新获取状态以更新工具列表
        await fetchMCPStatus()
      } else {
        updateServerStatus(serverId, 'error')
        addTestResult({
          id: `connect-${serverId}-${Date.now()}`,
          name: `连接到${server?.name || serverId}`,
          status: 'error',
          error: data.error || '连接失败'
        })
      }
    } catch (error: any) {
      updateServerStatus(serverId, 'error')
      addTestResult({
        id: `connect-${serverId}-${Date.now()}`,
        name: `连接到${server?.name || serverId}`,
        status: 'error',
        error: error.message
      })
    }
  }

  const disconnectFromServer = async (serverId: string) => {
    const server = servers.find(s => s.id === serverId)
    
    try {
      const response = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'disconnect',
          serverId
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        updateServerStatus(serverId, 'disconnected')
        addTestResult({
          id: `disconnect-${serverId}-${Date.now()}`,
          name: `从${server?.name || serverId}断开连接`,
          status: 'success',
          result: data.message
        })
        
        await fetchMCPStatus()
      } else {
        addTestResult({
          id: `disconnect-${serverId}-${Date.now()}`,
          name: `断开连接失败`,
          status: 'error',
          error: data.error
        })
      }
    } catch (error: any) {
      addTestResult({
        id: `disconnect-${serverId}-${Date.now()}`,
        name: `断开连接失败`,
        status: 'error',
        error: error.message
      })
    }
  }

  const testTool = async () => {
    if (!selectedTool || isTestRunning) return

    setIsTestRunning(true)
    const tool = tools.find(t => t.name === selectedTool)
    
    addTestResult({
      id: `tool-test-${selectedTool}-${Date.now()}`,
      name: `测试工具: ${selectedTool}`,
      status: 'running'
    })

    try {
      let parsedArgs = {}
      if (toolArgs.trim()) {
        try {
          parsedArgs = JSON.parse(toolArgs)
        } catch (e) {
          throw new Error('工具参数必须是有效的JSON格式')
        }
      }

      const response = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'callTool',
          toolName: selectedTool,
          toolArgs: parsedArgs
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        addTestResult({
          id: `tool-test-${selectedTool}-${Date.now()}`,
          name: `测试工具: ${selectedTool}`,
          status: 'success',
          result: data.result
        })
      } else {
        addTestResult({
          id: `tool-test-${selectedTool}-${Date.now()}`,
          name: `测试工具: ${selectedTool}`,
          status: 'error',
          error: data.error || '工具调用失败'
        })
      }
    } catch (error: any) {
      addTestResult({
        id: `tool-test-${selectedTool}-${Date.now()}`,
        name: `测试工具: ${selectedTool}`,
        status: 'error',
        error: error.message
      })
    } finally {
      setIsTestRunning(false)
    }
  }

  const runHealthCheck = async () => {
    addTestResult({
      id: `health-check-${Date.now()}`,
      name: '健康检查',
      status: 'running'
    })

    try {
      const response = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'healthCheck' })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        addTestResult({
          id: `health-check-${Date.now()}`,
          name: '健康检查',
          status: 'success',
          result: data.healthStatus
        })
      } else {
        addTestResult({
          id: `health-check-${Date.now()}`,
          name: '健康检查',
          status: 'error',
          error: data.error
        })
      }
    } catch (error: any) {
      addTestResult({
        id: `health-check-${Date.now()}`,
        name: '健康检查',
        status: 'error',
        error: error.message
      })
    }
  }

  const clearResults = () => {
    setTestResults([])
  }

  const getStatusIcon = (status: MCPServer['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'connecting':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getResultIcon = (status: MCPTestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-3 w-3 text-green-500" />
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />
      case 'running':
        return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
      default:
        return <Activity className="h-3 w-3 text-gray-500" />
    }
  }

  if (isLoading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background">
          <Header />
          <div className="container mx-auto py-6">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">加载MCP状态中...</p>
              </div>
            </div>
          </div>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <Header />
        
        {/* 连接状态指示器 */}
        <ConnectionStatus
          position="fixed"
          size="sm"
          className="top-20 right-4 z-[45]"
          animated={true}
          showDetails={false}
          autoHideWhenHealthy={true}
        />

        <div className="container mx-auto py-6">
          {/* 页面标题 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-blue-500" />
              MCP 功能测试
            </h1>
            <p className="text-muted-foreground mt-1">
              测试 Model Context Protocol (MCP) 服务器连接和工具调用
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchMCPStatus}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                刷新状态
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={runHealthCheck}
                className="gap-2"
              >
                <Activity className="h-4 w-4" />
                健康检查
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* MCP服务器状态 */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    MCP 服务器
                  </CardTitle>
                  <CardDescription>
                    管理MCP服务器连接（总计 {servers.length} 个）
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {servers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>未找到可用的MCP服务器</p>
                      <p className="text-sm">请检查服务器配置</p>
                    </div>
                  ) : (
                    servers.map((server) => (
                      <div
                        key={server.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          server.status === 'connected' 
                            ? 'border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800' 
                            : server.status === 'error'
                            ? 'border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800'
                            : 'border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            <div>
                              <div className="font-medium text-sm">{server.name}</div>
                              <div className="text-xs text-muted-foreground">{server.description}</div>
                              {server.toolsCount !== undefined && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  工具数量: {server.toolsCount}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(server.status)}
                            <Badge 
                              variant={server.status === 'connected' ? "default" : 
                                     server.status === 'error' ? "destructive" : "secondary"} 
                              className="text-xs"
                            >
                              {server.status === 'connected' ? '已连接' :
                               server.status === 'connecting' ? '连接中' :
                               server.status === 'error' ? '错误' : '未连接'}
                            </Badge>
                          </div>
                        </div>
                        {server.error && (
                          <div className="text-xs text-red-600 mb-2 font-mono">
                            {server.error}
                          </div>
                        )}
                        <div className="flex gap-2">
                          {server.status === 'connected' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => disconnectFromServer(server.id)}
                              className="h-7 text-xs"
                            >
                              断开连接
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => connectToServer(server.id)}
                              disabled={server.status === 'connecting'}
                              className="h-7 text-xs"
                            >
                              {server.status === 'connecting' ? '连接中...' : '连接'}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 工具测试和结果 */}
            <div className="lg:col-span-2 space-y-6">
              {/* 工具测试面板 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    工具测试
                  </CardTitle>
                  <CardDescription>
                    测试可用的MCP工具（共 {tools.length} 个）
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tools.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>暂无可用工具</AlertTitle>
                      <AlertDescription>
                        请先连接至少一个MCP服务器来获取可用工具。
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">选择工具</label>
                          <select
                            value={selectedTool}
                            onChange={(e) => setSelectedTool(e.target.value)}
                            className="w-full p-2 border border-border rounded-md bg-background"
                          >
                            <option value="">请选择工具</option>
                            {tools.map((tool) => (
                              <option key={tool.name} value={tool.name}>
                                {tool.name} ({tool.serverName})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">工具参数 (JSON)</label>
                          <Input
                            value={toolArgs}
                            onChange={(e) => setToolArgs(e.target.value)}
                            placeholder='例如: {"query": "测试"}'
                            className="font-mono text-xs"
                          />
                        </div>
                      </div>
                      
                      {selectedTool && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <h4 className="font-medium text-sm mb-1">工具信息</h4>
                          {(() => {
                            const tool = tools.find(t => t.name === selectedTool)
                            return tool ? (
                              <div className="text-xs text-muted-foreground space-y-1">
                                <p><strong>名称:</strong> {tool.name}</p>
                                <p><strong>描述:</strong> {tool.description}</p>
                                <p><strong>服务器:</strong> {tool.serverName}</p>
                              </div>
                            ) : null
                          })()}
                        </div>
                      )}
                      
                      <Button 
                        onClick={testTool}
                        disabled={!selectedTool || isTestRunning}
                        className="flex items-center gap-2"
                      >
                        {isTestRunning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        测试工具
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* 测试结果 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code className="h-5 w-5" />
                      测试结果
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {testResults.length} 个结果
                      </Badge>
                      <Button variant="outline" size="sm" onClick={clearResults}>
                        清空结果
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {testResults.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>还没有测试结果</p>
                      <p className="text-sm">连接服务器或测试工具来查看结果</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {testResults.map((result, index) => (
                          <div key={result.id}>
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                              {getResultIcon(result.status)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-sm">{result.name}</span>
                                  {result.duration && (
                                    <span className="text-xs text-muted-foreground">
                                      {result.duration}ms
                                    </span>
                                  )}
                                </div>
                                {result.result && (
                                  <div className="text-sm text-muted-foreground mt-1">
                                    <ScrollArea className="max-h-32">
                                      <pre className="text-xs font-mono whitespace-pre-wrap">
                                        {typeof result.result === 'string' 
                                          ? result.result 
                                          : JSON.stringify(result.result, null, 2)
                                        }
                                      </pre>
                                    </ScrollArea>
                                  </div>
                                )}
                                {result.error && (
                                  <div className="text-sm text-red-600 mt-1 font-mono">
                                    {result.error}
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground mt-1">
                                  {new Date(result.timestamp).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            {index < testResults.length - 1 && <Separator className="my-2" />}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}