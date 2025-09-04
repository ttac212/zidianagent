/**
 * 聊天头部组件
 * 包含标题编辑、新建对话、操作按钮等功能
 */

import React from 'react'
import { Input } from '@/components/ui/input'
import type { ChatHeaderProps } from '@/types/chat'
import { getModelDisplayName } from '@/lib/model-utils'

export const ChatHeader = React.memo<ChatHeaderProps>(({
  conversation,
  editingTitle,
  tempTitle,
  isLoading,
  onCreateConversation,
  onEditTitle,
  onTitleChange,
  onTitleSubmit,
  onDeleteConversation,
}) => {
  // 获取当前对话使用的模型 - 优先从最新助手消息获取
  const getCurrentConversationModel = () => {
    if (!conversation?.messages) return ''
    
    // 倒序查找最新的助手消息中的模型信息
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
      const message = conversation.messages[i]
      if (message.role === 'assistant' && message.metadata?.model) {
        return message.metadata.model
      }
    }
    
    // 如果没有助手消息，使用对话创建时的模型
    return conversation.model || ''
  }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onTitleSubmit()
    }
    if (e.key === 'Escape') {
      onEditTitle() // 取消编辑
    }
  }

  return (
    <div className="bg-transparent p-4 shadow-none">
      
      {/* 优化后的标题区域 - 双击编辑，显示消息数和模型信息 */}
      <div 
        className="flex-1 min-w-0 cursor-pointer group transition-all duration-200 rounded-lg px-2 py-1.5 -mx-2 hover:bg-black/5 dark:hover:bg-white/5"
        onDoubleClick={() => conversation && onEditTitle()}
        title={conversation ? "双击编辑标题" : ""}
      >
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <Input
              value={tempTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={onTitleSubmit}
              onKeyDown={handleKeyDown}
              className="text-sm font-medium rounded-md bg-transparent border-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 p-0 h-auto shadow-none"
              autoFocus
              placeholder="输入对话标题..."
            />
          ) : (
            <div className="font-medium text-sm truncate transition-colors duration-200 group-hover:text-primary/80">
              {conversation?.title || '新对话'}
            </div>
          )}
          <div className="text-xs text-muted-foreground transition-colors duration-300 mt-0.5">
            {conversation?.messages?.length || 0} 条消息
            {(() => {
              const currentModel = getCurrentConversationModel()
              return currentModel ? (
                <>
                  <span className="mx-1">•</span>
                  <span className="transition-colors duration-300">
                    {getModelDisplayName(currentModel)}
                  </span>
                </>
              ) : null
            })()}
          </div>
        </div>
      </div>
    </div>
  )
})

ChatHeader.displayName = 'ChatHeader'
