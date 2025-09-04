"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Loader2, Square } from "lucide-react"
import { DEFAULT_MODEL } from "@/lib/ai/models"

/**
 * 最简化的对话测试组件
 * 直接使用 fetch API 发送请求
 */
export function SimpleChatTestComponent() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Array<{id: string, role: string, content: string}>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    }

    const currentMessages = [...messages, userMessage]
    setMessages(currentMessages)
    setInput("")
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: currentMessages.map(m => ({
            role: m.role,
            content: m.content
          })),
          model: DEFAULT_MODEL,
          temperature: 0.7,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: ''
      }

      setMessages(prev => [...prev, assistantMessage])

      // 读取流式响应
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6))
              const content = data.choices?.[0]?.delta?.content
              if (content) {
                setMessages(prev => 
                  prev.map(m => 
                    m.id === assistantMessage.id 
                      ? { ...m, content: m.content + content }
                      : m
                  )
                )
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      console.error('发送消息失败:', error)
      setError(error instanceof Error ? error.message : '发送消息失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-4">
      <div className="mb-4 p-4 bg-muted rounded-lg">
        <h2 className="text-lg font-semibold mb-2">对话功能测试</h2>
        <p className="text-sm text-muted-foreground">
          最简化版本的对话测试，直接使用 fetch API。
        </p>
      </div>

      {/* 错误显示 */}
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">错误: {error}</p>
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>开始你的第一次对话吧！</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">
                  {message.content}
                </div>
                <div className="text-xs opacity-70 mt-1">
                  {message.role} • {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
        
        {/* 加载指示器 */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg p-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">AI 正在思考中...</span>
            </div>
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的消息... (Enter 发送，Shift+Enter 换行)"
            className="flex-1 min-h-[60px] max-h-[120px]"
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <div className="flex flex-col gap-1">
            <Button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              className="h-[30px] w-[60px]"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        
        {/* 状态信息 */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>模型: {DEFAULT_MODEL}</span>
          <span>消息数: {messages.length}</span>
        </div>
      </form>
    </div>
  )
}