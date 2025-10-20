/**
 * 聊天中心组件
 * 直接使用 React Query，没有过度包装
 */

"use client"

import React, { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChatHeader } from './chat-header'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import { useChatActions } from '@/hooks/use-chat-actions'
import { useConversationQuery, conversationApi, matchesConversationDetailKey } from '@/hooks/api/use-conversations-query'
import { useModelState } from '@/hooks/use-model-state'
import { useChatScroll } from '@/hooks/use-chat-scroll'
import { useChatKeyboard } from '@/hooks/use-chat-keyboard'
import { useChatFocus } from '@/hooks/use-chat-focus'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import type { Conversation, ChatEvent, ChatSettings, ChatMessage } from '@/types/chat'
import { useChatState } from '@/hooks/use-chat-state'
import {
  selectSessionError,
  selectIsSessionBusy,
  selectMessages,
  selectComposerInput,
  selectComposerSettings,
  selectComposerEditingTitle,
  selectComposerTempTitle,
  selectHistoryHasMoreBefore,
  selectSyncStatus,
  selectSyncedConversationId,
  selectActiveConversationId
} from '@/lib/chat/chat-state-selectors'
import { toast } from '@/lib/toast/toast'
import * as dt from '@/lib/utils/date-toolkit'
import { CHAT_HISTORY_CONFIG } from '@/lib/config/chat-config'

interface Props {
  conversationId?: string
  onUpdateConversation?: (id: string, updates: Partial<Conversation>) => Promise<void>
  onCreateConversation?: (model?: string) => Promise<Conversation | null>
  onSelectConversation?: (id: string) => void
  onDeleteConversation?: (conversation: Conversation) => void
}

export function SmartChatCenter({
  conversationId,
  onUpdateConversation,
  onCreateConversation,
  onSelectConversation: _onSelectConversation,
  onDeleteConversation
}: Props) {
  return (
    <ErrorBoundary fallback={
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <h3 className="text-lg font-semibold mb-2">聊天组件出现了问题</h3>
          <p className="text-muted-foreground mb-4">请尝试刷新页面或创建新对话</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            刷新页面
          </button>
        </div>
      </div>
    }>
      <SmartChatCenterInternal
        conversationId={conversationId}
        onUpdateConversation={onUpdateConversation}
        onCreateConversation={onCreateConversation}
        onSelectConversation={_onSelectConversation}
        onDeleteConversation={onDeleteConversation}
      />
    </ErrorBoundary>
  )
}

function SmartChatCenterInternal({
  conversationId,
  onUpdateConversation,
  onCreateConversation,
  onSelectConversation,
  onDeleteConversation
}: Props) {
  const queryClient = useQueryClient()
  const { state, dispatch } = useChatState()
  const streamedResultMessageIds = useRef<Set<string>>(new Set())
  const { selectedModel: currentModel, setSelectedModel } = useModelState()
  const detailParams = React.useMemo(() => ({ take: CHAT_HISTORY_CONFIG.initialWindow }), [])

  const sessionError = selectSessionError(state)
  const isSessionBusy = selectIsSessionBusy(state)
  const messages = selectMessages(state)
  const composerInput = selectComposerInput(state)
  const composerSettings = selectComposerSettings(state)
  const editingTitle = selectComposerEditingTitle(state)
  const tempTitle = selectComposerTempTitle(state)
  const hasMoreBefore = selectHistoryHasMoreBefore(state)
  const syncStatus = selectSyncStatus(state)
  const syncedConversationId = selectSyncedConversationId(state)
  const activeConversation = selectActiveConversationId(state)
  const isHistoryLoading = syncStatus === 'loading' && messages.length > 0

  // 获取对话数据 - 只在有有效conversationId时启用
  const { data: conversation, isLoading: isConversationLoading, error: conversationError } = useConversationQuery(
    conversationId || '',
    {
      enabled: !!conversationId,
      params: detailParams
    }
  )

  React.useEffect(() => {
    streamedResultMessageIds.current.clear()
  }, [conversationId])

  // 对话切换时重置本地状态，等待最新数据同步
  React.useEffect(() => {
    dispatch({
      type: 'SESSION_SET_CONVERSATION',
      payload: { conversationId: conversationId ?? null }
    })

    dispatch({
      type: 'SESSION_SYNC_STATE',
      payload: {
        conversationId: null,
        status: conversationId ? 'loading' : 'synced'
      }
    })

    if (!conversationId) {
      dispatch({ type: 'SESSION_SET_ERROR', payload: null })
    }
  }, [conversationId, dispatch])

  // 当远端对话数据就绪时同步到本地状态
  React.useEffect(() => {
    if (!conversationId || !conversation) {
      return
    }

    const alreadySynced =
      syncStatus === 'synced' && syncedConversationId === conversation.id

    if (alreadySynced) {
      return
    }

    const nextMessages = Array.isArray(conversation.messages) ? conversation.messages : []
    dispatch({ type: 'SET_MESSAGES', payload: nextMessages })

    const hasMore = conversation.messagesWindow?.hasMoreBefore ?? false
    const oldestBeforeId = conversation.messagesWindow?.oldestMessageId ?? null
    dispatch({
      type: 'SET_HISTORY_PAGINATION',
      payload: {
        hasMoreBefore: hasMore,
        cursor: oldestBeforeId ? { beforeId: oldestBeforeId } : null
      }
    })

    dispatch({
      type: 'SESSION_SYNC_STATE',
      payload: {
        conversationId: conversation.id,
        status: 'synced'
      }
    })

    if (conversation.model) {
      dispatch({
        type: 'SET_SETTINGS',
        payload: { modelId: conversation.model }
      })
      setSelectedModel(conversation.model)
    }
  }, [
    conversationId,
    conversation,
    syncStatus,
    syncedConversationId,
    dispatch,
    setSelectedModel
  ])

  // 事件处理函数 - 简化版本，使用统一的UPDATE_MESSAGE_STREAM
  const handleChatEvent = useCallback((event: ChatEvent) => {
    switch (event.type) {
      case 'started': {
        // 添加用户消息
        dispatch({ type: 'ADD_MESSAGE', payload: event.userMessage })

        // 清空输入框
        dispatch({ type: 'SET_INPUT', payload: '' })

        const pendingMessage: ChatMessage = {
          id: event.pendingAssistantId,
          role: 'assistant',
          content: '',
          timestamp: dt.timestamp(),
          status: 'pending'
        }
        dispatch({ type: 'ADD_MESSAGE', payload: pendingMessage })
        // 保持 requesting 阶段，等待首个chunk
        break
      }

      case 'chunk':
        // 【阶段4: responding】首个chunk到达，开始流式响应
        dispatch({
          type: 'SESSION_TRANSITION',
          payload: { status: 'streaming' }
        })
        dispatch({
          type: 'UPDATE_MESSAGE_STREAM',
          payload: {
            messageId: event.pendingAssistantId,
            delta: event.delta,
            status: 'streaming'
          }
        })
        break

      case 'done': {
        const linkedProgressId = event.assistantMessage.metadata?.douyinProgressMessageId
        const linkedResult = event.assistantMessage.metadata?.douyinResult

        if (linkedProgressId && linkedResult) {
          dispatch({
            type: 'UPDATE_DOUYIN_DONE',
            payload: {
              messageId: linkedProgressId,
              result: linkedResult
            }
          })
        }

        if (messages.some(message => message.id === event.assistantMessage.id)) {
          dispatch({
            type: 'UPDATE_MESSAGE_STREAM',
            payload: {
              messageId: event.assistantMessage.id,
              content: event.assistantMessage.content,
              status: 'completed',
              metadata: event.assistantMessage.metadata
            }
          })
        } else {
          dispatch({ type: 'ADD_MESSAGE', payload: event.assistantMessage })
        }

        streamedResultMessageIds.current.delete(event.assistantMessage.id)

        dispatch({
          type: 'SESSION_TRANSITION',
          payload: { status: 'done' }
        })
        dispatch({ type: 'SESSION_SET_ERROR', payload: null })
        break
      }

      case 'error': {
        if (event.fallbackMessage) {
          dispatch({
            type: 'UPDATE_MESSAGE_STREAM',
            payload: {
              messageId: event.pendingAssistantId,
              content: event.fallbackMessage.content,
              status: 'error',
              metadata: { ...event.fallbackMessage.metadata, error: event.error }
            }
          })
        } else {
          const targetMessage = messages.find(msg => msg.id === event.pendingAssistantId)
          const isDouyinProgress = Boolean(targetMessage?.metadata?.douyinProgress)

          if (!isDouyinProgress) {
            dispatch({
              type: 'REMOVE_MESSAGE',
              payload: { messageId: event.pendingAssistantId }
            })
          }
        }

        dispatch({ type: 'SESSION_SET_ERROR', payload: event.error })
        break
      }

      case 'warn':
        toast.warning(event.message, {
          duration: 6000,
          description: '消息生成成功，但保存时遇到问题'
        })
        break

      case 'douyin-progress':
        dispatch({
          type: 'UPDATE_DOUYIN_PROGRESS',
          payload: {
            messageId: event.pendingAssistantId,
            progress: event.progress
          }
        })
        break

      case 'douyin-info':
        dispatch({
          type: 'UPDATE_DOUYIN_INFO',
          payload: {
            messageId: event.pendingAssistantId,
            info: event.info
          }
        })
        break

      case 'douyin-partial':
        if (event.data.key === 'markdown') {
          const resultMessageId = `${event.pendingAssistantId}_result`

          if (!streamedResultMessageIds.current.has(resultMessageId)) {
            streamedResultMessageIds.current.add(resultMessageId)

            dispatch({
              type: 'ADD_MESSAGE',
              payload: {
                id: resultMessageId,
                role: 'assistant',
                content: '',
                timestamp: dt.timestamp(),
                status: 'streaming',
                metadata: {
                  douyinProgressMessageId: event.pendingAssistantId
                }
              }
            })
          }

          dispatch({
            type: 'UPDATE_MESSAGE_STREAM',
            payload: {
              messageId: resultMessageId,
              ...(event.data.append ? { delta: event.data.data } : { content: event.data.data }),
              status: 'streaming'
            }
          })
        }

        dispatch({
          type: 'UPDATE_DOUYIN_PARTIAL',
          payload: {
            messageId: event.pendingAssistantId,
            data: event.data
          }
        })
        break

      case 'douyin-done':
        dispatch({
          type: 'UPDATE_DOUYIN_DONE',
          payload: {
            messageId: event.pendingAssistantId,
            result: event.result
          }
        })

        streamedResultMessageIds.current.delete(`${event.pendingAssistantId}_result`)
        break

      case 'douyin-error':
        dispatch({
          type: 'UPDATE_DOUYIN_ERROR',
          payload: {
            messageId: event.pendingAssistantId,
            error: event.error,
            step: event.step
          }
        })
        streamedResultMessageIds.current.delete(`${event.pendingAssistantId}_result`)
        break
    }
  }, [dispatch, messages])

  const handleLoadOlderMessages = useCallback(async () => {
    if (!conversation?.id) return
    if (syncStatus === 'loading') return
    if (!conversation.messagesWindow?.hasMoreBefore && !hasMoreBefore) return

    const oldestMessage = messages[0]
    if (!oldestMessage) return

    const targetConversationId = conversation.id

    dispatch({
      type: 'SESSION_SYNC_STATE',
      payload: {
        conversationId: syncedConversationId ?? targetConversationId,
        status: 'loading'
      }
    })

    try {
      const older = await conversationApi.fetchConversation(targetConversationId, {
        take: CHAT_HISTORY_CONFIG.initialWindow,
        beforeId: oldestMessage.id
      })

      if (older?.messages?.length) {
        dispatch({ type: 'PREPEND_MESSAGES', payload: older.messages })
      }

      if (older?.messagesWindow) {
        const { hasMoreBefore: moreBefore = false, oldestMessageId = null } = older.messagesWindow
        dispatch({
          type: 'SET_HISTORY_PAGINATION',
          payload: {
            hasMoreBefore: moreBefore,
            cursor: oldestMessageId ? { beforeId: oldestMessageId } : null
          }
        })
      }

      queryClient.setQueriesData(
        {
          predicate: (query) => matchesConversationDetailKey(query.queryKey, targetConversationId)
        },
        (oldData: Conversation | null | undefined) => {
          if (!oldData) return oldData
          if (!older) return oldData

          const existingMessages = oldData.messages || []
          const existingIds = new Set(existingMessages.map(msg => msg.id))
          const prefix = (older.messages || []).filter(msg => !existingIds.has(msg.id))
          const mergedMessages = prefix.length > 0 ? [...prefix, ...existingMessages] : existingMessages

          const nextWindow = older.messagesWindow || oldData.messagesWindow
            ? {
                size: mergedMessages.length,
                hasMoreBefore: older.messagesWindow?.hasMoreBefore ?? oldData.messagesWindow?.hasMoreBefore ?? false,
                oldestMessageId: older.messagesWindow?.oldestMessageId ?? oldData.messagesWindow?.oldestMessageId ?? (mergedMessages[0]?.id ?? null),
                newestMessageId: oldData.messagesWindow?.newestMessageId ?? (mergedMessages[mergedMessages.length - 1]?.id ?? null),
                request: {
                  take: oldData.messagesWindow?.request?.take ?? older.messagesWindow?.request?.take ?? null,
                  beforeId: older.messagesWindow?.request?.beforeId ?? oldData.messagesWindow?.request?.beforeId ?? null
                }
              }
            : undefined

          return {
            ...oldData,
            messages: mergedMessages,
            messagesWindow: nextWindow,
            metadata: {
              ...oldData.metadata,
              messageCount: older.messageCount ?? oldData.metadata?.messageCount ?? mergedMessages.length
            }
          }
        }
      )

      if (conversation?.id === targetConversationId) {
        dispatch({
          type: 'SESSION_SYNC_STATE',
          payload: {
            conversationId: targetConversationId,
            status: 'synced'
          }
        })
      }
    } catch (_error) {
      console.error('Failed to load older messages:', _error)
      toast.error('加载历史消息失败', { description: '请稍后重试' })
      if (conversation?.id === targetConversationId) {
        dispatch({
          type: 'SESSION_SYNC_STATE',
          payload: {
            conversationId: targetConversationId,
            status: 'error'
          }
        })
      }
    }
  }, [
    conversation,
    syncStatus,
    hasMoreBefore,
    messages,
    syncedConversationId,
    dispatch,
    queryClient
  ])

  // 聊天操作 - 使用事件协议，优先使用用户选择的模型
  // 动态获取conversationId，避免新创建的对话消息丢失
  const { sendMessage, stopGeneration } = useChatActions({
    conversationId: conversation?.id,
    onEvent: handleChatEvent,
    messages,
    model: composerSettings.modelId || currentModel
  })

  // 停止生成的处理 - 确保重置全局状态
  const handleStopGeneration = useCallback(() => {
    stopGeneration()
    // 立即重置全局聊天状态，确保用户可以继续对话
    dispatch({
      type: 'SESSION_TRANSITION',
      payload: { status: 'done' }
    })
    dispatch({ type: 'SESSION_SET_ERROR', payload: null })
  }, [stopGeneration, dispatch])

  const handleSend = useCallback(async () => {
    if (isSessionBusy) return

    const trimmedInput = composerInput.trim()
    if (!trimmedInput) {
      return
    }

    dispatch({
      type: 'SESSION_TRANSITION',
      payload: { status: 'preparing' }
    })

    let targetConversationId = conversation?.id ?? activeConversation
    if (!targetConversationId && onCreateConversation) {
      try {
        const newConversation = await onCreateConversation(composerSettings.modelId || currentModel)
        targetConversationId = newConversation?.id ?? null
        if (!targetConversationId) {
          toast.error('创建对话失败，请重试')
          dispatch({
            type: 'SESSION_TRANSITION',
            payload: { status: 'idle' }
          })
          return
        }
        if (onSelectConversation) {
          onSelectConversation(targetConversationId)
        }
      } catch (_error) {
        toast.error('创建对话失败，请重试')
        dispatch({
          type: 'SESSION_TRANSITION',
          payload: { status: 'idle' }
        })
        return
      }
    }

    if (!targetConversationId) {
      toast.error('无法发送消息：对话未就绪')
      dispatch({
        type: 'SESSION_TRANSITION',
        payload: { status: 'idle' }
      })
      return
    }

    dispatch({ type: 'SESSION_SET_ERROR', payload: null })

    const message = trimmedInput
    dispatch({ type: 'SET_INPUT', payload: '' })

    dispatch({
      type: 'SESSION_TRANSITION',
      payload: { status: 'requesting' }
    })

    sendMessage(message, targetConversationId)
  }, [
    composerInput,
    isSessionBusy,
    composerSettings.modelId,
    conversation?.id,
    activeConversation,
    onCreateConversation,
    onSelectConversation,
    currentModel,
    sendMessage,
    dispatch
  ])

  // 标题编辑相关处理
  const handleEditTitle = useCallback(() => {
    if (conversation?.title) {
      dispatch({ type: 'SET_EDITING_TITLE', payload: true })
      dispatch({ type: 'SET_TEMP_TITLE', payload: conversation.title })
    }
  }, [conversation?.title, dispatch])

  const handleTitleChange = useCallback((title: string) => {
    dispatch({ type: 'SET_TEMP_TITLE', payload: title })
  }, [dispatch])

  const handleTitleSubmit = useCallback(async () => {
    if (tempTitle.trim() && conversation?.id && onUpdateConversation) {
      try {
        await onUpdateConversation(conversation.id, { title: tempTitle.trim() })
        // 成功后才关闭编辑状态
        dispatch({ type: 'SET_EDITING_TITLE', payload: false })
        dispatch({ type: 'SET_TEMP_TITLE', payload: '' })
      } catch (error) {
        console.error('Failed to update conversation title:', error)
        toast.error('标题更新失败，请重试')
        // 发生错误时不关闭编辑状态，让用户可以重试
      }
    } else {
      // 如果没有内容或条件不满足，直接关闭编辑状态
      dispatch({ type: 'SET_EDITING_TITLE', payload: false })
      dispatch({ type: 'SET_TEMP_TITLE', payload: '' })
    }
  }, [tempTitle, conversation?.id, onUpdateConversation, dispatch])

  const handleCancelEdit = useCallback(() => {
    // 取消编辑，不保存更改
    dispatch({ type: 'SET_EDITING_TITLE', payload: false })
    dispatch({ type: 'SET_TEMP_TITLE', payload: '' })
  }, [dispatch])

  // 删除对话处理 - 传递整个对话对象给父组件
  const handleDeleteConversation = useCallback(() => {
    if (conversation && onDeleteConversation) {
      onDeleteConversation(conversation)
    }
  }, [conversation, onDeleteConversation])

  // 模型切换处理 - 同步到 useModelState 并持久化到后端
  const handleSettingsChange = useCallback(async (settings: Partial<ChatSettings>) => {
    dispatch({ type: 'SET_SETTINGS', payload: settings })

    // 同步模型选择到 useModelState
    if (settings.modelId) {
      setSelectedModel(settings.modelId)

      // 如果是在现有对话中切换模型，持久化到后端
      if (conversationId && onUpdateConversation) {
        try {
          await onUpdateConversation(conversationId, {
            model: settings.modelId
          })
        } catch (error) {
          console.error('Failed to update conversation model:', error)
          toast.error('模型切换失败，设置未保存')

          // 【关键修复】失败时读取最新的React Query缓存或当前conversation
          // 避免使用闭包中的陈年快照导致回滚到旧会话模型
          const latestConversation = queryClient.getQueryData<Conversation>(
            ['conversations', 'detail', conversationId]
          )
          const fallbackModel = latestConversation?.model || conversation?.model

          if (fallbackModel) {
            setSelectedModel(fallbackModel)
            dispatch({ type: 'SET_SETTINGS', payload: { modelId: fallbackModel } })
          }
        }
      }
    }
  }, [setSelectedModel, conversationId, onUpdateConversation, conversation, queryClient, dispatch])

  // 滚动管理
  const { scrollAreaRef, scrollToBottom: _scrollToBottom } = useChatScroll({
    messages,
    isLoading: isSessionBusy
  })

  // 焦点管理
  const { textareaRef, focusInput } = useChatFocus({
    isLoading: isSessionBusy,
    autoFocus: true
  })

  // 键盘快捷键
  const { handleKeyboardShortcuts } = useChatKeyboard({
    state,
    onSendMessage: () => handleSend(),
    onStopGeneration: handleStopGeneration,
    onCreateConversation,
    onFocusInput: focusInput,
    textareaRef
  })

  // 注册全局键盘快捷键
  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts)
    return () => document.removeEventListener('keydown', handleKeyboardShortcuts)
  }, [handleKeyboardShortcuts])

  // 处理对话加载状态
  if (conversationId && isConversationLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">正在加载对话历史...</p>
        </div>
      </div>
    )
  }

  // 处理对话不存在的情况
  if (conversationId && conversationError) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="text-center p-8">
          <h3 className="text-lg font-semibold mb-2">无法加载对话</h3>
          <p className="text-muted-foreground mb-4">
            {conversationError instanceof Error ? conversationError.message : '对话可能已被删除或不存在'}
          </p>
          <button
            onClick={() => onCreateConversation?.()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            创建新对话
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        conversation={conversation || undefined}
        editingTitle={editingTitle}
        tempTitle={tempTitle}
        isLoading={isSessionBusy}
        onCreateConversation={onCreateConversation}
        onEditTitle={handleEditTitle}
        onTitleChange={handleTitleChange}
        onTitleSubmit={handleTitleSubmit}
        onCancelEdit={handleCancelEdit}
        onDeleteConversation={handleDeleteConversation}
      />

      {/* 消息区域 - 使用 flex-1 占据剩余空间，避免挤占整个高度 */}
      <div className="flex-1 min-h-0">
        <ChatMessages
          ref={scrollAreaRef}
          messages={messages}
          isLoading={isSessionBusy && messages.length === 0}
          error={sessionError}
          onLoadMore={hasMoreBefore ? handleLoadOlderMessages : undefined}
          hasMoreBefore={hasMoreBefore}
          isLoadingMore={isHistoryLoading}
        />
      </div>

      <ChatInput
        ref={textareaRef}
        input={composerInput}
        isLoading={isSessionBusy}
        settings={composerSettings}
        onInputChange={(value) => dispatch({ type: 'SET_INPUT', payload: value })}
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        onStop={handleStopGeneration}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  )
}
