/**
 * 虚拟滚动版本的聊天消息列表组件
 * 优化大量消息时的渲染性能
 */

import React, { useMemo, forwardRef, useEffect, useRef, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageItem } from './message-item'
import { TypingIndicator } from './typing-indicator'
import type { ChatMessagesProps } from '@/types/chat'
import { VIRTUAL_SCROLL_CONFIG } from '@/lib/config/chat-config'

// 使用统一配置，确保与主组件一致
const VIRTUAL_CONFIG = {
  itemHeight: VIRTUAL_SCROLL_CONFIG.itemHeight,
  overscan: VIRTUAL_SCROLL_CONFIG.overscan,
  threshold: VIRTUAL_SCROLL_CONFIG.threshold,
}

// 错误状态组件
const ErrorState = React.memo<{ error: string; onRetry?: () => void }>(({ 
  error, 
  onRetry 
}) => (
  <div className="text-center py-8">
    <h3 className="text-lg font-medium mb-2 text-destructive">出现错误</h3>
    <p className="text-muted-foreground mb-4">{error}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="text-primary hover:text-primary/80 text-sm font-medium"
      >
        点击重试
      </button>
    )}
  </div>
))

ErrorState.displayName = 'ErrorState'

// 虚拟滚动消息列表组件
export const ChatMessagesVirtual = forwardRef<HTMLDivElement, ChatMessagesProps>(({
  messages,
  isLoading,
  error,
  onCopyMessage,
  onRetryMessage,
  responsePhase = 'idle',
  previewContent = ''
}, ref) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [visibleRange, setVisibleRange] = React.useState({ start: 0, end: 20 })
  
  // 判断是否需要启用虚拟滚动
  const useVirtualScroll = messages.length > VIRTUAL_CONFIG.threshold
  
  // 计算可见消息范围
  const handleScroll = useCallback(() => {
    if (!useVirtualScroll || !scrollRef.current) return
    
    const scrollTop = scrollRef.current.scrollTop
    const viewportHeight = scrollRef.current.clientHeight
    
    const start = Math.max(0, Math.floor(scrollTop / VIRTUAL_CONFIG.itemHeight) - VIRTUAL_CONFIG.overscan)
    const end = Math.min(
      messages.length,
      Math.ceil((scrollTop + viewportHeight) / VIRTUAL_CONFIG.itemHeight) + VIRTUAL_CONFIG.overscan
    )
    
    setVisibleRange({ start, end })
  }, [messages.length, useVirtualScroll])
  
  // 监听滚动事件
  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return
    
    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollElement.removeEventListener('scroll', handleScroll)
  }, [handleScroll])
  
  // 滚动到底部
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      const scrollElement = scrollRef.current
      // 检查是否接近底部（使用配置的阈值）
      const isNearBottom = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight < VIRTUAL_SCROLL_CONFIG.autoScrollThreshold
      
      // 如果接近底部或是新对话，自动滚动到底部
      if (isNearBottom || messages.length <= VIRTUAL_SCROLL_CONFIG.newConversationScrollThreshold) {
        scrollElement.scrollTop = scrollElement.scrollHeight
      }
    }
  }, [messages])
  
  // 渲染消息列表
  const renderedMessages = useMemo(() => {
    if (!useVirtualScroll) {
      // 消息较少时，正常渲染所有消息
      return messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          onCopy={onCopyMessage}
          onRetry={onRetryMessage ? () => onRetryMessage(message.id) : undefined}
        />
      ))
    }
    
    // 虚拟滚动：只渲染可见范围内的消息
    const visibleMessages = messages.slice(visibleRange.start, visibleRange.end)
    const offsetY = visibleRange.start * VIRTUAL_CONFIG.itemHeight
    
    return (
      <>
        {/* 顶部占位符 */}
        <div style={{ height: offsetY }} />
        
        {/* 可见消息 */}
        {visibleMessages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            onCopy={onCopyMessage}
            onRetry={onRetryMessage ? () => onRetryMessage(message.id) : undefined}
          />
        ))}
        
        {/* 底部占位符 */}
        <div style={{ 
          height: Math.max(0, (messages.length - visibleRange.end) * VIRTUAL_CONFIG.itemHeight) 
        }} />
      </>
    )
  }, [messages, visibleRange, useVirtualScroll, onCopyMessage, onRetryMessage])

  // 如果有错误且没有消息，显示错误状态
  if (error && messages.length === 0) {
    return (
      <ScrollArea ref={ref} className="h-full w-full">
        <div ref={scrollRef} className="h-full overflow-auto">
          <div className="p-4 max-w-[720px] mx-auto">
            <ErrorState error={error} />
          </div>
        </div>
      </ScrollArea>
    )
  }

  // 如果正在加载且没有消息，显示加载状态
  if (isLoading && messages.length === 0) {
    return (
      <ScrollArea ref={ref} className="h-full w-full">
        <div ref={scrollRef} className="h-full overflow-auto">
          <div className="p-4 max-w-[720px] mx-auto">
            <div className="text-center py-8">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                <span className="text-sm">加载消息中...</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea ref={ref} className="h-full w-full">
      <div ref={scrollRef} className="h-full overflow-auto">
        <div className="p-4 space-y-6 max-w-[720px] mx-auto min-h-full">
          {/* 如果没有消息，显示友好提示 */}
          {messages.length === 0 && !isLoading && !error && (
            <div className="text-center py-16">
              <h3 className="text-lg font-medium mb-2">开始新的对话</h3>
              <p className="text-muted-foreground text-sm">在下方输入框中输入您的问题，我会尽力为您解答</p>
            </div>
          )}

          {/* 性能提示 */}
          {useVirtualScroll && messages.length > 0 && (
            <div className="text-xs text-muted-foreground text-center py-2">
              虚拟滚动已启用（{messages.length} 条消息）
            </div>
          )}
          
          {/* 消息列表 */}
          {renderedMessages}

          {/* 生成过程指示器 */}
          <TypingIndicator
            isVisible={isLoading}
            phase={responsePhase}
            previewContent={previewContent}
          />

          {/* 底部间距 */}
          <div className="h-4" />
        </div>
      </div>
    </ScrollArea>
  )
})

ChatMessagesVirtual.displayName = 'ChatMessagesVirtual'