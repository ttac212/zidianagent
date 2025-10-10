"use client"

import type React from "react"
import { useState, useEffect, useDeferredValue } from "react"
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { useConversations } from "@/hooks/use-conversations"
import { useSafeLocalStorage } from "@/hooks/use-safe-local-storage"
import { useModelState } from "@/hooks/use-model-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { toast } from '@/lib/toast/toast'
import { ChevronLeft, ChevronRight, MessageSquare, Plus, Search } from "lucide-react"
import dynamic from "next/dynamic"
import { ChatCenterSkeleton } from "@/components/skeletons/chat-center-skeleton"
const SmartChatCenterV2 = dynamic(
  () => import("@/components/chat/smart-chat-center").then(m => m.SmartChatCenter),
  { ssr: false, loading: () => <ChatCenterSkeleton /> }
)
import { Header } from "@/components/header"
import { WorkspaceSkeleton } from "@/components/skeletons/workspace-skeleton"

// 导入新的数据处理工具和组件
import {
  buildConversationSections,
  filterConversations,
  toggleConversationPinned,
  type DerivedConversation,
  type ConversationSection
} from "@/lib/utils/conversation-list"
import { ConversationItem } from "@/components/conversation/conversation-item"

import type { Conversation } from '@/types/chat'
import * as dt from '@/lib/utils/date-toolkit'
import { CHAT_HISTORY_CONFIG } from '@/lib/config/chat-config'

export default function WorkspacePage() {
  const searchParams = useSearchParams()

  // 搜索状态管理
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)

  // 真正的模型状态管理 - 直接订阅而非快照（修复R1）
  const { selectedModel } = useModelState()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // 移动端默认折叠侧边栏
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768
    }
    return false
  })
  
  // 编辑状态管理
  const [editingConvId, setEditingConvId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  // 删除确认对话框状态
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null)


  // 管理当前对话ID状态 - 使用统一前缀确保"清空数据"能完整清除
  const [currentConversationId, setCurrentConversationId] = useSafeLocalStorage<string | null>('zhidian_currentConversationId', null)

  // 解析 URL 参数，支持复制对话链接功能
  useEffect(() => {
    const conversationIdFromUrl = searchParams.get('conversation')
    if (conversationIdFromUrl && conversationIdFromUrl !== currentConversationId) {
      setCurrentConversationId(conversationIdFromUrl)
      // 使用 replaceState 清除 URL 参数，避免刷新时重复触发
      window.history.replaceState({}, '', window.location.pathname)
      // 显示友好提示
      toast.success('已自动选中对话', { description: '链接分享成功' })
    }
  }, [searchParams, currentConversationId, setCurrentConversationId])

  // 原有对话管理hooks - 传入当前对话ID
  const {
    conversations: fallbackConversations,
    currentConversation: fallbackCurrentConversation,
    loading: fallbackLoading,
    error: _fallbackError,
    createConversation,
    updateConversation,
    deleteConversation,
  } = useConversations(currentConversationId)

  // 使用传统对话数据
  const conversations = fallbackConversations
  const loading = fallbackLoading
  const currentConversation = fallbackCurrentConversation

  // 数据处理：构建分组结构化数据
  const conversationSections: ConversationSection[] = buildConversationSections(conversations)

  // 搜索过滤逻辑
  const isSearching = deferredSearchQuery.trim().length > 0

  const filteredConversations = isSearching
    ? filterConversations(
        conversations.map(conv => buildConversationSections([conv])[0]?.conversations[0]).filter(Boolean) as DerivedConversation[],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        // eslint-disable-next-line react-hooks/exhaustive-deps
        deferredSearchQuery
      )
    : []

  // 基础性能监控
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (!loading && conversations.length > 0) {
      // 性能监控逻辑
    }
  }, [loading, conversations.length])
  
  // 确保始终有可用对话（页面加载完成后，如果没有对话就创建一个）
  // 【已禁用】此逻辑导致删除对话后自动创建，误导用户以为删除失败
  // useEffect(() => {
  //   if (!loading && conversations.length === 0 && !currentConversationId) {
  //     createConversation(selectedModel)
  //   }
  // }, [loading, conversations.length, currentConversationId, createConversation, selectedModel])

  // 固定/取消固定对话功能
  const handleTogglePin = async (conversation: DerivedConversation) => {
    try {
      const updates = toggleConversationPinned(conversation)
      await handleUpdateConversation(conversation.id, updates)

      const action = conversation.isPinned ? '取消固定' : '固定'
      toast.success(`已${action}对话`, {
        description: `"${conversation.title}" 已${action}`
      })
    } catch (_error) {
      toast.error('操作失败', {
        description: '请稍后重试'
      })
    }
  }

  // 简化的对话管理函数
  const handleCreateConversation = async () => {
    try {
      // 直接使用响应式的模型状态
      const newConversation = await createConversation(selectedModel)
      if (newConversation) {
        // 设置为当前对话
        setCurrentConversationId(newConversation.id)
        // 移动端创建对话后自动折叠侧边栏，专注聊天
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          setSidebarCollapsed(true)
        }
      }
      return newConversation
    // eslint-disable-next-line no-unused-vars
    } catch (_error) {
      return null
    }
  }

  const handleUpdateConversation = async (id: string, updates: Partial<Conversation>) => {
    await updateConversation(id, updates)
  }

  // 打开删除确认对话框
  const handleOpenDeleteConfirm = (conversation: Conversation) => {
    setConversationToDelete(conversation)
    setDeleteConfirmOpen(true)
  }

  // 确认删除对话
  const handleConfirmDelete = async () => {
    if (!conversationToDelete) return

    try {
      const msgCount = conversationToDelete.metadata?.messageCount ?? 0
      await deleteConversation(conversationToDelete.id)
      // 如果删除的是当前对话，清空当前对话ID
      if (currentConversationId === conversationToDelete.id) {
        setCurrentConversationId(null)
      }
      toast.success('已删除对话', {
        description: `"${conversationToDelete.title}" 已删除（${msgCount} 条消息）。`
      })
    } catch (_error) {
      toast.error('删除对话失败')
    } finally {
      setDeleteConfirmOpen(false)
      setConversationToDelete(null)
    }
  }

  // 取消删除
  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false)
    setConversationToDelete(null)
  }

  const handleSelectConversation = async (id: string) => {
    try {
      // 直接设置当前对话ID
      setCurrentConversationId(id)
    // eslint-disable-next-line no-unused-vars
    } catch (_error) {
      // 使用简洁的toast提示
      toast.error('切换对话失败')
    }

    // 移动端选择对话后自动折叠侧边栏
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarCollapsed(true)
    }
  }

  // 编辑功能处理函数
  const handleStartEdit = (convId: string, currentTitle: string) => {
    setEditingConvId(convId)
    setEditTitle(currentTitle)
  }

  const handleSaveTitle = async () => {
    if (editingConvId && editTitle.trim() !== '') {
      try {
        // 调用更新对话函数
        await handleUpdateConversation(editingConvId, { title: editTitle.trim() })
      // eslint-disable-next-line no-unused-vars
      } catch (_error) {
        // 错误处理
      }
    }
    // 退出编辑状态
    setEditingConvId(null)
    setEditTitle('')
  }

  const handleCancelEdit = () => {
    setEditingConvId(null)
    setEditTitle('')
  }

  // 导出对话功能 - 修复：必须先获取完整对话详情
  const handleExportConversation = async (conversation: Conversation) => {
    try {
      // 显示加载状态
      toast.loading('正在准备导出数据...', { id: 'export-loading' })

      let beforeId: string | undefined
      let hasMore = true
      const collectedMessages: any[] = []
      let exportData: any = null
      const pageSize = CHAT_HISTORY_CONFIG.maxWindow
      let safetyCounter = 0

      while (hasMore) {
        safetyCounter += 1
        if (safetyCounter > 1000) {
          throw new Error('导出失败：分页请求次数异常')
        }

        const params = new URLSearchParams({
          includeMessages: 'true'
        })

        if (pageSize) {
          params.set('take', pageSize.toString())
        }

        if (beforeId) {
          params.set('beforeId', beforeId)
        }

        const response = await fetch(`/api/conversations/${conversation.id}?${params.toString()}`)
        if (!response.ok) {
          throw new Error(`获取对话详情失败: ${response.status}`)
        }

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.message || '获取对话详情失败')
        }

        const pageData = result.data
        exportData = exportData ?? pageData

        const existingIds = new Set(collectedMessages.map((msg) => msg.id))
        const pageMessages: any[] = Array.isArray(pageData.messages) ? pageData.messages.filter((msg: any) => !existingIds.has(msg.id)) : []
        collectedMessages.splice(0, 0, ...pageMessages)

        hasMore = Boolean(pageData.messagesWindow?.hasMoreBefore)
        beforeId = pageData.messagesWindow?.oldestMessageId ?? undefined

        if (hasMore && !beforeId) {
          throw new Error('导出失败：无法定位更早的消息')
        }
      }

      const fullConversation = exportData
        ? {
            ...exportData,
            messages: collectedMessages,
            messageCount: exportData.messageCount ?? collectedMessages.length,
          }
        : {
            id: conversation.id,
            title: conversation.title,
            model: conversation.model,
            createdAt: conversation.createdAt,
            messageCount: collectedMessages.length,
            messages: collectedMessages,
          }

      const data = JSON.stringify({
        id: fullConversation.id,
        title: fullConversation.title,
        model: fullConversation.model,
        createdAt: fullConversation.createdAt,
        messageCount: fullConversation.messageCount || fullConversation.messages?.length || 0,
        messages: fullConversation.messages || []
      }, null, 2)

      const blob = new Blob([data], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${conversation.title || 'conversation'}-${dt.toISO().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      // 成功提示
      toast.success('对话已导出', {
        id: 'export-loading',
        description: `已导出 ${fullConversation.messages?.length || 0} 条消息`
      })
    } catch (error: any) {
      // 错误提示
      toast.error('导出失败', {
        id: 'export-loading',
        description: error.message || '请稍后重试'
      })
    }
  }

  // 复制对话链接功能
  const handleCopyConversationLink = async (conversation: Conversation) => {
    try {
      const url = `${window.location.origin}${window.location.pathname}?conversation=${conversation.id}`
      await navigator.clipboard.writeText(url)
      // 不显示复制成功toast，只在失败时提示
      // 浏览器已经有原生的复制反馈
    // eslint-disable-next-line no-unused-vars
    } catch (_e) {
      toast.error('复制失败', { description: '无法复制到剪贴板' })
    }
  }


  // 响应式监听器 - 处理窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      // 在桌面端展开侧边栏，移动端折叠
      if (window.innerWidth >= 768) {
        setSidebarCollapsed(false)
      } else {
        setSidebarCollapsed(true)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])


  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <Header />
        <WorkspaceSkeleton />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />

      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* 移动端遮罩层 - 调整层级避免干扰组件交互 */}
        {!sidebarCollapsed && (
          <div
            className="fixed inset-0 bg-black/50 z-[15] md:hidden"
            onClick={() => setSidebarCollapsed(true)}
          />
        )}

        {/* 左侧对话历史侧边栏 */}
        <AnimatePresence mode="wait">
          {!sidebarCollapsed && (
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
          {/* 侧边栏头部 - 固定高度 */}
          <div className="flex-shrink-0 p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground">对话历史</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(true)}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            {/* 新建对话按钮 */}
            <Button
              onClick={handleCreateConversation}
              className="w-full gap-2 text-sm hover:bg-primary hover:text-primary-foreground transition-all duration-200"
              size="sm"
              disabled={loading}
            >
              <Plus className="h-4 w-4" />
              {loading ? '创建中...' : '新建对话'}
            </Button>
          </div>

          {/* 对话列表 - 可滚动区域 */}
          <div className="flex-1 overflow-y-auto p-2 min-h-0 scrollbar-hide">
            {/* 搜索框 */}
            <div className="sticky top-0 bg-card z-10 pb-2 mb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索对话..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-background"
                />
              </div>
            </div>

            {conversations.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无对话历史</p>
              </div>
            ) : isSearching ? (
              // 搜索结果视图
              <div className="space-y-1">
                {filteredConversations.length === 0 ? (
                  <div className="text-center text-muted-foreground py-6">
                    <Search className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">未找到匹配的对话</p>
                  </div>
                ) : (
                  filteredConversations.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isSelected={currentConversation?.id === conv.id}
                      editingConvId={editingConvId}
                      editTitle={editTitle}
                      onSelect={() => handleSelectConversation(conv.id)}
                      onStartEdit={() => handleStartEdit(conv.id, conv.title)}
                      onSaveTitle={handleSaveTitle}
                      onCancelEdit={handleCancelEdit}
                      onEditTitleChange={setEditTitle}
                      onTogglePin={() => handleTogglePin(conv)}
                      onExport={() => handleExportConversation(conv)}
                      onCopyLink={() => handleCopyConversationLink(conv)}
                      onDelete={() => handleOpenDeleteConfirm(conv)}
                    />
                  ))
                )}
              </div>
            ) : (
              // 分组视图
              <div className="space-y-4">
                {conversationSections.map((section) => (
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
                          isSelected={currentConversation?.id === conv.id}
                          editingConvId={editingConvId}
                          editTitle={editTitle}
                          onSelect={() => handleSelectConversation(conv.id)}
                          onStartEdit={() => handleStartEdit(conv.id, conv.title)}
                          onSaveTitle={handleSaveTitle}
                          onCancelEdit={handleCancelEdit}
                          onEditTitleChange={setEditTitle}
                          onTogglePin={() => handleTogglePin(conv)}
                          onExport={() => handleExportConversation(conv)}
                          onCopyLink={() => handleCopyConversationLink(conv)}
                          onDelete={() => handleOpenDeleteConfirm(conv)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
          )}
        </AnimatePresence>

        {/* 侧边栏折叠按钮 */}
        {sidebarCollapsed && (
          <div className="w-12 bg-card border-r border-border flex items-center justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(false)}
              className="h-full w-full p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* 主对话区域 - 具有明确高度约束和最大宽度 */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 flex justify-center px-4 md:px-6 min-h-0 overflow-hidden">
            <div className="w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl flex flex-col h-full">
              <SmartChatCenterV2
                conversationId={currentConversationId || undefined}
                onUpdateConversation={handleUpdateConversation}
                onCreateConversation={handleCreateConversation}
                onSelectConversation={handleSelectConversation}
                onDeleteConversation={handleOpenDeleteConfirm}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 顶层删除确认对话框 */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除对话</AlertDialogTitle>
            <AlertDialogDescription>
              {conversationToDelete && (
                <>
                  将删除&ldquo;{conversationToDelete.title}&rdquo;
                  {conversationToDelete.metadata?.messageCount ? `（${conversationToDelete.metadata.messageCount} 条消息）` : ''}。
                  此操作不可撤销。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
