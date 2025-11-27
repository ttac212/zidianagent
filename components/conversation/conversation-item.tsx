/**
 * 对话项组件
 * 重构后的对话列表项，支持固定、编辑、删除等操作
 * 移除入场动画以减少列表加载时的布局抖动
 */

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Pin, PinOff } from 'lucide-react'
import { ConversationMetaBadgesMinimal } from './conversation-meta-badges'
import type { DerivedConversation } from '@/lib/utils/conversation-list'

interface ConversationItemProps {
  conversation: DerivedConversation
  isSelected: boolean
  editingConvId: string | null
  editTitle: string
  onSelect: () => void
  onStartEdit: () => void
  onSaveTitle: () => void
  onCancelEdit: () => void
  onEditTitleChange: (title: string) => void
  onTogglePin: () => void
  onExport: () => void
  onCopyLink: () => void
  onDelete: () => void
}

export function ConversationItem({
  conversation,
  isSelected,
  editingConvId,
  editTitle,
  onSelect,
  onStartEdit,
  onSaveTitle,
  onCancelEdit,
  onEditTitleChange,
  onTogglePin,
  onExport,
  onCopyLink,
  onDelete,
}: ConversationItemProps) {
  const isEditing = editingConvId === conversation.id

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSaveTitle()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancelEdit()
    }
  }

  if (isEditing) {
    return (
      <div className="w-full p-3 bg-secondary/80 rounded-md border border-primary/30 animate-in fade-in-0 duration-200">
        <Input
          value={editTitle}
          onChange={(e) => onEditTitleChange(e.target.value)}
          onBlur={onSaveTitle}
          onKeyDown={handleKeyDown}
          className="text-sm font-medium bg-transparent border-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 p-0 h-auto shadow-none"
          autoFocus
          placeholder="输入对话标题..."
          maxLength={50}
        />
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-muted-foreground">
            回车保存 • ESC取消
          </div>
          <div className="text-xs text-muted-foreground">
            {editTitle.length}/50
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full group">
      <div
        data-active={isSelected}
        className={`w-full justify-start text-left h-auto p-3 transition-colors duration-150 cursor-pointer rounded-md ${
          isSelected
            ? 'bg-secondary/80 ring-1 ring-primary/30 border-l-2 border-l-primary'
            : 'hover:bg-accent/80 active:bg-accent'
        }`}
        onClick={onSelect}
        onDoubleClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onStartEdit()
        }}
        title="单击选择 • 双击编辑标题"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* 标题和固定状态 */}
            <div className="flex items-center gap-2 mb-1">
              {conversation.isPinned && (
                <Pin className="w-3 h-3 text-primary shrink-0" />
              )}
              <div className="font-medium truncate text-sm">
                {conversation.title}
              </div>
            </div>

            {/* 消息片段 */}
            <div className="text-xs text-muted-foreground truncate mb-2 leading-relaxed">
              {conversation.lastSnippet}
            </div>

            {/* 元信息徽章 */}
            <ConversationMetaBadgesMinimal
              conversation={conversation}
              className="scale-90 origin-left"
            />
          </div>

          {/* 操作菜单 - hover时显示 */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-accent"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[9rem]"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem onSelect={onTogglePin}>
                  {conversation.isPinned ? (
                    <>
                      <PinOff className="mr-2 h-3 w-3" />
                      取消固定
                    </>
                  ) : (
                    <>
                      <Pin className="mr-2 h-3 w-3" />
                      固定对话
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onExport}>
                  导出对话
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onCopyLink}>
                  复制链接
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={onDelete}
                >
                  删除对话
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )
}