/**
 * 对话侧边栏组件 V2
 * 使用 Zustand + TanStack Query 的新架构
 * 演示如何使用新的状态管理和数据获取方式
 */

'use client'

import React, { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Search,
  Loader2,
  Edit2,
  Check,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// Zustand Store
import { 
  useConversationStore,
  useConversations,
  useCurrentConversationId,
  useConversationActions,
  useConversationLoading
} from '@/stores/conversation-store'

// TanStack Query Hooks
import { useConversationsQuery } from '@/hooks/api/use-conversations-query'
import { 
  useCreateConversationMutation,
  useUpdateConversationMutation,
  useDeleteConversationMutation
} from '@/hooks/api/use-conversation-mutations'

// Types
import type { Conversation } from '@/types/chat'

export function ConversationSidebarV2() {
  // Zustand State
  const conversations = useConversations()
  const currentConversationId = useCurrentConversationId()
  const { 
    selectConversation, 
    setConversations,
    setSearchQuery,
    getFilteredConversations 
  } = useConversationActions()
  const { isCreating, isDeleting, isUpdating } = useConversationLoading()
  
  // TanStack Query
  const { data: serverConversations, isLoading: isLoadingList } = useConversationsQuery()
  const createMutation = useCreateConversationMutation()
  const updateMutation = useUpdateConversationMutation()
  const deleteMutation = useDeleteConversationMutation()
  
  // Local State
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editingTitle, setEditingTitle] = React.useState('')
  const [searchInput, setSearchInput] = React.useState('')
  
  // 同步服务器数据到 Zustand Store
  useEffect(() => {
    if (serverConversations) {
      setConversations(serverConversations)
    }
  }, [serverConversations, setConversations])
  
  // 获取过滤后的对话列表
  const filteredConversations = React.useMemo(() => {
    return getFilteredConversations()
  }, [conversations, searchInput, getFilteredConversations])
  
  // 创建新对话
  const handleCreateConversation = async () => {
    try {
      const newConversation = await createMutation.mutateAsync('claude-opus-4-1-20250805')
      selectConversation(newConversation.id)
      toast.success('新对话已创建', {
        icon: <MessageSquare className="w-4 h-4" />
      })
    } catch (error) {
      toast.error('创建对话失败', {
        description: error instanceof Error ? error.message : '未知错误'
      })
    }
  }
  
  // 删除对话
  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    // 确认删除
    if (!confirm('确定要删除这个对话吗？')) {
      return
    }
    
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('对话已删除', {
        icon: <Trash2 className="w-4 h-4" />
      })
    } catch (error) {
      toast.error('删除失败', {
        description: error instanceof Error ? error.message : '未知错误'
      })
    }
  }
  
  // 开始编辑标题
  const handleStartEdit = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(id)
    setEditingTitle(title)
  }
  
  // 保存编辑的标题
  const handleSaveTitle = async () => {
    if (!editingId || !editingTitle.trim()) return
    
    try {
      await updateMutation.mutateAsync({
        id: editingId,
        updates: { title: editingTitle.trim() }
      })
      toast.success('标题已更新')
      setEditingId(null)
      setEditingTitle('')
    } catch (error) {
      toast.error('更新失败', {
        description: error instanceof Error ? error.message : '未知错误'
      })
    }
  }
  
  // 取消编辑
  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingTitle('')
  }
  
  // 搜索处理
  const handleSearch = (value: string) => {
    setSearchInput(value)
    setSearchQuery(value)
  }
  
  return (
    <div className="flex flex-col h-full bg-background border-r">
      {/* 头部 */}
      <div className="p-4 border-b space-y-3">
        {/* 新建对话按钮 */}
        <Button
          onClick={handleCreateConversation}
          disabled={createMutation.isPending}
          className="w-full"
          size="sm"
        >
          {createMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          新建对话
        </Button>
        
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索对话..."
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>
      
      {/* 对话列表 */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoadingList ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {searchInput ? '没有找到匹配的对话' : '暂无对话'}
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => selectConversation(conversation.id)}
                className={cn(
                  "group relative flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all",
                  "hover:bg-accent",
                  currentConversationId === conversation.id && "bg-accent",
                  (deleteMutation.isPending && deleteMutation.variables === conversation.id) && "opacity-50"
                )}
              >
                <MessageSquare className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                
                {/* 标题编辑 */}
                {editingId === conversation.id ? (
                  <div className="flex-1 flex items-center gap-1">
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle()
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                      className="h-6 text-sm"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSaveTitle()
                      }}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCancelEdit()
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 truncate">
                      <p className="text-sm font-medium truncate">
                        {conversation.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {conversation.metadata?.messageCount ?? conversation.messages.length} 条消息
                      </p>
                    </div>
                    
                    {/* 操作按钮 */}
                    <div className="hidden group-hover:flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={(e) => handleStartEdit(conversation.id, conversation.title, e)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 hover:text-destructive"
                        onClick={(e) => handleDeleteConversation(conversation.id, e)}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending && deleteMutation.variables === conversation.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      
      {/* 底部状态栏 */}
      <div className="p-2 border-t text-xs text-muted-foreground text-center">
        {conversations.length} 个对话
        {(isCreating || isDeleting || isUpdating) && (
          <span className="ml-2">
            <Loader2 className="w-3 h-3 inline animate-spin" />
            处理中...
          </span>
        )}
      </div>
    </div>
  )
}

export default ConversationSidebarV2