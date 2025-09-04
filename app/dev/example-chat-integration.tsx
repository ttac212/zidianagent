// 示例：如何在自己的页面中集成对话功能

"use client"

import { useState } from "react"
import { useConversations } from "@/hooks/use-conversations"
import { SmartChatCenterV2 } from "@/components/chat/smart-chat-center-v2"
import { DEFAULT_MODEL } from "@/lib/ai/models"

export default function YourCustomPage() {
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  
  // 使用对话管理 Hook
  const {
    conversations,
    currentConversation,
    createConversation,
    updateConversation,
    deleteConversation,
    setCurrentConversation,
  } = useConversations()

  return (
    <div className="h-screen flex flex-col">
      {/* 你的其他组件 */}
      <header className="p-4 border-b">
        <h1>我的应用</h1>
      </header>

      {/* 集成聊天组件 */}
      <div className="flex-1">
        <SmartChatCenterV2
          conversation={currentConversation || undefined}
          conversations={conversations}
          selectedModel={selectedModel}
          onUpdateConversation={updateConversation}
          onCreateConversation={() => createConversation(selectedModel)}
          onDeleteConversation={deleteConversation}
          onSelectConversation={setCurrentConversation}
          onSelectedModelChange={setSelectedModel}
        />
      </div>
    </div>
  )
}