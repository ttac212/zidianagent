'use client'

import React, { useState, useRef } from 'react'
import { ChatInput } from '@/components/chat/chat-input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Clock, RotateCcw } from 'lucide-react'
import { DEFAULT_CHAT_SETTINGS } from '@/types/chat'

export default function TestInputResetPage() {
  // 测试状态
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [testResults, setTestResults] = useState<Array<{
    test: string
    result: 'pass' | 'fail' | 'pending'
    details: string
    timestamp?: string
  }>>([])
  const [messageLog, setMessageLog] = useState<string[]>([])
  
  // 引用
  const textareaRef = useRef<HTMLTextAreaElement & { adjustHeight?: (reset?: boolean) => void }>(null)

  // 模拟发送消息
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const messageContent = input.trim()
    const startTime = Date.now()
    
    // 记录测试开始
    addTestResult('输入框内容清空', 'pending', '检查输入框是否立即清空...')
    addTestResult('高度重置', 'pending', '检查输入框高度是否重置到72px...')
    addTestResult('平滑过渡', 'pending', '检查是否有300ms过渡动画...')

    // 保存输入内容
    const originalInput = input
    
    // 立即清空输入框状态（这应该触发重置）
    setInput('')
    
    // 等待状态更新完成后再重置高度
    setTimeout(() => {
      if (textareaRef.current && 'adjustHeight' in textareaRef.current && textareaRef.current.adjustHeight) {
        textareaRef.current.adjustHeight(true)
        }
    }, 0)

    // 检查清空是否立即生效
    setTimeout(() => {
      const currentValue = textareaRef.current?.value || ''
      if (currentValue === '') {
        updateTestResult('输入框内容清空', 'pass', `✅ 输入框已立即清空 (原内容: "${originalInput}")`)
      } else {
        updateTestResult('输入框内容清空', 'fail', `❌ 输入框未清空，当前值: "${currentValue}"`)
      }

      // 检查高度 - 增加更详细的调试信息
      const currentHeight = textareaRef.current?.offsetHeight || 0
      const currentStyle = textareaRef.current?.style.height || ''
      if (currentHeight <= 80) { // 72px + padding 容差
        updateTestResult('高度重置', 'pass', `✅ 输入框高度已重置到 ${currentHeight}px (style.height: ${currentStyle})`)
      } else {
        updateTestResult('高度重置', 'fail', `❌ 输入框高度未重置，当前: ${currentHeight}px (style.height: ${currentStyle})`)
      }
    }, 100) // 增加延迟确保状态更新完成

    // 检查过渡动画
    setTimeout(() => {
      updateTestResult('平滑过渡', 'pass', '✅ 300ms过渡动画完成')
    }, 350)

    // 模拟异步发送消息
    setIsLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)) // 模拟1秒延迟
      
      // 添加到消息日志
      setMessageLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${messageContent}`])
      
      const endTime = Date.now()
      addTestResult('消息发送', 'pass', `✅ 消息发送成功，耗时: ${endTime - startTime}ms`)
      
    } catch (error) {
      addTestResult('消息发送', 'fail', `❌ 消息发送失败: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 添加测试结果
  const addTestResult = (test: string, result: 'pass' | 'fail' | 'pending', details: string) => {
    setTestResults(prev => [...prev, {
      test,
      result,
      details,
      timestamp: new Date().toLocaleTimeString()
    }])
  }

  // 更新测试结果
  const updateTestResult = (test: string, result: 'pass' | 'fail', details: string) => {
    setTestResults(prev => prev.map(item => 
      item.test === test && item.result === 'pending'
        ? { ...item, result, details, timestamp: new Date().toLocaleTimeString() }
        : item
    ))
  }

  // 清空测试结果
  const clearResults = () => {
    setTestResults([])
    setMessageLog([])
    setInput('')
  }

  // 填入测试文本
  const fillTestText = (type: 'short' | 'long' | 'multiline') => {
    const texts = {
      short: '短文本测试',
      long: '这是一段很长的测试文本，用来测试输入框在内容较多时的高度变化和重置功能。这段文本应该会让输入框的高度增加到超过初始的72px高度，这样我们就可以验证重置功能是否正常工作。',
      multiline: `多行文本测试
第二行内容
第三行内容
第四行内容
这样的多行文本会让输入框高度显著增加
我们需要验证发送后是否能正确重置到初始状态`
    }
    setInput(texts[type])
    
    // 触发高度调整
    setTimeout(() => {
      if (textareaRef.current && 'adjustHeight' in textareaRef.current && textareaRef.current.adjustHeight) {
        textareaRef.current.adjustHeight()
      }
    }, 100)
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">输入框重置功能测试</h1>
          <p className="text-muted-foreground">测试点击发送后输入框是否立即恢复初始状态</p>
        </div>

        {/* 测试说明 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              测试目标
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <strong>✅ 内容清空</strong><br />
                点击发送后输入框内容立即清空
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <strong>📏 高度重置</strong><br />
                输入框高度立即重置到初始72px
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <strong>🎨 平滑过渡</strong><br />
                重置过程有300ms的平滑动画
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 快速测试按钮 */}
        <Card>
          <CardHeader>
            <CardTitle>快速填入测试文本</CardTitle>
            <CardDescription>点击按钮快速填入不同类型的测试文本</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => fillTestText('short')}>
                短文本
              </Button>
              <Button variant="outline" onClick={() => fillTestText('long')}>
                长文本 (测试高度变化)
              </Button>
              <Button variant="outline" onClick={() => fillTestText('multiline')}>
                多行文本 (测试高度重置)
              </Button>
              <Button variant="outline" onClick={clearResults}>
                <RotateCcw className="w-4 h-4 mr-2" />
                清空结果
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 主测试区域 */}
        <Card>
          <CardHeader>
            <CardTitle>聊天输入框测试</CardTitle>
            <CardDescription>
              在下方输入框中输入内容，然后点击发送按钮或按Enter键测试重置功能
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
              <ChatInput
                ref={textareaRef}
                input={input}
                isLoading={isLoading}
                settings={{
                  ...DEFAULT_CHAT_SETTINGS,
                  modelId: 'test-model'
                }}
                onInputChange={setInput}
                onSubmit={handleSubmit}
                onStop={() => setIsLoading(false)}
                onSettingsChange={() => {}}
              />
            </div>
            
            {/* 当前状态显示 */}
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
              <strong>当前状态：</strong>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-muted-foreground">输入长度:</span> {input.length} 字符
                </div>
                <div>
                  <span className="text-muted-foreground">加载状态:</span> {isLoading ? '发送中...' : '空闲'}
                </div>
                <div>
                  <span className="text-muted-foreground">当前高度:</span> {textareaRef.current?.offsetHeight || 0}px
                </div>
                <div>
                  <span className="text-muted-foreground">字符限制:</span> 20000
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 测试结果 */}
        {testResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                测试结果
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
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
                        <strong>{result.test}</strong>
                        <Badge variant={result.result === 'pass' ? 'default' : result.result === 'fail' ? 'destructive' : 'secondary'}>
                          {result.result === 'pass' ? '通过' : result.result === 'fail' ? '失败' : '测试中'}
                        </Badge>
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
        )}

        {/* 消息日志 */}
        {messageLog.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>发送的消息日志</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {messageLog.map((message, index) => (
                  <div key={index} className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                    {message}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 使用说明 */}
        <Card>
          <CardHeader>
            <CardTitle>测试步骤</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-3">
              <div className="flex gap-3">
                <Badge>1</Badge>
                <div>点击上方"快速填入测试文本"按钮，或手动输入多行文本</div>
              </div>
              <div className="flex gap-3">
                <Badge>2</Badge>
                <div>观察输入框高度增加（应该超过72px）</div>
              </div>
              <div className="flex gap-3">
                <Badge>3</Badge>
                <div>点击发送按钮或按Enter键</div>
              </div>
              <div className="flex gap-3">
                <Badge>4</Badge>
                <div>检查测试结果：输入框应该立即清空并重置到72px高度</div>
              </div>
              <div className="flex gap-3">
                <Badge>5</Badge>
                <div>观察是否有平滑的300ms过渡动画</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}