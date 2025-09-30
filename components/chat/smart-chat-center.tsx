/**
 * 聊天中心组件 - Linus 简化版
 * 直接使用 React Query，没有过度包装
 */

"use client"

import React, { useReducer, useCallback } from 'react'
import { ChatHeader } from './chat-header'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import { chatReducer } from './chat-reducer'
import { useChatActions } from '@/hooks/use-chat-actions'
import { useConversationQuery } from '@/hooks/api/use-conversations-query'
import { useModelState } from '@/hooks/use-model-state'
import { useChatScroll } from '@/hooks/use-chat-scroll'
import { useChatKeyboard } from '@/hooks/use-chat-keyboard'
import { useChatFocus } from '@/hooks/use-chat-focus'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import type { Conversation, ChatEvent, ChatSettings, ChatMessage } from '@/types/chat'
import { DEFAULT_CHAT_STATE } from '@/types/chat'
import { toast } from '@/lib/toast/toast'
import * as dt from '@/lib/utils/date-toolkit'

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
  const [state, dispatch] = useReducer(chatReducer, DEFAULT_CHAT_STATE)
  const { selectedModel: currentModel, setSelectedModel } = useModelState()
  // 添加标志跟踪对话模型是否已经同步过，防止用户选择被历史对话覆盖
  const [isModelSynced, setIsModelSynced] = React.useState(false)

  // 获取对话数据 - 只在有有效conversationId时启用
  const { data: conversation, isLoading: isConversationLoading, error: conversationError } = useConversationQuery(
    conversationId || '',
    !!conversationId // 只有当conversationId存在时才启用查询
  )

  // 同步消息状态 - 修复历史消息不显示问题
  React.useEffect(() => {
    if (conversation?.messages) {
      dispatch({ type: 'SET_MESSAGES', payload: conversation.messages })
    } else if (conversation && (!conversation.messages || conversation.messages.length === 0)) {
      // 显式处理空消息情况
      dispatch({ type: 'SET_MESSAGES', payload: [] })
    }
  }, [conversation?.messages, conversation?.id, conversationId])

  // 同步对话模型状态 - 只在对话切换或首次加载时生效，避免覆盖用户手动选择
  React.useEffect(() => {
    if (conversation?.model && conversationId && !isModelSynced) {
      dispatch({
        type: 'SET_SETTINGS',
        payload: { modelId: conversation.model }
      })
      // 同步到 useModelState
      setSelectedModel(conversation.model)
      setIsModelSynced(true)
    }
  }, [conversation?.model, conversationId, setSelectedModel, isModelSynced])

  // 重置同步标志，当对话切换时允许重新同步
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    setIsModelSynced(false)
  }, [conversationId])

  // 事件处理函数 - 简化版本，使用统一的UPDATE_MESSAGE_STREAM
  const handleChatEvent = useCallback((event: ChatEvent) => {
    switch (event.type) {
      case 'started':
        // 发送用户消息并添加占位助手消息
        dispatch({ type: 'SEND_USER_MESSAGE', payload: event.userMessage })

        // 添加pending状态的助手消息
        const pendingMessage: ChatMessage = {
          id: event.pendingAssistantId,
          role: 'assistant',
          content: '',
          timestamp: dt.timestamp(),
          status: 'pending'
        }
        dispatch({ type: 'ADD_MESSAGE', payload: pendingMessage })
        break

      case 'chunk':
        // 使用统一的UPDATE_MESSAGE_STREAM处理流式更新
        dispatch({
          type: 'UPDATE_MESSAGE_STREAM',
          payload: {
            messageId: event.pendingAssistantId,
            delta: event.delta,
            status: 'streaming'
          }
        })
        break

      case 'done':
        // 完成消息 - 使用统一的UPDATE_MESSAGE_STREAM设置最终状态
        dispatch({
          type: 'UPDATE_MESSAGE_STREAM',
          payload: {
            messageId: event.assistantMessage.id,
            content: event.assistantMessage.content,
            status: 'completed',
            metadata: event.assistantMessage.metadata
          }
        })
        // 重置全局聊天状态
        dispatch({ type: 'SET_LOADING', payload: false })
        dispatch({ type: 'SET_RESPONSE_PHASE', payload: 'idle' })
        break

      case 'error':
        // 处理错误
        if (event.fallbackMessage) {
          // 如果有备用消息，设置为已完成但带错误标记
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
          // 否则移除pending消息并显示错误
          dispatch({
            type: 'REMOVE_MESSAGE',
            payload: { messageId: event.pendingAssistantId }
          })
        }
        dispatch({ type: 'SET_ERROR', payload: event.error })
        // 重置全局聊天状态 - 确保错误后可以继续对话
        dispatch({ type: 'SET_LOADING', payload: false })
        dispatch({ type: 'SET_RESPONSE_PHASE', payload: 'idle' })
        break

      case 'warn':
        // 处理警告事件，显示toast提示但不影响UI流程
        toast.warning(event.message, {
          duration: 6000,
          description: '消息生成成功，但保存时遇到问题'
        })
        break
    }
  }, [])

  // 聊天操作 - 使用事件协议，优先使用用户选择的模型
  // 动态获取conversationId，避免新创建的对话消息丢失
  const { sendMessage, stopGeneration } = useChatActions({
    conversationId: conversation?.id,
    onEvent: handleChatEvent,
    messages: state.messages,
    model: state.settings.modelId || currentModel
  })

  // 停止生成的处理 - 确保重置全局状态
  const handleStopGeneration = useCallback(() => {
    stopGeneration()
    // 立即重置全局聊天状态，确保用户可以继续对话
    dispatch({ type: 'SET_LOADING', payload: false })
    dispatch({ type: 'SET_RESPONSE_PHASE', payload: 'idle' })
    dispatch({ type: 'SET_ERROR', payload: null })
  }, [stopGeneration])

  const handleSend = useCallback(async () => {
    if (state.isLoading) return

    const trimmedInput = state.input.trim()

    // 静默处理空输入，不显示提示
    if (!trimmedInput) {
      return
    }

    // 【关键修复】确保会话存在，否则消息会丢失
    let activeConversationId = conversation?.id
    if (!activeConversationId && onCreateConversation) {
      try {
        const newConversation = await onCreateConversation(state.settings.modelId || currentModel)
        activeConversationId = newConversation?.id
        if (!activeConversationId) {
          toast.error('创建对话失败，请重试')
          return
        }
        // 【关键修复】立即更新父组件状态，确保后续消息使用正确的conversationId
        if (onSelectConversation && activeConversationId) {
          onSelectConversation(activeConversationId)
        }
      } catch (error) {
        toast.error('创建对话失败，请重试')
        return
      }
    }

    if (!activeConversationId) {
      toast.error('无法发送消息：对话未就绪')
      return
    }

    // 清除之前的错误
    if (state.error) {
      dispatch({ type: 'SET_ERROR', payload: null })
    }

    const message = trimmedInput // 使用trim后的内容
    dispatch({ type: 'SET_INPUT', payload: '' })
    sendMessage(message, activeConversationId)
  }, [state.input, state.isLoading, state.error, sendMessage, conversation?.id, onCreateConversation, onSelectConversation, state.settings.modelId, currentModel])

  // 标题编辑相关处理
  const handleEditTitle = useCallback(() => {
    if (conversation?.title) {
      dispatch({ type: 'SET_EDITING_TITLE', payload: true })
      dispatch({ type: 'SET_TEMP_TITLE', payload: conversation.title })
    }
  }, [conversation?.title])

  const handleTitleChange = useCallback((title: string) => {
    dispatch({ type: 'SET_TEMP_TITLE', payload: title })
  }, [])

  const handleTitleSubmit = useCallback(async () => {
    if (state.tempTitle.trim() && conversation?.id && onUpdateConversation) {
      try {
        await onUpdateConversation(conversation.id, { title: state.tempTitle.trim() })
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
  }, [state.tempTitle, conversation?.id, onUpdateConversation])

  const handleCancelEdit = useCallback(() => {
    // 取消编辑，不保存更改
    dispatch({ type: 'SET_EDITING_TITLE', payload: false })
    dispatch({ type: 'SET_TEMP_TITLE', payload: '' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          // 标记为已持久化，防止后续effect覆盖用户选择
          setIsModelSynced(true)
        } catch (error) {
          console.error('Failed to update conversation model:', error)
          toast.error('模型切换失败，设置未保存')
          // 失败时重置模型选择到原来的值
          if (conversation?.model) {
            setSelectedModel(conversation.model)
            dispatch({ type: 'SET_SETTINGS', payload: { modelId: conversation.model } })
          }
        }
      }
    }
  }, [setSelectedModel, conversationId, onUpdateConversation])

  // 滚动管理
  const { scrollAreaRef, scrollToBottom: _scrollToBottom } = useChatScroll({
    messages: state.messages,
    isLoading: state.isLoading
  })

  // 焦点管理
  const { textareaRef, focusInput } = useChatFocus({
    isLoading: state.isLoading,
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
        editingTitle={state.editingTitle}
        tempTitle={state.tempTitle}
        isLoading={state.isLoading}
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
          messages={state.messages}
          isLoading={state.isLoading}
          error={state.error}
        />
      </div>

      <ChatInput
        ref={textareaRef}
        input={state.input}
        isLoading={state.isLoading}
        settings={state.settings}
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
