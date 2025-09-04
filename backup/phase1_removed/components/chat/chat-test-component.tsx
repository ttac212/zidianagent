"use client"

import { useState, useCallback } from "react"
import { useChat } from "@ai-sdk/react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Loader2, Square } from "lucide-react"
import { DEFAULT_MODEL } from "@/lib/ai/models"

/**
 * 简化的对话测试组件
 * 用于测试修复后的对话功能，避免复杂的状态管理
 */
export function ChatTestComponent() {
  const [input, setInput] = useState("")
  
  // 使用更简单的 useChat 配置
  const { 
    messages, 
    input: chatInput,
    setInput: setChatInput,
    handleInputChange,
    handleSubmit,
    isLoading, 
    stop, 
    error 
  } = useChat({
    api: '/api/chat',
    body: {
      model: DEFAULT_MODEL,
      temperature: 0.7,
    },
    onError: (error) => {
      console.error('Chat error:', error)
    }
  })

  const onSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput?.trim() || isLoading) return
    handleSubmit(e)
  }, [chatInput, isLoading, handleSubmit])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit(e as any)
    }
    if (e.key === 'Escape') {
      stop()
    }
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-4">
      <div className="mb-4 p-4 bg-muted rounded-lg">
        <h2 className="text-lg font-semibold mb-2">对话功能测试</h2>
        <p className="text-sm text-muted-foreground">
          这是一个简化的对话测试组件，用于验证修复后的功能。
        </p>
      </div>

      {/* 错误显示 */}
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">错误: {error.message}</p>
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>开始你的第一次对话吧！</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.id || index}`}
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
      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex gap-2">
          <Textarea
            value={chatInput || ""}
            onChange={handleInputChange}
            placeholder="输入你的消息... (Enter 发送，Shift+Enter 换行)"
            className="flex-1 min-h-[60px] max-h-[120px]"
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <div className="flex flex-col gap-1">
            <Button 
              type="submit" 
              disabled={!chatInput?.trim() || isLoading}
              className="h-[30px] w-[60px]"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={stop}
              disabled={!isLoading}
              className="h-[30px] w-[60px]"
            >
              <Square className="w-3 h-3" />
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