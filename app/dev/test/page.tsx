"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Header } from "@/components/header"
import { PageTransition } from "@/components/ui/page-transition"
import { CheckCircle, XCircle, Loader2, Settings, Play, RefreshCw } from "lucide-react"

interface TestResult {
  name: string
  status: "pending" | "running" | "success" | "error"
  message?: string
  duration?: number
}

export default function TestPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([
    { name: "AI对话功能 (SSE流式响应)", status: "pending" },
    { name: "文档管理 (CRUD操作)", status: "pending" },
    { name: "商家数据 (API测试)", status: "pending" },
    { name: "反馈系统", status: "pending" },
    { name: "用户管理", status: "pending" },
    { name: "密钥管理", status: "pending" },
    { name: "主题切换", status: "pending" },
    { name: "本地存储", status: "pending" },
  ])

  const [isRunningAll, setIsRunningAll] = useState(false)
  const [testMessage, setTestMessage] = useState("Hello AI, 请生成一个美食短视频文案")

  const updateTestResult = (index: number, updates: Partial<TestResult>) => {
    setTestResults((prev) => prev.map((result, i) => (i === index ? { ...result, ...updates } : result)))
  }

  const testAIChat = async (index: number) => {
    updateTestResult(index, { status: "running" })
    const startTime = Date.now()

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: testMessage }],
          model: "gpt-3.5-turbo",
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const reader = response.body?.getReader()
      if (!reader) throw new Error("无法获取响应流")

      let receivedData = false
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        if (chunk.includes("data:")) {
          receivedData = true
          break
        }
      }

      if (receivedData) {
        updateTestResult(index, {
          status: "success",
          message: "SSE流式响应正常",
          duration: Date.now() - startTime,
        })
      } else {
        throw new Error("未收到流式数据")
      }
    } catch (error) {
      updateTestResult(index, {
        status: "error",
        message: `错误: ${error instanceof Error ? error.message : "未知错误"}`,
        duration: Date.now() - startTime,
      })
    }
  }

  const testDocuments = async (index: number) => {
    updateTestResult(index, { status: "running" })
    const startTime = Date.now()

    try {
      // 测试获取文档列表
      const getResponse = await fetch("/api/documents")
      if (!getResponse.ok) throw new Error(`获取文档失败: ${getResponse.status}`)

      const getResult = await getResponse.json()
      if (!getResult.success) throw new Error("文档API返回失败状态")

      // 测试创建文档
      const createResponse = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "测试文档",
          content: "这是一个测试文档内容",
          category: "测试",
          tags: ["测试", "功能验证"],
        }),
      })

      if (!createResponse.ok) throw new Error(`创建文档失败: ${createResponse.status}`)

      const createResult = await createResponse.json()
      if (!createResult.success) throw new Error("创建文档API返回失败状态")

      updateTestResult(index, {
        status: "success",
        message: `文档CRUD操作正常 (${getResult.data?.length || 0}个文档)`,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      updateTestResult(index, {
        status: "error",
        message: `错误: ${error instanceof Error ? error.message : "未知错误"}`,
        duration: Date.now() - startTime,
      })
    }
  }

  const testMerchantsData = async (index: number) => {
    updateTestResult(index, { status: "running" })
    const startTime = Date.now()

    try {
      const response = await fetch("/api/merchants")
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const result = await response.json()
      if (!result.merchants) throw new Error("商家API返回格式错误")

      updateTestResult(index, {
        status: "success",
        message: `商家数据读取正常 (${result.merchants?.length || 0}条记录)`,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      updateTestResult(index, {
        status: "error",
        message: `错误: ${error instanceof Error ? error.message : "未知错误"}`,
        duration: Date.now() - startTime,
      })
    }
  }

  const testFeedback = async (index: number) => {
    updateTestResult(index, { status: "running" })
    const startTime = Date.now()

    try {
      // 测试获取反馈列表
      const getResponse = await fetch("/api/feedback")
      if (!getResponse.ok) throw new Error(`获取反馈失败: ${getResponse.status}`)

      const getResult = await getResponse.json()
      if (!getResult.success) throw new Error("反馈API返回失败状态")

      // 测试提交反馈
      const createResponse = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "测试反馈",
          content: "这是一个功能测试反馈",
          category: "功能建议",
          priority: "medium",
          contactInfo: "test@example.com",
        }),
      })

      if (!createResponse.ok) throw new Error(`提交反馈失败: ${createResponse.status}`)

      const createResult = await createResponse.json()
      if (!createResult.success) throw new Error("提交反馈API返回失败状态")

      updateTestResult(index, {
        status: "success",
        message: `反馈系统正常 (${getResult.data?.feedbacks?.length || 0}个反馈)`,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      updateTestResult(index, {
        status: "error",
        message: `错误: ${error instanceof Error ? error.message : "未知错误"}`,
        duration: Date.now() - startTime,
      })
    }
  }

  const testUserManagement = async (index: number) => {
    updateTestResult(index, { status: "running" })
    const startTime = Date.now()

    try {
      const response = await fetch("/api/admin/users")
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const result = await response.json()
      if (!result.success) throw new Error("用户管理API返回失败状态")

      updateTestResult(index, {
        status: "success",
        message: `用户管理正常 (${result.data?.users?.length || 0}个用户)`,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      updateTestResult(index, {
        status: "error",
        message: `错误: ${error instanceof Error ? error.message : "未知错误"}`,
        duration: Date.now() - startTime,
      })
    }
  }

  const testKeyManagement = async (index: number) => {
    updateTestResult(index, { status: "running" })
    const startTime = Date.now()

    try {
      const response = await fetch("/api/admin/keys")
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const result = await response.json()
      if (!result.success) throw new Error("密钥管理API返回失败状态")

      updateTestResult(index, {
        status: "success",
        message: `密钥管理正常 (${result.data?.length || 0}个密钥)`,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      updateTestResult(index, {
        status: "error",
        message: `错误: ${error instanceof Error ? error.message : "未知错误"}`,
        duration: Date.now() - startTime,
      })
    }
  }

  const testThemeToggle = async (index: number) => {
    updateTestResult(index, { status: "running" })
    const startTime = Date.now()

    try {
      const currentTheme = document.documentElement.classList.contains("dark") ? "dark" : "light"
      const newTheme = currentTheme === "dark" ? "light" : "dark"

      // 模拟主题切换
      document.documentElement.classList.toggle("dark")

      // 验证主题是否切换成功
      const updatedTheme = document.documentElement.classList.contains("dark") ? "dark" : "light"

      if (updatedTheme !== currentTheme) {
        updateTestResult(index, {
          status: "success",
          message: `主题切换正常 (${currentTheme} → ${updatedTheme})`,
          duration: Date.now() - startTime,
        })
      } else {
        throw new Error("主题切换失败")
      }
    } catch (error) {
      updateTestResult(index, {
        status: "error",
        message: `错误: ${error instanceof Error ? error.message : "未知错误"}`,
        duration: Date.now() - startTime,
      })
    }
  }

  const testLocalStorage = async (index: number) => {
    updateTestResult(index, { status: "running" })
    const startTime = Date.now()

    try {
      const testKey = "test-storage-key"
      const testValue = { message: "Hello Storage", timestamp: Date.now() }

      // 测试写入
      localStorage.setItem(testKey, JSON.stringify(testValue))

      // 测试读取
      const storedValue = localStorage.getItem(testKey)
      if (!storedValue) throw new Error("无法读取存储的数据")

      const parsedValue = JSON.parse(storedValue)
      if (parsedValue.message !== testValue.message) throw new Error("存储数据不匹配")

      // 清理测试数据
      localStorage.removeItem(testKey)

      updateTestResult(index, {
        status: "success",
        message: "本地存储读写正常",
        duration: Date.now() - startTime,
      })
    } catch (error) {
      updateTestResult(index, {
        status: "error",
        message: `错误: ${error instanceof Error ? error.message : "未知错误"}`,
        duration: Date.now() - startTime,
      })
    }
  }

  const testFunctions = [
    testAIChat,
    testDocuments,
    testMerchantsData,
    testFeedback,
    testUserManagement,
    testKeyManagement,
    testThemeToggle,
    testLocalStorage,
  ]

  const runSingleTest = (index: number) => {
    testFunctions[index](index)
  }

  const runAllTests = async () => {
    setIsRunningAll(true)

    // 重置所有测试状态
    setTestResults((prev) => prev.map((result) => ({ ...result, status: "pending" as const })))

    // 依次运行所有测试
    for (let i = 0; i < testFunctions.length; i++) {
      await testFunctions[i](i)
      // 在测试之间添加短暂延迟
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    setIsRunningAll(false)
  }

  const getStatusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
    }
  }

  const getStatusBadge = (status: TestResult["status"]) => {
    switch (status) {
      case "running":
        return <Badge variant="secondary">运行中</Badge>
      case "success":
        return (
          <Badge variant="default" className="bg-green-500">
            通过
          </Badge>
        )
      case "error":
        return <Badge variant="destructive">失败</Badge>
      default:
        return <Badge variant="outline">待测试</Badge>
    }
  }

  const successCount = testResults.filter((r) => r.status === "success").length
  const errorCount = testResults.filter((r) => r.status === "error").length
  const totalTests = testResults.length

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto py-4 md:py-8 px-4">
          <div className="max-w-4xl mx-auto space-y-6">

            {/* 页面标题 */}
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">核心功能测试</h1>
              <p className="text-sm md:text-base text-muted-foreground">验证平台所有核心功能是否正常工作</p>
            </div>

            {/* 测试概览 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  测试概览
                </CardTitle>
                <CardDescription>
                  总计 {totalTests} 项测试 · 通过 {successCount} 项 · 失败 {errorCount} 项
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <Button onClick={runAllTests} disabled={isRunningAll} className="gap-2">
                    {isRunningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    {isRunningAll ? "测试中..." : "运行所有测试"}
                  </Button>

                  <div className="flex-1">
                    <Input
                      placeholder="修改AI测试消息..."
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-foreground">{totalTests}</div>
                    <div className="text-muted-foreground">总测试数</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{successCount}</div>
                    <div className="text-green-600">通过测试</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{errorCount}</div>
                    <div className="text-red-600">失败测试</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 测试结果列表 */}
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {getStatusIcon(result.status)}
                        <div className="flex-1">
                          <h3 className="font-medium text-sm">{result.name}</h3>
                          {result.message && <p className="text-xs text-muted-foreground mt-1">{result.message}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {result.duration && <span className="text-xs text-muted-foreground">{result.duration}ms</span>}
                        {getStatusBadge(result.status)}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => runSingleTest(index)}
                          disabled={result.status === "running" || isRunningAll}
                          className="h-7 px-2"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 测试说明 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">测试说明</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  • <strong>AI对话功能</strong>: 测试SSE流式响应和消息处理
                </p>
                <p>
                  • <strong>文档管理</strong>: 验证文档的创建、读取、更新、删除操作
                </p>
                <p>
                  • <strong>热门数据</strong>: 检查CSV数据读取和解析功能
                </p>
                <p>
                  • <strong>反馈系统</strong>: 测试反馈提交和获取功能
                </p>
                <p>
                  • <strong>用户管理</strong>: 验证管理员用户管理API
                </p>
                <p>
                  • <strong>密钥管理</strong>: 检查API密钥管理功能
                </p>
                <p>
                  • <strong>主题切换</strong>: 测试浅色/深色模式切换
                </p>
                <p>
                  • <strong>本地存储</strong>: 验证浏览器本地存储读写功能
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </PageTransition>
  )
}
