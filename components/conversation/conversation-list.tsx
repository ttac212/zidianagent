/**
 * 对话列表组件 - 支持分组视图和搜索结果视图
 */

import { ConversationItem } from "@/components/conversation/conversation-item"
import { MessageSquare, Search } from "lucide-react"
import type { DerivedConversation, ConversationSection } from "@/lib/utils/conversation-list"
import type { Conversation } from '@/types/chat'

interface ConversationListProps {
  // 分组模式
  sections?: ConversationSection[]
  // 搜索模式
  filteredConversations?: DerivedConversation[]
  isSearching?: boolean

  // 当前选中的对话
  currentConversationId?: string | null

  // 编辑状态
  editingConvId: string | null
  editTitle: string

  // 事件处理器
  onSelect: (id: string) => void
  onStartEdit: (id: string, title: string) => void
  onSaveTitle: () => void
  onCancelEdit: () => void
  onEditTitleChange: (title: string) => void
  onTogglePin: (conv: DerivedConversation) => void
  onExport: (conv: Conversation) => void
  onCopyLink: (conv: Conversation) => void
  onDelete: (conv: Conversation) => void
}

export function ConversationList({
  sections = [],
  filteredConversations = [],
  isSearching = false,
  currentConversationId,
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
  onDelete
}: ConversationListProps) {
  // 空状态
  if (!isSearching && sections.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">暂无对话历史</p>
      </div>
    )
  }

  // 搜索结果视图
  if (isSearching) {
    if (filteredConversations.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-6">
          <Search className="h-6 w-6 mx-auto mb-2 opacity-50" />
          <p className="text-sm">未找到匹配的对话</p>
        </div>
      )
    }

    return (
      <div className="space-y-1">
        {filteredConversations.map((conv) => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            isSelected={currentConversationId === conv.id}
            editingConvId={editingConvId}
            editTitle={editTitle}
            onSelect={() => onSelect(conv.id)}
            onStartEdit={() => onStartEdit(conv.id, conv.title)}
            onSaveTitle={onSaveTitle}
            onCancelEdit={onCancelEdit}
            onEditTitleChange={onEditTitleChange}
            onTogglePin={() => onTogglePin(conv)}
            onExport={() => onExport(conv)}
            onCopyLink={() => onCopyLink(conv)}
            onDelete={() => onDelete(conv)}
          />
        ))}
      </div>
    )
  }

  // 分组视图
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.title}>
          {/* 分组标题 */}
          <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
            <span>{section.title}</span>
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] px-1.5 py-0.5 bg-muted/50 rounded">
              {section.conversations.length}
            </span>
          </div>

          {/* 分组对话列表 */}
          <div className="space-y-1">
            {section.conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={currentConversationId === conv.id}
                editingConvId={editingConvId}
                editTitle={editTitle}
                onSelect={() => onSelect(conv.id)}
                onStartEdit={() => onStartEdit(conv.id, conv.title)}
                onSaveTitle={onSaveTitle}
                onCancelEdit={onCancelEdit}
                onEditTitleChange={onEditTitleChange}
                onTogglePin={() => onTogglePin(conv)}
                onExport={() => onExport(conv)}
                onCopyLink={() => onCopyLink(conv)}
                onDelete={() => onDelete(conv)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
