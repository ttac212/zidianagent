"use client"

import type React from "react"
import { useState, useEffect, useDeferredValue, useCallback } from "react"
import { useSearchParams } from 'next/navigation'
import { useConversations } from "@/hooks/use-conversations"
import { useSafeLocalStorage } from "@/hooks/use-safe-local-storage"
import { useModelState } from "@/hooks/use-model-state"
import { useConversationSections } from "@/hooks/use-conversation-sections"
import { Button } from "@/components/ui/button"
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
import { ChevronRight } from "lucide-react"
import dynamic from "next/dynamic"
import { ChatCenterSkeleton } from "@/components/skeletons/chat-center-skeleton"
const SmartChatCenterV2 = dynamic(
  () => import("@/components/chat/smart-chat-center").then(m => m.SmartChatCenter),
  { ssr: false, loading: () => <ChatCenterSkeleton /> }
)
import { Header } from "@/components/header"
import { WorkspaceSkeleton } from "@/components/skeletons/workspace-skeleton"
import { ConversationSidebar } from "@/components/conversation/conversation-sidebar"
import { toggleConversationPinned, type DerivedConversation } from "@/lib/utils/conversation-list"
import type { Conversation } from '@/types/chat'
import * as dt from '@/lib/utils/date-toolkit'
import { CHAT_HISTORY_CONFIG } from '@/lib/config/chat-config'
import { STORAGE_KEYS } from "@/lib/storage"

export default function WorkspacePage() {
  const searchParams = useSearchParams()

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)

  // UI 状态
  const { selectedModel } = useModelState()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') return window.innerWidth < 768
    return false
  })

  // 编辑状态
  const [editingConvId, setEditingConvId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [prefillPayload, setPrefillPayload] = useState<{ message: string; title?: string; key?: string } | null>(null)

  // 删除确认状态
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null)

  // 当前对话 ID
  const [currentConversationId, setCurrentConversationId] = useSafeLocalStorage<string | null>(STORAGE_KEYS.CURRENT_CONVERSATION_ID, null)

  // 对话数据
  const {
    conversations,
    currentConversation,
    loading,
    error,
    createConversation,
    updateConversation,
    deleteConversation,
  } = useConversations(currentConversationId)

  // 使用 memoized selector 处理分组和过滤
  const { isSearching, filteredConversations, conversationSections } = useConversationSections(
    conversations,
    deferredSearchQuery
  )

  // URL 参数处理 - 对话链接
  useEffect(() => {
    const conversationIdFromUrl = searchParams.get('conversation')
    if (conversationIdFromUrl && conversationIdFromUrl !== currentConversationId) {
      setCurrentConversationId(conversationIdFromUrl)
      window.history.replaceState({}, '', window.location.pathname)
      toast.success('已自动选中对话', { description: '链接分享成功' })
    }
  }, [searchParams, currentConversationId, setCurrentConversationId])

  // URL 参数处理 - 预填数据
  useEffect(() => {
    const prefillKey = searchParams.get('prefill')
    if (!prefillKey) return
    try {
      const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(prefillKey) : null
      if (raw) {
        setPrefillPayload({ ...JSON.parse(raw), key: prefillKey })
        window.sessionStorage.removeItem(prefillKey)
      }
      window.history.replaceState({}, '', window.location.pathname)
    } catch (_e) { /* 忽略 */ }
  }, [searchParams])

  // 响应式窗口监听
  useEffect(() => {
    const handleResize = () => {
      setSidebarCollapsed(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 事件处理器
  const handleCreateConversation = useCallback(async () => {
    try {
      const newConversation = await createConversation(selectedModel)
      if (newConversation) {
        setCurrentConversationId(newConversation.id)
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          setSidebarCollapsed(true)
        }
      }
      return newConversation
    } catch (error) {
      console.error('创建对话失败:', error)
      toast.error('创建对话失败')
      return null
    }
  }, [createConversation, selectedModel, setCurrentConversationId])

  const handleUpdateConversation = useCallback(async (id: string, updates: Partial<Conversation>) => {
    await updateConversation(id, updates)
  }, [updateConversation])

  const handleSelectConversation = useCallback((id: string) => {
    setCurrentConversationId(id)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarCollapsed(true)
    }
  }, [setCurrentConversationId])

  const handleTogglePin = useCallback(async (conversation: DerivedConversation) => {
    try {
      const updates = toggleConversationPinned(conversation)
      await handleUpdateConversation(conversation.id, updates)
      toast.success(`已${conversation.isPinned ? '取消固定' : '固定'}对话`)
    } catch (_error) {
      toast.error('操作失败')
    }
  }, [handleUpdateConversation])

  const handleStartEdit = useCallback((convId: string, currentTitle: string) => {
    setEditingConvId(convId)
    setEditTitle(currentTitle)
  }, [])

  const handleSaveTitle = useCallback(async () => {
    if (editingConvId && editTitle.trim()) {
      try {
        await handleUpdateConversation(editingConvId, { title: editTitle.trim() })
      } catch (error) {
        console.error('更新标题失败:', error)
        toast.error('更新标题失败')
      }
    }
    setEditingConvId(null)
    setEditTitle('')
  }, [editingConvId, editTitle, handleUpdateConversation])

  const handleCancelEdit = useCallback(() => {
    setEditingConvId(null)
    setEditTitle('')
  }, [])

  const handleOpenDeleteConfirm = useCallback((conversation: Conversation) => {
    setConversationToDelete(conversation)
    setDeleteConfirmOpen(true)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!conversationToDelete) return
    try {
      const msgCount = conversationToDelete.metadata?.messageCount ?? 0
      await deleteConversation(conversationToDelete.id)
      if (currentConversationId === conversationToDelete.id) {
        setCurrentConversationId(null)
      }
      toast.success('已删除对话', {
        description: `"${conversationToDelete.title}" 已删除（${msgCount} 条消息）。`
      })
    } catch (error) {
      console.error('删除对话失败:', error)
      toast.error('删除对话失败')
    } finally {
      setDeleteConfirmOpen(false)
      setConversationToDelete(null)
    }
  }, [conversationToDelete, deleteConversation, currentConversationId, setCurrentConversationId])

  const handleCancelDelete = useCallback(() => {
    setDeleteConfirmOpen(false)
    setConversationToDelete(null)
  }, [])

  const handleExportConversation = useCallback(async (conversation: Conversation) => {
    try {
      toast.loading('正在准备导出数据...', { id: 'export-loading' })

      let beforeId: string | undefined
      let hasMore = true
      const collectedMessages: any[] = []
      let exportData: any = null
      const pageSize = CHAT_HISTORY_CONFIG.maxWindow
      let safetyCounter = 0

      while (hasMore) {
        safetyCounter += 1
        if (safetyCounter > 1000) throw new Error('导出失败：分页请求次数异常')

        const params = new URLSearchParams({ includeMessages: 'true' })
        if (pageSize) params.set('take', pageSize.toString())
        if (beforeId) params.set('beforeId', beforeId)

        const response = await fetch(`/api/conversations/${conversation.id}?${params.toString()}`)
        if (!response.ok) throw new Error(`获取对话详情失败: ${response.status}`)

        const result = await response.json()
        if (!result.success) throw new Error(result.message || '获取对话详情失败')

        const pageData = result.data
        exportData = exportData ?? pageData

        const existingIds = new Set(collectedMessages.map((msg) => msg.id))
        const pageMessages: any[] = Array.isArray(pageData.messages)
          ? pageData.messages.filter((msg: any) => !existingIds.has(msg.id))
          : []
        collectedMessages.splice(0, 0, ...pageMessages)

        hasMore = Boolean(pageData.messagesWindow?.hasMoreBefore)
        beforeId = pageData.messagesWindow?.oldestMessageId ?? undefined

        if (hasMore && !beforeId) throw new Error('导出失败：无法定位更早的消息')
      }

      const fullConversation = exportData
        ? { ...exportData, messages: collectedMessages, messageCount: exportData.messageCount ?? collectedMessages.length }
        : { id: conversation.id, title: conversation.title, model: conversation.model, createdAt: conversation.createdAt, messageCount: collectedMessages.length, messages: collectedMessages }

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

      toast.success('对话已导出', { id: 'export-loading', description: `已导出 ${fullConversation.messages?.length || 0} 条消息` })
    } catch (error: any) {
      toast.error('导出失败', { id: 'export-loading', description: error.message || '请稍后重试' })
    }
  }, [])

  const handleCopyConversationLink = useCallback(async (conversation: Conversation) => {
    try {
      const url = `${window.location.origin}${window.location.pathname}?conversation=${conversation.id}`
      await navigator.clipboard.writeText(url)
    } catch (error) {
      console.error('复制失败:', error)
      toast.error('复制失败', { description: '无法复制到剪贴板' })
    }
  }, [])

  // 加载状态
  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <Header />
        <WorkspaceSkeleton />
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-destructive text-lg font-semibold">加载对话失败</p>
            <p className="text-muted-foreground">{error || '网络错误，请检查连接'}</p>
            <Button onClick={() => window.location.reload()}>重试</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />

      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* 移动端遮罩层 */}
        {!sidebarCollapsed && (
          <div
            className="fixed inset-0 bg-black/50 z-[15] md:hidden"
            onClick={() => setSidebarCollapsed(true)}
          />
        )}

        {/* 侧边栏 */}
        <ConversationSidebar
          collapsed={sidebarCollapsed}
          onCollapse={() => setSidebarCollapsed(true)}
          loading={loading}
          sections={conversationSections}
          filteredConversations={filteredConversations}
          isSearching={isSearching}
          currentConversationId={currentConversation?.id}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateConversation={handleCreateConversation}
          editingConvId={editingConvId}
          editTitle={editTitle}
          onSelect={handleSelectConversation}
          onStartEdit={handleStartEdit}
          onSaveTitle={handleSaveTitle}
          onCancelEdit={handleCancelEdit}
          onEditTitleChange={setEditTitle}
          onTogglePin={handleTogglePin}
          onExport={handleExportConversation}
          onCopyLink={handleCopyConversationLink}
          onDelete={handleOpenDeleteConfirm}
        />

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

        {/* 主对话区域 */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 flex justify-center px-4 md:px-6 min-h-0 overflow-hidden">
            <div className="w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl flex flex-col h-full">
              <SmartChatCenterV2
                conversationId={currentConversationId || undefined}
                onUpdateConversation={handleUpdateConversation}
                onCreateConversation={handleCreateConversation}
                onSelectConversation={handleSelectConversation}
                onDeleteConversation={handleOpenDeleteConfirm}
                prefillMessage={prefillPayload?.message}
                prefillTitle={prefillPayload?.title}
                prefillId={prefillPayload?.key}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
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
