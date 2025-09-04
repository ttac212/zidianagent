/**
 * 修复后的智能聊天中心组件
 * 使用简化的 API 调用逻辑，避免无限循环
 */

"use client"

import React, { useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { ALLOWED_MODELS } from '@/lib/ai/models'

// 导入子组件
import { ChatHeader } from './chat-header'
import { ChatMessages } from './chat-messages'
import { ChatMessagesVirtual } from './chat-messages-virtual'
import { ChatInput } from './chat-input'

// 导入 hooks
import { useChatState } from '@/hooks/use-chat-state'
import { useChatActionsFixed as useChatActions } from '@/hooks/use-chat-actions-fixed'
import { useChatEffects } from '@/hooks/use-chat-effects'
import { useModelState } from '@/hooks/use-model-state'

// 导入类型和常量
import type { SmartChatCenterProps } from '@/types/chat'
import { DEFAULT_CHAT_SETTINGS } from '@/types/chat'

/**
 * 修复后的智能聊天中心组件
 */
export const SmartChatCenterV2Fixed = React.memo<SmartChatCenterProps>(({
  conversation,
  conversations = [],
  selectedModel,
  selectedText,
  editorContextEnabled = false,
  editorContent,
  onUpdateConversation,
  onCreateConversation,
  onDeleteConversation,
  onSelectConversation,
  onSelectedModelChange,
}) => {
  // 统一模型状态管理
  const {
    selectedModel: currentModel,
    setSelectedModel,
    getCurrentModel,
    isInitialized: modelInitialized,
    validateModel
  } = useModelState(selectedModel)

  // 初始化设置（使用统一的模型状态）
  const initialSettings = useMemo(() => {
    return {
      ...DEFAULT_CHAT_SETTINGS,
      modelId: currentModel,
      contextAware: !!editorContextEnabled,
    }
  }, [currentModel, editorContextEnabled])

  // 状态管理
  const { state, dispatch } = useChatState({
    settings: initialSettings,
    messages: [], // 不从 conversation 初始化，避免循环
  })

  // 操作管理
  const {
    sendMessage,
    stopGeneration,
    copyMessage,
    retryMessage,
    updateSettings,
    handleTemplateInject,
  } = useChatActions({
    state,
    dispatch,
    conversation,
    onUpdateConversation,
    getCurrentModel, // 传递统一的模型获取函数
    onCreateConversation, // 传递对话创建函数
    onSelectConversation, // 传递对话选择函数
  })

  // 副作用管理
  const {
    scrollToBottom,
    focusInput,
    scrollAreaRef,
    textareaRef,
  } = useChatEffects({
    state,
    dispatch,
    onSendMessage: sendMessage,
    onStopGeneration: stopGeneration,
    onCreateConversation,
  })

  // 处理对话切换 - 优化消息同步逻辑
  useEffect(() => {
    if (conversation?.id && Array.isArray(conversation.messages)) {
      // 使用批量设置消息，减少渲染次数
      dispatch({ type: 'SET_MESSAGES', payload: conversation.messages })
      // 清除加载状态
      dispatch({ type: 'SET_LOADING', payload: false })
      dispatch({ type: 'SET_ERROR', payload: null })
    } else if (!conversation?.id) {
      // 没有选择对话时清空消息
      dispatch({ type: 'CLEAR_MESSAGES' })
      dispatch({ type: 'SET_LOADING', payload: false })
      dispatch({ type: 'SET_ERROR', payload: null })
    } else if (conversation?.id && !Array.isArray(conversation.messages)) {
      // 有对话但消息尚未加载，显示加载状态
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })
    }
  }, [conversation?.id, conversation?.messages, dispatch])

  // 处理选中文本 - 只在选中文本变化时触发
  useEffect(() => {
    if (selectedText && selectedText.trim()) {
      dispatch({ 
        type: 'SET_INPUT', 
        payload: `请帮我优化这段文本：\n\n"${selectedText}"\n\n` 
      })
    }
  }, [selectedText])

  // 处理标题编辑
  const handleTitleEdit = () => {
    if (state.editingTitle && state.tempTitle.trim() && conversation) {
      onUpdateConversation(conversation.id, { title: state.tempTitle.trim() })
    }
    dispatch({ type: 'SET_EDITING_TITLE', payload: !state.editingTitle })
    if (!state.editingTitle) {
      dispatch({ type: 'SET_TEMP_TITLE', payload: conversation?.title || '' })
    }
  }

  const handleTitleChange = (title: string) => {
    dispatch({ type: 'SET_TEMP_TITLE', payload: title })
  }

  const handleTitleSubmit = () => {
    if (state.tempTitle.trim() && conversation) {
      onUpdateConversation(conversation.id, { title: state.tempTitle.trim() })
    }
    dispatch({ type: 'SET_EDITING_TITLE', payload: false })
  }

  // 处理输入
  const handleInputChange = (value: string) => {
    dispatch({ type: 'SET_INPUT', payload: value })
  }

  // 处理发送 - 立即重置输入框
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.input.trim() || state.isLoading) return

    // 保存输入内容
    const messageContent = state.input.trim()
    
    // 立即清空输入框状态
    dispatch({ type: 'SET_INPUT', payload: '' })
    
    // 等待状态更新完成后再重置高度
    setTimeout(() => {
      if (textareaRef.current && 'adjustHeight' in textareaRef.current && textareaRef.current.adjustHeight) {
        textareaRef.current.adjustHeight(true)
      }
    }, 0)
    
    // 异步发送消息
    await sendMessage(messageContent)
  }

  // 处理设置变更
  const handleSettingsChange = (newSettings: Partial<typeof state.settings>) => {
    updateSettings(newSettings)
    
    if (newSettings.modelId && validateModel(newSettings.modelId)) {
      // 使用统一的模型状态管理
      setSelectedModel(newSettings.modelId)
      onSelectedModelChange?.(newSettings.modelId)
    }
  }
  
  // 同步模型状态到聊天状态（当统一状态更新时）
  useEffect(() => {
    if (modelInitialized && currentModel !== state.settings.modelId) {
      dispatch({
        type: 'SET_SETTINGS',
        payload: { modelId: currentModel }
      })
    }
  }, [currentModel, state.settings.modelId, modelInitialized, dispatch])

  // 调试日志：检查组件渲染状态
  console.debug('SmartChatCenterV2Fixed render', {
    conversationId: conversation?.id,
    stateMessagesLength: state.messages.length,
    isLoading: state.isLoading,
    timestamp: new Date().toISOString()
  })

  // 即使没有对话也显示聊天界面，确保输入框始终可用
  // 强制确保组件总是渲染，不管对话状态如何
  return (
    <div className="flex flex-col h-full bg-background" style={{ minHeight: 0, height: '100%' }}>
      {/* 头部 - 固定高度 */}
      <div className="flex-shrink-0" style={{ flexShrink: 0 }}>
        <ChatHeader
          conversation={conversation}
          editingTitle={state.editingTitle}
          tempTitle={state.tempTitle}
          isLoading={state.isLoading}
          onEditTitle={handleTitleEdit}
          onTitleChange={handleTitleChange}
          onTitleSubmit={handleTitleSubmit}
        />
      </div>

      {/* 消息列表 - 可滚动区域，明确设置 flex-grow 和 overflow */}
      <div className="flex-1 overflow-hidden" style={{ flexGrow: 1, flexShrink: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* 根据消息数量自动选择普通或虚拟滚动组件 */}
        {state.messages.length > 100 ? (
          <ChatMessagesVirtual
            ref={scrollAreaRef}
            messages={state.messages}
            isLoading={state.isLoading}
            error={state.error}
            onCopyMessage={copyMessage}
            onRetryMessage={retryMessage}
            typingMode={state.typingMode}
            previewContent={state.previewContent}
          />
        ) : (
          <ChatMessages
            ref={scrollAreaRef}
            messages={state.messages}
            isLoading={state.isLoading}
            error={state.error}
            onCopyMessage={copyMessage}
            onRetryMessage={retryMessage}
            typingMode={state.typingMode}
            previewContent={state.previewContent}
          />
        )}
      </div>

      {/* 输入区域 - 固定高度，确保始终可见 */}
      <div className="flex-shrink-0" style={{ flexShrink: 0, minHeight: 'auto' }}>
        <ChatInput
          ref={textareaRef}
          input={state.input}
          isLoading={state.isLoading}
          settings={state.settings}
          selectedText={selectedText}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          onStop={stopGeneration}
          onSettingsChange={handleSettingsChange}
        />
      </div>
    </div>
  )
})

SmartChatCenterV2Fixed.displayName = 'SmartChatCenterV2Fixed'

export { SmartChatCenterV2Fixed as SmartChatCenterV2 }