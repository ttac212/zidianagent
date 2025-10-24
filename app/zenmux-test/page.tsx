'use client'

import { useState, useRef, useEffect } from 'react'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Send, Loader2, AlertCircle, CheckCircle2, Brain } from 'lucide-react'
import { toast } from '@/lib/toast/toast'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface Message {
  role: 'user' | 'assistant'
  content: string
  reasoning?: string // 推理内容
}

export default function ZenMuxTestPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingReasoning, setStreamingReasoning] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 推理参数
  const [reasoningEffort, setReasoningEffort] = useState<string>('none')
  const [reasoningMaxTokens, setReasoningMaxTokens] = useState<string>('')

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, streamingReasoning])

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
    }

    // 添加用户消息
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setStreamingContent('')
    setStreamingReasoning('')

    try {
      // 构建请求体
      const requestBody: any = {
        messages: [...messages, userMessage],
      }

      // 添加推理参数（根据 ZenMux 官方文档）
      if (reasoningEffort === 'none') {
        // 明确禁用推理
        requestBody.reasoning = { enabled: false }
      } else {
        // 启用推理模式
        // 1. reasoning_effort 参数（顶层）
        requestBody.reasoning_effort = reasoningEffort

        // 2. reasoning 对象参数
        const reasoningObj: any = {
          effort: reasoningEffort, // 等价于 reasoning_effort
          enabled: true,
        }

        // 如果设置了 reasoning.max_tokens
        if (reasoningMaxTokens && parseInt(reasoningMaxTokens) > 0) {
          reasoningObj.max_tokens = parseInt(reasoningMaxTokens)
        }

        requestBody.reasoning = reasoningObj
      }

      const response = await fetch('/api/zenmux-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '请求失败')
      }

      // 处理SSE流
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应流')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''
      let fullReasoning = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue

          // 解析SSE数据（支持两种格式：data: {} 和 data:{}）
          if (line.startsWith('data:')) {
            const data = line.startsWith('data: ') ? line.slice(6) : line.slice(5)
            const trimmedData = data.trim()

            if (trimmedData === '[DONE]') {
              continue
            }

            try {
              const chunk = JSON.parse(trimmedData)
              const delta = chunk.choices?.[0]?.delta

              // 处理推理内容
              if (delta?.reasoning) {
                fullReasoning += delta.reasoning
                setStreamingReasoning(fullReasoning)
              }

              // 处理回复内容
              if (delta?.content) {
                fullContent += delta.content
                setStreamingContent(fullContent)
              }
            } catch (e) {
              console.error('解析SSE数据失败:', trimmedData.slice(0, 100))
            }
          }
        }
      }

      // 添加完整的助手消息
      if (fullContent) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: fullContent,
            reasoning: fullReasoning || undefined,
          },
        ])
      }

      setStreamingContent('')
      setStreamingReasoning('')
      toast.success('回复完成')
    } catch (err) {
      console.error('[ZenMux Test] 错误:', err)
      toast.error('发送失败', {
        description: err instanceof Error ? err.message : '未知错误',
      })
    } finally {
      setLoading(false)
    }
  }

  // 快捷测试
  const quickTests = [
    { label: '简单问候', text: '你好，请用一句话介绍自己。' },
    { label: '中文测试', text: '请用100字左右介绍一下中国的传统节日春节。' },
    { label: '代码生成', text: '请写一个JavaScript函数，用于判断一个数字是否为质数。' },
    { label: '创意写作', text: '请写一首关于秋天的现代诗，要求简短优美。' },
  ]

  const handleQuickTest = (text: string) => {
    setInput(text)
  }

  // 清空对话
  const handleClear = () => {
    setMessages([])
    setStreamingContent('')
    setStreamingReasoning('')
    toast.success('对话已清空')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <div className="flex-1 container max-w-5xl mx-auto p-4 space-y-4">
        {/* 页面标题 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  ZenMux 对话测试
                  <Badge variant="secondary">测试环境</Badge>
                </CardTitle>
                <CardDescription className="mt-2">
                  测试ZenMux提供商的SSE流式对话功能（支持推理模型）
                  <br />
                  模型: <code className="text-sm">anthropic/claude-sonnet-4.5</code>
                </CardDescription>
              </div>
              {messages.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleClear}>
                  清空对话
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* 快捷测试按钮 */}
        {messages.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">快捷测试</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {quickTests.map((test) => (
                  <Button
                    key={test.label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickTest(test.text)}
                  >
                    {test.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 推理参数设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="w-4 h-4" />
              推理模型参数
            </CardTitle>
            <CardDescription className="text-xs">
              控制模型的推理行为和深度思考能力
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* reasoning_effort 选择 */}
              <div className="space-y-2">
                <Label htmlFor="reasoning-effort" className="text-sm">
                  推理强度 (reasoning_effort)
                </Label>
                <Select value={reasoningEffort} onValueChange={setReasoningEffort}>
                  <SelectTrigger id="reasoning-effort">
                    <SelectValue placeholder="选择推理强度" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不使用推理</SelectItem>
                    <SelectItem value="low">低 (20%)</SelectItem>
                    <SelectItem value="medium">中 (50%)</SelectItem>
                    <SelectItem value="high">高 (80%)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {reasoningEffort === 'none' && '禁用推理，标准对话模式'}
                  {reasoningEffort === 'low' && '低强度推理 (20%)，快速响应'}
                  {reasoningEffort === 'medium' && '中等强度推理 (50%)，平衡速度与深度'}
                  {reasoningEffort === 'high' && '高强度推理 (80%)，深度思考'}
                </p>
                {reasoningEffort !== 'none' && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                    ⚠️ Claude 推理模式下 temperature 自动设置为 1
                  </p>
                )}
              </div>

              {/* reasoning.max_tokens 设置 */}
              <div className="space-y-2">
                <Label htmlFor="reasoning-max-tokens" className="text-sm">
                  推理最大Tokens (可选)
                </Label>
                <Input
                  id="reasoning-max-tokens"
                  type="number"
                  placeholder="留空使用默认值"
                  value={reasoningMaxTokens}
                  onChange={(e) => setReasoningMaxTokens(e.target.value)}
                  disabled={reasoningEffort === 'none'}
                  min="0"
                />
                <p className="text-xs text-muted-foreground">
                  限制推理内容的长度，影响推理深度
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 消息列表 */}
        <Card className="flex-1">
          <CardContent className="p-6">
            <div className="space-y-4 min-h-[400px] max-h-[600px] overflow-y-auto">
              {messages.length === 0 && !streamingContent && (
                <div className="text-center text-muted-foreground py-20">
                  <p>开始与ZenMux对话</p>
                  <p className="text-sm mt-2">输入消息或使用快捷测试按钮</p>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg px-4 py-3',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {/* 推理内容 */}
                    {message.reasoning && (
                      <div className="mb-3 pb-3 border-b border-border/50">
                        <div className="flex items-center gap-1 mb-2 text-xs font-medium opacity-70">
                          <Brain className="w-3 h-3" />
                          推理过程
                        </div>
                        <div className="text-xs opacity-80 whitespace-pre-wrap italic">
                          {message.reasoning}
                        </div>
                      </div>
                    )}
                    {/* 回复内容 */}
                    <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                  </div>
                </div>
              ))}

              {/* 流式内容显示 */}
              {streamingContent && (
                <div className="flex gap-3 justify-start">
                  <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted">
                    {/* 流式推理内容 */}
                    {streamingReasoning && (
                      <div className="mb-3 pb-3 border-b border-border/50">
                        <div className="flex items-center gap-1 mb-2 text-xs font-medium opacity-70">
                          <Brain className="w-3 h-3" />
                          推理过程
                        </div>
                        <div className="text-xs opacity-80 whitespace-pre-wrap italic">
                          {streamingReasoning}
                        </div>
                      </div>
                    )}
                    {/* 流式回复内容 */}
                    <div className="text-sm whitespace-pre-wrap">{streamingContent}</div>
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      正在生成...
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </CardContent>
        </Card>

        {/* 输入区域 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="输入消息... (Enter发送, Shift+Enter换行)"
                className="min-h-[80px] resize-none"
                disabled={loading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                size="lg"
                className="shrink-0"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                {messages.length > 0 && (
                  <>
                    <span>消息数: {messages.length}</span>
                    <span>•</span>
                    <span>
                      字符数:{' '}
                      {messages.reduce((sum, msg) => sum + msg.content.length, 0)}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1">
                {loading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>连接中...</span>
                  </>
                ) : messages.length > 0 ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span>就绪</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3" />
                    <span>等待输入</span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 提示信息 */}
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong>功能说明:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>此页面仅用于测试ZenMux提供商的对话功能</li>
                <li>对话不会保存到数据库</li>
                <li>使用模型: anthropic/claude-sonnet-4.5</li>
                <li>支持完整的SSE流式输出</li>
              </ul>
              <p className="mt-3">
                <strong>推理模型参数:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  <code>reasoning_effort</code>: 控制推理强度（low/medium/high），默认 medium
                </li>
                <li>
                  <code>reasoning.effort</code>: 等价于 reasoning_effort（ZenMux 会自动补充）
                </li>
                <li>
                  <code>reasoning.max_tokens</code>: 限制推理内容的 token 长度
                </li>
                <li>
                  <code>reasoning.enabled</code>: 设为 false 可禁用推理
                </li>
                <li>推理强度占比: low (20%), medium (50%), high (80%)</li>
                <li>推理内容会在回复上方单独显示（带 🧠 图标）</li>
                <li>
                  <strong>注意</strong>: Claude 模型推理模式下 temperature 必须为 1
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
