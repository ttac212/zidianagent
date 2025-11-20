/**
 * 对话侧边栏组件
 */

import { AnimatePresence, motion } from 'framer-motion'
import { Button } from "@/components/ui/button"
import { ChevronLeft, Plus } from "lucide-react"
import { ConversationSearch } from "./conversation-search"
import { ConversationList } from "./conversation-list"
import type { DerivedConversation, ConversationSection } from "@/lib/utils/conversation-list"
import type { Conversation } from '@/types/chat'

interface ConversationSidebarProps {
  // 显示状态
  collapsed: boolean
  onCollapse: () => void
  loading?: boolean

  // 数据
  sections: ConversationSection[]
  filteredConversations: DerivedConversation[]
  isSearching: boolean
  currentConversationId?: string | null

  // 搜索
  searchQuery: string
  onSearchChange: (query: string) => void

  // 创建
  onCreateConversation: () => void

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

export function ConversationSidebar({
  collapsed,
  onCollapse,
  loading = false,
  sections,
  filteredConversations,
  isSearching,
  currentConversationId,
  searchQuery,
  onSearchChange,
  onCreateConversation,
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
}: ConversationSidebarProps) {
  return (
    <AnimatePresence mode="wait">
      {!collapsed && (
        <motion.div
          key="sidebar"
          initial={{ width: 0, opacity: 0, x: -20 }}
          animate={{ width: 320, opacity: 1, x: 0 }}
          exit={{ width: 0, opacity: 0, x: -20 }}
          transition={{
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1]
          }}
          className="bg-card border-r border-border flex flex-col min-h-0 z-20 md:relative fixed left-0 top-0 h-full"
        >
          {/* 侧边栏头部 */}
          <div className="flex-shrink-0 p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground">对话历史</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCollapse}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            {/* 新建对话按钮 */}
            <Button
              onClick={onCreateConversation}
              className="w-full gap-2 text-sm hover:bg-primary hover:text-primary-foreground transition-all duration-200"
              size="sm"
              disabled={loading}
            >
              <Plus className="h-4 w-4" />
              {loading ? '创建中...' : '新建对话'}
            </Button>
          </div>

          {/* 对话列表 */}
          <div className="flex-1 overflow-y-auto p-2 min-h-0 scrollbar-hide">
            <ConversationSearch
              value={searchQuery}
              onChange={onSearchChange}
            />

            <ConversationList
              sections={sections}
              filteredConversations={filteredConversations}
              isSearching={isSearching}
              currentConversationId={currentConversationId}
              editingConvId={editingConvId}
              editTitle={editTitle}
              onSelect={onSelect}
              onStartEdit={onStartEdit}
              onSaveTitle={onSaveTitle}
              onCancelEdit={onCancelEdit}
              onEditTitleChange={onEditTitleChange}
              onTogglePin={onTogglePin}
              onExport={onExport}
              onCopyLink={onCopyLink}
              onDelete={onDelete}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
