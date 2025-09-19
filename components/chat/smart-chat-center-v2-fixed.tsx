/**
 * 修复后的智能聊天中心组件
 * 使用简化的 API 调用逻辑，避免无限循环
 */

"use client"

import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Clock, X } from 'lucide-react'
import { ALLOWED_MODELS } from '@/lib/ai/models'
import { VIRTUAL_SCROLL_CONFIG } from '@/lib/config/chat-config'

// 导入子组件
import { ChatHeader } from './chat-header'
import { ChatMessages } from './chat-messages'
import { ChatMessagesVirtual } from './chat-messages-virtual'
import { ChatInput } from './chat-input'
import { TimelineScrollbar } from './timeline-scrollbar'

// 导入 hooks
import { useChatState } from '@/hooks/use-chat-state'
import { useChatActionsFixed as useChatActions } from '@/hooks/use-chat-actions-fixed'
import { useChatEffects } from '@/hooks/use-chat-effects'
import { useModelState } from '@/hooks/use-model-state'

// 导入类型和常量
import type { SmartChatCenterProps, Conversation } from '@/types/chat'
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

  // 定时器引用，用于防止内存泄漏
  const adjustHeightTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // 时间轴相关状态
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null)
  const [showTimeline, setShowTimeline] = useState<boolean>(true)

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

  // 包装onCreateConversation为Promise形式
  const createConversationWrapper = useCallback(async (model?: string): Promise<Conversation | null> => {
    onCreateConversation()
    return null // 因为原始函数返回void，我们返回null
  }, [onCreateConversation])

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
    onCreateConversation: createConversationWrapper, // 传递包装后的对话创建函数
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
    if (adjustHeightTimerRef.current) {
      clearTimeout(adjustHeightTimerRef.current)
    }
    
    adjustHeightTimerRef.current = setTimeout(() => {
      if (textareaRef.current && 'adjustHeight' in textareaRef.current && typeof textareaRef.current.adjustHeight === 'function') {
        textareaRef.current.adjustHeight(true)
      }
      adjustHeightTimerRef.current = null
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

  // 跳转到指定消息
  const jumpToMessage = useCallback((messageId: string) => {
    const element = scrollAreaRef.current?.querySelector(`[data-message-id="${messageId}"]`)
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
      setCurrentMessageId(messageId)
      
      // 3秒后清除高亮
      setTimeout(() => {
        setCurrentMessageId(null)
      }, 3000)
    }
  }, [])

  // 使用 Intersection Observer 追踪当前可见消息
  useEffect(() => {
    if (!scrollAreaRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const messageId = entry.target.getAttribute('data-message-id')
            if (messageId) {
              setCurrentMessageId(messageId)
            }
          }
        })
      },
      {
        root: scrollAreaRef.current,
        rootMargin: '-30% 0px -30% 0px',
        threshold: [0.3, 0.5, 0.7]
      }
    )

    const messageElements = scrollAreaRef.current.querySelectorAll('[data-message-id]')
    messageElements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [state.messages])

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (adjustHeightTimerRef.current) {
        clearTimeout(adjustHeightTimerRef.current)
      }
    }
  }, [])

  // 即使没有对话也显示聊天界面，确保输入框始终可用
  // 强制确保组件总是渲染，不管对话状态如何
  return (
    <div className="flex flex-col h-full bg-background" style={{ minHeight: 0, height: '100%' }}>
      {/* 头部 - 紧凑固定高度，只占用左侧1/3空间为对话记录让路 */}
      <div className="flex-shrink-0 flex" style={{ flexShrink: 0 }}>
        <div className="w-1/3 min-w-0">
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
        {/* 右侧2/3空间预留给未来扩展或保持空白以突出紧凑设计 */}
        <div className="flex-1"></div>
      </div>

      {/* 消息列表 + 时间轴 - 可滚动区域，明确设置 flex-grow 和 overflow */}
      <div className="flex-1 overflow-hidden" style={{ flexGrow: 1, flexShrink: 1, minHeight: 0, overflow: 'hidden' }}>
        <div className="flex h-full relative">
          {/* 消息列表 */}
          <div className="flex-1 overflow-hidden">
            {/* 根据消息数量自动选择普通或虚拟滚动组件 */}
            {state.messages.length > VIRTUAL_SCROLL_CONFIG.threshold ? (
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
          
          {/* 时间轴滚动条 - 智能显示策略 */}
          {showTimeline && state.messages.length > 5 && (
            <div className="flex-shrink-0 bg-background border-l border-border/20">
              {/* 显示策略提示 - 所有情况都显示当前策略 */}
              {state.messages.length > 5 && (
                <div className="px-2 py-1 text-xs text-muted-foreground text-center border-b border-border/10 bg-background/50">
                  {state.messages.length <= 17 ? '对话轮次' :
                   state.messages.length <= 50 ? '关键节点' : 
                   state.messages.length <= 100 ? '时间分段' : '章节概览'}
                </div>
              )}
              
              <TimelineScrollbar
                messages={state.messages}
                currentMessageId={currentMessageId}
                onJumpToMessage={jumpToMessage}
                containerHeight={600}
                className="py-2 px-2"
              />
            </div>
          )}
          
          {/* 隐形时间轴触发器 - 右边缘悬浮区域，完全不遮挡对话内容 */}
          {!showTimeline && state.messages.length > 5 && (
            <div 
              className="absolute top-6 right-0 w-6 h-12 bg-transparent hover:bg-muted/10 transition-all duration-300 flex items-center justify-end group cursor-pointer z-[35] rounded-l-md"
              onClick={() => setShowTimeline(true)}
              title="点击显示时间轴导航"
            >
              {/* 隐形按钮 - 只在悬停时显示 */}
              <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 bg-background/95 backdrop-blur-sm border shadow-lg rounded-full w-5 h-5 flex items-center justify-center group-hover:scale-110 transform group-hover:-translate-x-1">
                <Clock className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
              </div>
            </div>
          )}
        </div>
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