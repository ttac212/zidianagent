"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useConversations } from "@/hooks/use-conversations"
import { useSafeLocalStorage } from "@/hooks/use-safe-local-storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { toast } from "@/hooks/use-toast"
import { toast as unifiedToast } from '@/lib/toast/unified-toast'
import { useInlineFeedback } from '@/components/ui/inline-feedback'
import { ChevronLeft, ChevronRight, MessageSquare, Plus, MoreHorizontal } from "lucide-react"
import dynamic from "next/dynamic"
import { ChatCenterSkeleton } from "@/components/skeletons/chat-center-skeleton"
const SmartChatCenterV2 = dynamic(
  () => import("@/components/chat/smart-chat-center-v2-fixed").then(m => m.SmartChatCenterV2),
  { ssr: false, loading: () => <ChatCenterSkeleton /> }
)
import { Header } from "@/components/header"
import { ALLOWED_MODELS, DEFAULT_MODEL, ALLOWED_MODEL_IDS, isAllowed } from "@/lib/ai/models"
import { WorkspaceSkeleton } from "@/components/skeletons/workspace-skeleton"
import { ConnectionStatus } from "@/components/ui/connection-status"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
  tokens?: number
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  model: string
  createdAt: number
  updatedAt: number
}

export default function WorkspacePage() {
  // 使用安全的localStorage hook，并验证模型
  const defaultModelId = ALLOWED_MODELS.length > 0 ? ALLOWED_MODELS[0].id : DEFAULT_MODEL
  const [storedModel, setStoredModel] = useSafeLocalStorage('lastSelectedModelId', defaultModelId)
  
  // 验证存储的模型是否有效
  const [selectedModel, setSelectedModel] = useState(() => {
    // 如果存储的模型在允许列表中，使用它；否则使用默认模型
    return isAllowed(storedModel) ? storedModel : defaultModelId
  })
  
  // 同步到localStorage（仅在有效时）
  useEffect(() => {
    if (isAllowed(selectedModel)) {
      setStoredModel(selectedModel)
    }
  }, [selectedModel, setStoredModel])
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


  // 原有对话管理hooks - 保持操作功能
  const {
    conversations: fallbackConversations,
    currentConversationId,
    loading: fallbackLoading,
    error: fallbackError,
    loadingConversationId, // 获取加载中的对话ID
    createConversation,
    updateConversation,
    updateConversationWithMessages, // 使用新的更新函数
    deleteConversation,
    setCurrentConversation,
    getCurrentConversation,
    updateConversationMessages,
  } = useConversations()

  // 使用传统对话数据
  const conversations = fallbackConversations
  const loading = fallbackLoading
  const error = fallbackError
  
  // 获取当前对话
  const currentConversation = getCurrentConversation()

  // 基础性能监控
  useEffect(() => {
    if (!loading && conversations.length > 0) {
      // 性能监控逻辑
    }
  }, [loading, conversations.length])
  
  // 确保始终有可用对话（页面加载完成后，如果没有对话就创建一个）
  useEffect(() => {
    if (!loading && conversations.length === 0 && !currentConversationId) {
      // 确保使用验证过的模型
      const modelToUse = isAllowed(selectedModel) ? selectedModel : defaultModelId
      createConversation(modelToUse)
    }
  }, [loading, conversations.length, currentConversationId, createConversation, selectedModel, defaultModelId])

  // 简化的对话管理函数
  const handleCreateConversation = async () => {
    try {
      // 确保使用验证过的模型
      const modelToUse = isAllowed(selectedModel) ? selectedModel : defaultModelId
      const newConversation = await createConversation(modelToUse)
      if (newConversation) {
        // 移动端创建对话后自动折叠侧边栏，专注聊天
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          setSidebarCollapsed(true)
        }
        }
      return newConversation
    } catch (error) {
      return null
    }
  }

  const handleUpdateConversation = (id: string, updates: Partial<Conversation>) => {
    updateConversationWithMessages(id, updates) // 使用支持消息更新的函数
  }

  const handleDeleteConversation = (id: string) => {
    deleteConversation(id)
  }

  const handleSelectConversation = (id: string) => {
    setCurrentConversation(id)
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
      } catch (error) {
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

  // 导出对话功能
  const handleExportConversation = (conversation: Conversation) => {
    try {
      const data = JSON.stringify({ 
        id: conversation.id, 
        title: conversation.title, 
        messages: conversation.messages 
      }, null, 2)
      const blob = new Blob([data], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${conversation.title || 'conversation'}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      // 使用轻量级toast提示
      unifiedToast.success('导出成功')
    } catch (e) {
      unifiedToast.error('导出失败', { description: '请稍后重试' })
    }
  }

  // 复制对话链接功能
  const handleCopyConversationLink = async (conversation: Conversation) => {
    try {
      const url = `${window.location.origin}${window.location.pathname}?conversation=${conversation.id}`
      await navigator.clipboard.writeText(url)
      // 不显示复制成功toast，只在失败时提示
      // 浏览器已经有原生的复制反馈
    } catch (e) {
      unifiedToast.error('复制失败', { description: '无法复制到剪贴板' })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveTitle()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelEdit()
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
      
      {/* 连接状态指示器 - 工作区专用，调整位置避免与时间轴冲突 */}
      <ConnectionStatus
        position="fixed"
        size="sm"
        className="top-20 left-4 z-[45] md:left-auto md:right-4"
        animated={true}
        showDetails={false}
        autoHideWhenHealthy={false}
      />

      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* 移动端遮罩层 - 调整层级避免干扰组件交互 */}
        {!sidebarCollapsed && (
          <div
            className="fixed inset-0 bg-black/50 z-[15] md:hidden"
            onClick={() => setSidebarCollapsed(true)}
          />
        )}

        {/* 左侧对话历史侧边栏 */}
        <div className={`bg-card border-r border-border flex flex-col min-h-0 z-20 transition-all duration-200 ${
          sidebarCollapsed
            ? 'w-0 overflow-hidden opacity-0'
            : 'w-80 md:relative fixed left-0 top-0 h-full opacity-100'
        }`}
        style={{
          transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease-in-out'
        }}>
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
            {conversations.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无对话历史</p>
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <div key={conv.id} className="relative">
                    {editingConvId === conv.id ? (
                      // 编辑模式 - 增强的用户体验
                      <div className="w-full p-3 bg-secondary rounded-md border border-primary/20 animate-in fade-in-0 duration-200">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={handleSaveTitle}
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
                    ) : (
                      // 正常模式 - 重新设计避免按钮嵌套
                      <div className="relative w-full group">
                        <div
                          className={`w-full justify-start text-left h-auto p-3 transition-all duration-200 cursor-pointer rounded-md ${
                            currentConversation?.id === conv.id 
                              ? 'bg-secondary ring-1 ring-primary/20 shadow-sm' 
                              : 'hover:bg-accent hover:shadow-sm'
                          }`}
                          onClick={() => handleSelectConversation(conv.id)}
                          onDoubleClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleStartEdit(conv.id, conv.title)
                          }}
                          title="单击选择 • 双击编辑标题"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{conv.title}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                {loadingConversationId === conv.id ? (
                                  <>
                                    <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin"></div>
                                    加载中...
                                  </>
                                ) : (
                                  <span>{conv.messages.length} 条消息</span>
                                )}
                              </div>
                            </div>
                            
                            {/* 操作菜单 - hover时显示 */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1">
                              {/* 三点菜单 */}
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
                                  className="min-w-[10rem]"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <DropdownMenuItem 
                                    onSelect={(e) => {
                                      e.stopPropagation()
                                      handleExportConversation(conv)
                                    }}
                                  >
                                    导出对话
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onSelect={(e) => {
                                      e.stopPropagation()
                                      handleCopyConversationLink(conv)
                                    }}
                                  >
                                    复制链接
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onSelect={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                        }}
                                      >
                                        删除对话
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>删除对话</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          将删除&ldquo;{conv.title}&rdquo;
                                          {conv.messages?.length ? `（${conv.messages.length} 条消息）` : ''}。
                                          此操作不可撤销。
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>取消</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            const msgCount = conv.messages?.length ?? 0
                                            handleDeleteConversation(conv.id)
                                            toast({
                                              title: '已删除对话',
                                              description: `"${conv.title}" 已删除（${msgCount} 条消息）。`,
                                            })
                                          }}
                                        >
                                          确认删除
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

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
                data-testid="chat-center"
                conversation={currentConversation || undefined}
                conversations={conversations}
                selectedModel={selectedModel}
                selectedText=""
                editorContextEnabled={false}
                editorContent=""
                onUpdateConversation={handleUpdateConversation}
                onCreateConversation={handleCreateConversation}
                onDeleteConversation={handleDeleteConversation}
                onSelectConversation={handleSelectConversation}
                onSelectedModelChange={setSelectedModel}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
