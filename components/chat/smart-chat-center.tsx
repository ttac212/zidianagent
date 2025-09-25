/**
 * 聊天中心组件 - Linus 简化版
 * 直接使用 React Query，没有过度包装
 */

"use client"

import React, { useReducer, useCallback } from 'react'
import { ChatHeader } from './chat-header'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import { useChatActions } from '@/hooks/use-chat-actions'
import { useConversationQuery } from '@/hooks/api/use-conversations-query'
import { useModelState } from '@/hooks/use-model-state'
import { useChatEffects } from '@/hooks/use-chat-effects'
import type { Conversation, ChatState, ChatAction, ChatMessage, ChatEvent, ChatSettings } from '@/types/chat'
import { DEFAULT_CHAT_STATE } from '@/types/chat'
import { toast } from '@/lib/toast/toast'

interface Props {
  conversationId?: string
  onUpdateConversation?: (id: string, updates: Partial<Conversation>) => void
  onCreateConversation?: (model?: string) => Promise<Conversation | null>
  onSelectConversation?: (id: string) => void
  onDeleteConversation?: (id: string) => void
}

// 使用完整的 ChatState 结构

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_INPUT':
      return { ...state, input: action.payload }

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false }

    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] }

    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(m =>
          m.id === action.payload.id
            ? { ...m, ...action.payload.updates }
            : m
        )
      }

    case 'SET_MESSAGES':
      return { ...state, messages: action.payload }

    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] }

    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } }

    case 'SET_EDITING_TITLE':
      return { ...state, editingTitle: action.payload }

    case 'SET_TEMP_TITLE':
      return { ...state, tempTitle: action.payload }

    case 'SET_RESPONSE_PHASE':
      return { ...state, responsePhase: action.payload }

    case 'SET_PREVIEW_CONTENT':
      return { ...state, previewContent: action.payload }

    // 事件协议相关的新 actions
    case 'SEND_USER_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        isLoading: true,
        responsePhase: 'responding',
        error: null,
        input: ''
      }

    case 'SET_PENDING_ASSISTANT':
      const pendingMessage: ChatMessage = {
        id: action.payload.pendingAssistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      }
      return {
        ...state,
        messages: [...state.messages, pendingMessage],
        previewContent: ''
      }

    case 'APPEND_ASSISTANT_DELTA':
      const newPreviewContent = state.previewContent + action.payload.delta
      return {
        ...state,
        previewContent: newPreviewContent,
        messages: state.messages.map(m =>
          m.id === action.payload.pendingAssistantId
            ? { ...m, content: newPreviewContent }
            : m
        )
      }

    case 'FINALIZE_ASSISTANT_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(m =>
          m.id === action.payload.pendingAssistantId
            ? action.payload.finalMessage
            : m
        ),
        isLoading: false,
        responsePhase: 'idle',
        previewContent: '',
        error: null
      }

    case 'RESET_STREAM':
      const targetId = action.payload?.pendingAssistantId
      return {
        ...state,
        messages: targetId
          ? // 如果指定了 pendingAssistantId，只删除该占位消息
            state.messages.filter(m => m.id !== targetId)
          : // 否则删除所有占位助手消息（基于 metadata 判断完成状态）
            state.messages.filter(m => {
              // 保留所有用户消息
              if (m.role === 'user') return true
              // 保留已完成的助手消息（有 metadata 说明已经 finalized）
              if (m.role === 'assistant' && m.metadata) {
                return true
              }
              // 删除所有占位/未完成的助手消息（没有 metadata）
              return false
            }),
        isLoading: false,
        responsePhase: 'idle',
        previewContent: '',
        error: null
      }

    case 'RESET_STATE':
      return { ...DEFAULT_CHAT_STATE, settings: state.settings }

    default:
      return state
  }
}

export function SmartChatCenter({
  conversationId,
  onUpdateConversation,
  onCreateConversation,
  onSelectConversation,
  onDeleteConversation
}: Props) {
  const [state, dispatch] = useReducer(chatReducer, DEFAULT_CHAT_STATE)
  const { selectedModel: currentModel, getCurrentModel, setSelectedModel } = useModelState()
  // 添加标志跟踪对话模型是否已经同步过，防止用户选择被历史对话覆盖
  const [isModelSynced, setIsModelSynced] = React.useState(false)

  // 获取对话数据 - 只在有有效conversationId时启用
  const { data: conversation } = useConversationQuery(
    conversationId || '',
    !!conversationId // 只有当conversationId存在时才启用查询
  )

  // 同步消息状态
  React.useEffect(() => {
    if (conversation?.messages) {
      dispatch({ type: 'SET_MESSAGES', payload: conversation.messages })
    }
  }, [conversation?.messages])

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
  React.useEffect(() => {
    setIsModelSynced(false)
  }, [conversationId])

  // 事件处理函数
  const handleChatEvent = useCallback((event: ChatEvent) => {
    switch (event.type) {
      case 'started':
        // 发送用户消息并设置占位助手消息
        dispatch({ type: 'SEND_USER_MESSAGE', payload: event.userMessage })
        dispatch({
          type: 'SET_PENDING_ASSISTANT',
          payload: {
            id: event.requestId,
            pendingAssistantId: event.pendingAssistantId
          }
        })
        break

      case 'chunk':
        // 追加流式内容
        dispatch({
          type: 'APPEND_ASSISTANT_DELTA',
          payload: {
            pendingAssistantId: event.pendingAssistantId,
            delta: event.delta
          }
        })
        break

      case 'done':
        // 完成消息 - 使用 assistantMessage.id 作为 pendingAssistantId
        dispatch({
          type: 'FINALIZE_ASSISTANT_MESSAGE',
          payload: {
            pendingAssistantId: event.assistantMessage.id,
            finalMessage: event.assistantMessage
          }
        })
        break

      case 'error':
        // 处理错误
        if (event.fallbackMessage) {
          // 如果有备用消息，先完成消息再显示错误
          dispatch({
            type: 'FINALIZE_ASSISTANT_MESSAGE',
            payload: {
              pendingAssistantId: event.pendingAssistantId,
              finalMessage: event.fallbackMessage
            }
          })
        } else {
          // 否则重置流并显示错误，使用正确的 pendingAssistantId
          dispatch({
            type: 'RESET_STREAM',
            payload: { pendingAssistantId: event.pendingAssistantId }
          })
        }
        dispatch({ type: 'SET_ERROR', payload: event.error })
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
  const { sendMessage, stopGeneration } = useChatActions({
    conversationId: conversation?.id,
    onEvent: handleChatEvent,
    messages: state.messages,
    model: state.settings.modelId || currentModel
  })

  const handleSend = useCallback(() => {
    if (state.isLoading) return

    const trimmedInput = state.input.trim()

    // 最终检查：如果trim后为空，提示用户
    if (!trimmedInput) {
      toast.warning('消息不能为空', {
        description: '请输入有效内容后再发送'
      })
      return
    }

    // 清除之前的错误
    if (state.error) {
      dispatch({ type: 'SET_ERROR', payload: null })
    }

    const message = trimmedInput // 使用trim后的内容
    dispatch({ type: 'SET_INPUT', payload: '' })
    sendMessage(message)
  }, [state.input, state.isLoading, state.error, sendMessage])

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

  const handleTitleSubmit = useCallback(() => {
    if (state.tempTitle.trim() && conversation?.id && onUpdateConversation) {
      onUpdateConversation(conversation.id, { title: state.tempTitle.trim() })
    }
    dispatch({ type: 'SET_EDITING_TITLE', payload: false })
    dispatch({ type: 'SET_TEMP_TITLE', payload: '' })
  }, [state.tempTitle, conversation?.id, onUpdateConversation])

  const handleCancelEdit = useCallback(() => {
    // 取消编辑，不保存更改
    dispatch({ type: 'SET_EDITING_TITLE', payload: false })
    dispatch({ type: 'SET_TEMP_TITLE', payload: '' })
  }, [])

  // 删除对话处理
  const handleDeleteConversation = useCallback(() => {
    if (conversation?.id && onDeleteConversation) {
      onDeleteConversation(conversation.id)
    }
  }, [conversation?.id, onDeleteConversation])

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
          // 如果持久化失败，可以考虑显示错误提示
          console.error('Failed to update conversation model:', error)
        }
      }
    }
  }, [setSelectedModel, conversationId, onUpdateConversation])

  // 集成副作用管理（自动滚动、快捷键等）
  const { scrollToBottom, focusInput, handleKeyboardShortcuts, scrollAreaRef, textareaRef } = useChatEffects({
    state,
    dispatch,
    onSendMessage: (content: string) => {
      dispatch({ type: 'SET_INPUT', payload: content })
      sendMessage(content)
    },
    onStopGeneration: stopGeneration,
    onCreateConversation
  })

  // 注册全局键盘快捷键
  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcuts)
    return () => document.removeEventListener('keydown', handleKeyboardShortcuts)
  }, [handleKeyboardShortcuts])

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
          responsePhase={state.responsePhase}
          previewContent={state.previewContent}
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
        onStop={stopGeneration}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  )
}