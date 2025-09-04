"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Send, TestTube, CheckCircle, XCircle, Clock } from 'lucide-react'

interface TestResult {
  id: string
  model: string
  prompt: string
  response: string
  status: 'success' | 'error' | 'pending'
  duration: number
  timestamp: Date
  error?: string
}

const TEST_MODELS = [
  'claude-opus-4-1-20250805',
  'gemini-2.5-pro',
  'gpt-4o-mini'
]

const SAMPLE_PROMPTS = [
  '你好，请介绍一下你自己。',
  '请解释什么是人工智能。',
  '写一首关于春天的短诗。',
  '1+1等于几？请详细解释。',
  '请用简单的话解释量子物理。'
]

export function SimpleChatTestComponent() {
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [selectedModel, setSelectedModel] = useState(TEST_MODELS[0])
  const [customPrompt, setCustomPrompt] = useState('')
  const [isRunning, setIsRunning] = useState(false)

  const runSingleTest = async (model: string, prompt: string) => {
    const testId = Date.now().toString()
    const startTime = Date.now()

    // 添加待处理的测试结果
    const pendingResult: TestResult = {
      id: testId,
      model,
      prompt,
      response: '',
      status: 'pending',
      duration: 0,
      timestamp: new Date()
    }

    setTestResults(prev => [pendingResult, ...prev])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          model: model
        }),
      })

      const duration = Date.now() - startTime

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // 更新测试结果
      setTestResults(prev => prev.map(result => 
        result.id === testId 
          ? {
              ...result,
              response: data.content || '无响应',
              status: 'success' as const,
              duration
            }
          : result
      ))

    } catch (error) {
      const duration = Date.now() - startTime
      
      setTestResults(prev => prev.map(result => 
        result.id === testId 
          ? {
              ...result,
              response: '',
              status: 'error' as const,
              duration,
              error: error instanceof Error ? error.message : '未知错误'
            }
          : result
      ))
    }
  }

  const runBatchTest = async () => {
    setIsRunning(true)
    
    for (const prompt of SAMPLE_PROMPTS) {
      await runSingleTest(selectedModel, prompt)
      // 添加延迟避免请求过于频繁
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    setIsRunning(false)
  }

  const runCustomTest = async () => {
    if (!customPrompt.trim()) return
    
    setIsRunning(true)
    await runSingleTest(selectedModel, customPrompt.trim())
    setCustomPrompt('')
    setIsRunning(false)
  }

  const clearResults = () => {
    setTestResults([])
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />
    }
  }

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">成功</Badge>
      case 'error':
        return <Badge variant="destructive">失败</Badge>
      case 'pending':
        return <Badge variant="secondary">处理中</Badge>
    }
  }

  return (
    <div className="h-full flex gap-4">
      {/* 控制面板 */}
      <Card className="w-80 flex-shrink-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            聊天测试工具
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* 模型选择 */}
          <div>
            <label className="text-sm font-medium mb-2 block">选择模型</label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEST_MODELS.map(model => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 批量测试 */}
          <div>
            <Button 
              onClick={runBatchTest} 
              disabled={isRunning}
              className="w-full"
            >
              运行批量测试 ({SAMPLE_PROMPTS.length}个)
            </Button>
          </div>

          {/* 自定义测试 */}
          <div>
            <label className="text-sm font-medium mb-2 block">自定义提示</label>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="输入自定义测试提示..."
              className="min-h-[80px]"
            />
            <Button 
              onClick={runCustomTest}
              disabled={isRunning || !customPrompt.trim()}
              className="w-full mt-2"
            >
              <Send className="h-4 w-4 mr-2" />
              运行测试
            </Button>
          </div>

          {/* 清空结果 */}
          <Button 
            onClick={clearResults}
            variant="outline"
            className="w-full"
            disabled={testResults.length === 0}
          >
            清空结果
          </Button>

          {/* 统计信息 */}
          {testResults.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <div>总测试: {testResults.length}</div>
              <div>成功: {testResults.filter(r => r.status === 'success').length}</div>
              <div>失败: {testResults.filter(r => r.status === 'error').length}</div>
              <div>处理中: {testResults.filter(r => r.status === 'pending').length}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 结果面板 */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>测试结果</CardTitle>
        </CardHeader>
        
        <CardContent>
          {testResults.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              还没有测试结果，开始运行测试吧！
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {testResults.map((result) => (
                <div key={result.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <span className="font-medium">{result.model}</span>
                      {getStatusBadge(result.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {result.duration}ms
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">提示:</div>
                      <div className="text-sm bg-muted p-2 rounded">
                        {result.prompt}
                      </div>
                    </div>
                    
                    {result.status === 'success' && result.response && (
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">响应:</div>
                        <div className="text-sm bg-green-50 p-2 rounded border border-green-200">
                          {result.response}
                        </div>
                      </div>
                    )}
                    
                    {result.status === 'error' && result.error && (
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">错误:</div>
                        <div className="text-sm bg-red-50 p-2 rounded border border-red-200 text-red-700">
                          {result.error}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs text-muted-foreground mt-2">
                    {result.timestamp.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
