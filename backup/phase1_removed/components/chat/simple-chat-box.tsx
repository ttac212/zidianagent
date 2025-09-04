// 简化版对话组件示例

"use client"

import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Loader2 } from "lucide-react"
import { DEFAULT_MODEL } from "@/lib/ai/models"

export function SimpleChatBox() {
  const [input, setInput] = useState("")
  
  // 使用 AI SDK 的 useChat Hook
  const { messages, sendMessage, isLoading } = useChat({
    api: '/api/chat',
    body: {
      model: DEFAULT_MODEL,
      temperature: 0.7,
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    
    await sendMessage(input)
    setInput("")
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-4">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((message) => (
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
              {message.content}
            </div>
          </div>
        ))}
        
        {/* 加载指示器 */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg p-4">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息..."
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
        />
        <Button type="submit" disabled={!input.trim() || isLoading}>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>
    </div>
  )
}