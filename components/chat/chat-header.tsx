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
    <div className="bg-transparent px-4 py-2 shadow-none">
      {/* 紧凑单行布局 - 优化空间利用，为对话记录节省更多空间 */}
      <div 
        className="flex items-center gap-2 cursor-pointer group transition-all duration-200 rounded-md px-2 py-1 -mx-2 hover:bg-black/5 dark:hover:bg-white/5"
        onDoubleClick={() => conversation && onEditTitle()}
        title={conversation ? "双击编辑标题" : ""}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {editingTitle ? (
            <Input
              value={tempTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={onTitleSubmit}
              onKeyDown={handleKeyDown}
              className="text-sm font-medium rounded-md bg-transparent border-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 p-0 h-5 shadow-none flex-1"
              autoFocus
              placeholder="输入对话标题..."
            />
          ) : (
            <>
              {/* 主标题 - 截断显示 */}
              <div className="font-medium text-sm truncate transition-colors duration-200 group-hover:text-primary/80 flex-1 min-w-0">
                {conversation?.title || '新对话'}
              </div>
              
              {/* 紧凑元信息标签 */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-300 flex-shrink-0">
                <span className="bg-muted/50 px-1.5 py-0.5 rounded text-xs font-mono">
                  {conversation?.messages?.length || 0}
                </span>
                {(() => {
                  const currentModel = getCurrentConversationModel()
                  return currentModel ? (
                    <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs font-medium truncate max-w-16" title={getModelDisplayName(currentModel)}>
                      {getModelDisplayName(currentModel).split(' ')[0]}
                    </span>
                  ) : null
                })()}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
})

ChatHeader.displayName = 'ChatHeader'
