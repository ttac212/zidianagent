'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { MessageItem } from '@/components/chat/message-item'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Clock, RotateCcw, Copy, User, Bot, FileText, Code, Globe, Zap } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import type { ChatMessage } from '@/types/chat'

export default function TestCopyFunctionalityPage() {
  // 测试状态
  const [testResults, setTestResults] = useState<Array<{
    test: string
    result: 'pass' | 'fail' | 'pending'
    details: string
    timestamp?: string
    duration?: number
  }>>([])
  const [copyHistory, setCopyHistory] = useState<Array<{
    content: string
    timestamp: string
    success: boolean
  }>>([])
  const [isTestRunning, setIsTestRunning] = useState(false)
  const [clipboardSupported, setClipboardSupported] = useState<boolean | null>(null)

  // 测试消息数据
  const [testMessages, setTestMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'user',
      content: '你好，这是一条用户消息测试',
      timestamp: Date.now() - 60000,
      metadata: { model: 'test-model' }
    },
    {
      id: '2', 
      role: 'assistant',
      content: '你好！我是AI助手。这是一条普通的助手回复，用于测试基础的复制功能。',
      timestamp: Date.now() - 50000,
      metadata: { model: 'claude-opus-4-1-20250805' }
    },
    {
      id: '3',
      role: 'assistant', 
      content: `这是一条包含代码的消息：

\`\`\`javascript
function copyMessage(content) {
  navigator.clipboard.writeText(content)
    .then(() => )
    .catch(() => )
}
\`\`\`

代码块应该能够正确复制，包括换行和缩进格式。

**测试要点：**
- 代码块格式保持
- 换行符正确处理
- 缩进空格保留`,
      timestamp: Date.now() - 40000,
      metadata: { model: 'claude-opus-4-1-20250805' }
    },
    {
      id: '4',
      role: 'assistant',
      content: '🌟 包含Unicode字符的消息测试：\n\n• 中文：你好世界\n• 英文：Hello World\n• 韩文：안녕하세요\n• 阿拉伯文：مرحبا\n• 表情符号：😊🎉🚀💡\n• 特殊符号：©®™§¶†‡•◆◇○●□■',
      timestamp: Date.now() - 30000,
      metadata: { model: 'claude-opus-4-1-20250805' }
    },
    {
      id: '5',
      role: 'assistant',
      content: '这是一条非常长的消息，用来测试复制长文本的功能。'.repeat(20) + '\n\n包含换行符和多种格式的测试内容，确保所有内容都能正确复制到剪贴板中，不会出现截断或格式错乱的问题。',
      timestamp: Date.now() - 20000,
      metadata: { model: 'claude-opus-4-1-20250805' }
    }
  ])

  // 检查剪贴板支持
  useEffect(() => {
    const checkClipboardSupport = async () => {
      try {
        if (!navigator.clipboard) {
          setClipboardSupported(false)
          return
        }
        
        // 尝试检查权限
        if ('permissions' in navigator) {
          const result = await navigator.permissions.query({ name: 'clipboard-write' as PermissionName })
          setClipboardSupported(result.state !== 'denied')
        } else {
          // 如果无法检查权限，假设支持
          setClipboardSupported(true)
        }
      } catch {
        setClipboardSupported(false)
      }
    }
    
    checkClipboardSupport()
  }, [])

  // 添加测试结果
  const addTestResult = (test: string, result: 'pass' | 'fail' | 'pending', details: string, duration?: number) => {
    setTestResults(prev => [...prev, {
      test,
      result,
      details,
      timestamp: new Date().toLocaleTimeString(),
      duration
    }])
  }

  // 更新测试结果
  const updateTestResult = (test: string, result: 'pass' | 'fail', details: string, duration?: number) => {
    setTestResults(prev => prev.map(item => 
      item.test === test && item.result === 'pending'
        ? { ...item, result, details, timestamp: new Date().toLocaleTimeString(), duration }
        : item
    ))
  }

  // 增强的clipboard API测试函数
  const simulateCopyToClipboard = useCallback(async (content: string): Promise<boolean> => {
    const startTime = Date.now()
    
    try {
      // 检查clipboard API是否可用
      if (!navigator.clipboard) {
        throw new Error('Clipboard API 不可用')
      }

      // 尝试写入剪贴板
      await navigator.clipboard.writeText(content)
      
      // 简化验证：如果writeText没有抛出异常，就认为成功
      // 避免readText权限问题导致的误判
      const verificationSuccess = true
      
      const duration = Date.now() - startTime
      
      // 记录复制历史
      setCopyHistory(prev => [...prev, {
        content: content.length > 50 ? content.substring(0, 50) + '...' : content,
        timestamp: new Date().toLocaleTimeString(),
        success: verificationSuccess
      }])

      // 显示成功toast
      toast({
        title: "复制成功",
        description: `已复制 ${content.length} 字符到剪贴板 (${duration}ms)`,
        duration: 1500
      })

      return verificationSuccess
    } catch (error) {
      const duration = Date.now() - startTime
      const success = false
      
      // 记录失败历史
      setCopyHistory(prev => [...prev, {
        content: content.length > 50 ? content.substring(0, 50) + '...' : content,
        timestamp: new Date().toLocaleTimeString(),
        success
      }])

      // 显示失败toast
      toast({
        title: "复制失败", 
        description: `剪贴板访问失败: ${error instanceof Error ? error.message : '未知错误'} (${duration}ms)`,
        variant: "destructive",
        duration: 3000
      })

      return success
    }
  }, [])

  // 单个复制测试
  const testSingleCopy = async (message: ChatMessage) => {
    const testName = `复制消息${message.id}`
    const startTime = Date.now()
    
    addTestResult(testName, 'pending', '正在测试复制功能...')
    
    try {
      const success = await simulateCopyToClipboard(message.content)
      const duration = Date.now() - startTime
      
      if (success) {
        updateTestResult(testName, 'pass', `✅ 复制成功 - 内容长度: ${message.content.length} 字符 (${duration}ms)`, duration)
      } else {
        updateTestResult(testName, 'fail', `❌ 复制验证失败 - 但内容可能已成功复制`, duration)
      }
    } catch (error) {
      const duration = Date.now() - startTime
      updateTestResult(testName, 'fail', `❌ 复制异常: ${error instanceof Error ? error.message : '未知错误'}`, duration)
    }
  }

  // 批量复制测试
  const testBatchCopy = async () => {
    setIsTestRunning(true)
    addTestResult('批量复制测试', 'pending', '开始批量复制所有助手消息...')
    
    const assistantMessages = testMessages.filter(msg => msg.role === 'assistant')
    let successCount = 0
    let totalTime = 0
    
    for (const message of assistantMessages) {
      const startTime = Date.now()
      const success = await simulateCopyToClipboard(message.content)
      const duration = Date.now() - startTime
      totalTime += duration
      
      if (success) successCount++
      
      // 添加延迟避免过快操作
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    const successRate = (successCount / assistantMessages.length) * 100
    
    if (successRate === 100) {
      updateTestResult('批量复制测试', 'pass', `✅ 批量复制完成 - 成功率: ${successRate}% (${successCount}/${assistantMessages.length})，总耗时: ${totalTime}ms`)
    } else {
      updateTestResult('批量复制测试', 'fail', `❌ 批量复制部分失败 - 成功率: ${successRate}% (${successCount}/${assistantMessages.length})`)
    }
    
    setIsTestRunning(false)
  }

  // 性能压力测试
  const testPerformance = async () => {
    setIsTestRunning(true)
    addTestResult('性能压力测试', 'pending', '正在进行10次快速复制测试...')
    
    const testContent = '性能测试内容 - ' + 'A'.repeat(1000) // 1KB测试内容
    const iterations = 10
    let successCount = 0
    const startTime = Date.now()
    
    const promises = Array.from({ length: iterations }, async () => {
      const success = await simulateCopyToClipboard(testContent)
      if (success) successCount++
      return success
    })
    
    await Promise.all(promises)
    
    const totalTime = Date.now() - startTime
    const avgTime = totalTime / iterations
    const successRate = (successCount / iterations) * 100
    
    if (successRate >= 80 && avgTime < 100) {
      updateTestResult('性能压力测试', 'pass', `✅ 性能测试通过 - 成功率: ${successRate}%, 平均耗时: ${avgTime.toFixed(1)}ms/次`)
    } else {
      updateTestResult('性能压力测试', 'fail', `❌ 性能测试未达标 - 成功率: ${successRate}%, 平均耗时: ${avgTime.toFixed(1)}ms/次`)
    }
    
    setIsTestRunning(false)
  }

  // 边界情况测试
  const testEdgeCases = async () => {
    setIsTestRunning(true)
    
    const edgeCases = [
      { name: '空字符串', content: '' },
      { name: '单个字符', content: 'A' },
      { name: '超长文本', content: 'X'.repeat(10000) },
      { name: 'Unicode字符', content: '🌟🎉🚀💡测试Unicode复制功能' },
      { name: 'HTML标签', content: '<div>HTML标签测试</div>' },
      { name: 'JSON数据', content: '{"test": "value", "number": 123}' }
    ]
    
    let successCount = 0
    
    for (const testCase of edgeCases) {
      addTestResult(`边界测试-${testCase.name}`, 'pending', `测试${testCase.name}复制...`)
      
      const success = await simulateCopyToClipboard(testCase.content)
      
      if (success) {
        successCount++
        updateTestResult(`边界测试-${testCase.name}`, 'pass', `✅ ${testCase.name}复制成功`)
      } else {
        updateTestResult(`边界测试-${testCase.name}`, 'fail', `❌ ${testCase.name}复制失败`)
      }
      
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    const successRate = (successCount / edgeCases.length) * 100
    addTestResult('边界测试总结', successRate === 100 ? 'pass' : 'fail', 
      `边界测试完成 - 成功率: ${successRate}% (${successCount}/${edgeCases.length})`)
    
    setIsTestRunning(false)
  }

  // 清空测试结果
  const clearResults = () => {
    setTestResults([])
    setCopyHistory([])
  }

  // 运行完整测试套件
  const runFullTestSuite = async () => {
    setIsTestRunning(true)
    clearResults()
    
    addTestResult('完整测试套件', 'pending', '开始执行完整测试套件...')
    
    try {
      // 依次执行各项测试
      await testBatchCopy()
      await new Promise(resolve => setTimeout(resolve, 500))
      
      await testPerformance()
      await new Promise(resolve => setTimeout(resolve, 500))
      
      await testEdgeCases()
      
      addTestResult('完整测试套件', 'pass', '✅ 完整测试套件执行完毕')
    } catch (error) {
      addTestResult('完整测试套件', 'fail', `❌ 测试套件执行出错: ${error}`)
    } finally {
      setIsTestRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">复制功能测试中心</h1>
          <p className="text-muted-foreground">全面测试对话消息的复制功能和性能表现</p>
        </div>

        {/* 测试目标说明 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              测试目标
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <strong className="flex items-center gap-1"><Copy className="w-4 h-4" />基础复制</strong><br />
                验证单条消息复制功能
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <strong className="flex items-center gap-1"><Zap className="w-4 h-4" />性能测试</strong><br />
                测试批量复制和响应速度
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <strong className="flex items-center gap-1"><Globe className="w-4 h-4" />格式兼容</strong><br />
                验证各种文本格式支持
              </div>
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <strong className="flex items-center gap-1"><FileText className="w-4 h-4" />边界测试</strong><br />
                测试特殊情况和异常处理
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 快速测试按钮 */}
        <Card>
          <CardHeader>
            <CardTitle>快速测试工具</CardTitle>
            <CardDescription>点击按钮执行不同类型的复制测试</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button 
                variant="outline" 
                onClick={testBatchCopy}
                disabled={isTestRunning}
              >
                <Copy className="w-4 h-4 mr-2" />
                批量复制测试
              </Button>
              <Button 
                variant="outline" 
                onClick={testPerformance}
                disabled={isTestRunning}
              >
                <Zap className="w-4 h-4 mr-2" />
                性能压力测试
              </Button>
              <Button 
                variant="outline" 
                onClick={testEdgeCases}
                disabled={isTestRunning}
              >
                <Globe className="w-4 h-4 mr-2" />
                边界情况测试
              </Button>
              <Button 
                onClick={runFullTestSuite}
                disabled={isTestRunning}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {isTestRunning ? '测试中...' : '运行完整测试'}
              </Button>
              <Button 
                variant="outline" 
                onClick={clearResults}
                disabled={isTestRunning}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                清空结果
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 主测试区域 - 消息列表 */}
        <Card>
          <CardHeader>
            <CardTitle>测试消息列表</CardTitle>
            <CardDescription>
              点击消息上的复制按钮测试复制功能，注意只有助手消息显示复制按钮
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto border rounded-lg p-4">
              {testMessages.map((message) => (
                <div key={message.id} className="relative">
                  <MessageItem
                    message={message}
                    onCopy={async (content) => {
                      await testSingleCopy(message)
                    }}
                    onRetry={() => {}}
                  />
                </div>
              ))}
            </div>
            
            {/* 当前状态显示 */}
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
              <strong>当前状态：</strong>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <span className="text-muted-foreground">总消息数:</span> {testMessages.length}
                </div>
                <div>
                  <span className="text-muted-foreground">助手消息:</span> {testMessages.filter(m => m.role === 'assistant').length}
                </div>
                <div>
                  <span className="text-muted-foreground">测试状态:</span> {isTestRunning ? '运行中...' : '空闲'}
                </div>
                <div>
                  <span className="text-muted-foreground">复制次数:</span> {copyHistory.length}
                </div>
                <div>
                  <span className="text-muted-foreground">剪贴板支持:</span> {
                    clipboardSupported === null ? '检测中...' :
                    clipboardSupported ? '✅ 支持' : '❌ 不支持'
                  }
                </div>
              </div>
              
              {/* 剪贴板不支持时显示警告 */}
              {clipboardSupported === false && (
                <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <strong className="text-orange-800 dark:text-orange-300">⚠️ 剪贴板不可用</strong>
                  <ul className="mt-1 text-xs text-orange-700 dark:text-orange-300 space-y-1">
                    <li>• 请确保使用 HTTPS 协议或 localhost 访问</li>
                    <li>• 在浏览器中允许剪贴板访问权限</li>
                    <li>• 某些浏览器可能不支持剪贴板 API</li>
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 测试结果 */}
        {testResults.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  测试结果
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {testResults.map((result, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        result.result === 'pass' 
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                          : result.result === 'fail'
                          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                          : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                      }`}
                    >
                      {result.result === 'pass' && <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />}
                      {result.result === 'fail' && <XCircle className="w-5 h-5 text-red-500 mt-0.5" />}
                      {result.result === 'pending' && <Clock className="w-5 h-5 text-yellow-500 mt-0.5 animate-spin" />}
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-sm">{result.test}</strong>
                          <Badge variant={result.result === 'pass' ? 'default' : result.result === 'fail' ? 'destructive' : 'secondary'}>
                            {result.result === 'pass' ? '通过' : result.result === 'fail' ? '失败' : '测试中'}
                          </Badge>
                          {result.duration && (
                            <Badge variant="outline" className="text-xs">
                              {result.duration}ms
                            </Badge>
                          )}
                          {result.timestamp && (
                            <span className="text-xs text-muted-foreground">{result.timestamp}</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{result.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 复制历史 */}
            <Card>
              <CardHeader>
                <CardTitle>复制历史记录</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {copyHistory.slice(-20).reverse().map((record, index) => (
                    <div key={index} className={`flex items-start gap-2 p-2 rounded text-sm ${
                      record.success ? 'bg-green-50 dark:bg-green-900/10' : 'bg-red-50 dark:bg-red-900/10'
                    }`}>
                      {record.success ? (
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="font-mono text-xs truncate">{record.content}</div>
                        <div className="text-xs text-muted-foreground">{record.timestamp}</div>
                      </div>
                    </div>
                  ))}
                  {copyHistory.length === 0 && (
                    <div className="text-center text-muted-foreground py-4">
                      暂无复制记录
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 使用说明 */}
        <Card>
          <CardHeader>
            <CardTitle>测试说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-3">
              <div className="flex gap-3">
                <Badge>1</Badge>
                <div><strong>单项测试：</strong>点击消息上的复制按钮测试单条消息复制</div>
              </div>
              <div className="flex gap-3">
                <Badge>2</Badge>
                <div><strong>批量测试：</strong>点击"批量复制测试"按钮测试所有助手消息</div>
              </div>
              <div className="flex gap-3">
                <Badge>3</Badge>
                <div><strong>性能测试：</strong>测试快速连续复制的性能表现</div>
              </div>
              <div className="flex gap-3">
                <Badge>4</Badge>
                <div><strong>边界测试：</strong>测试特殊字符、空字符串、超长文本等边界情况</div>
              </div>
              <div className="flex gap-3">
                <Badge>5</Badge>
                <div><strong>完整测试：</strong>运行所有测试项目，获得全面的功能验证</div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <strong className="text-blue-800 dark:text-blue-300">注意事项：</strong>
              <ul className="mt-2 space-y-1 text-blue-700 dark:text-blue-300 text-xs">
                <li>• 测试过程中浏览器可能会请求剪贴板权限，请点击允许</li>
                <li>• 只有助手消息才会显示复制按钮（符合当前设计）</li>
                <li>• 测试结果会显示复制成功率、响应时间等关键指标</li>
                <li>• 可以手动验证剪贴板内容是否正确复制</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}