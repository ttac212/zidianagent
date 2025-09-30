/**
 * 聊天消息列表组件
 * 支持虚拟化渲染，优化长对话性能
 */

import React, { useMemo, forwardRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'

import { MessageItem } from './message-item'
import type { ChatMessagesProps } from '@/types/chat'


// 友好化错误处理函数
const getFriendlyErrorMessage = (error: string) => {
  if (error.includes('网络') || error.includes('Network') || error.includes('fetch')) {
    return {
      title: '网络开小差了',
      message: '请检查网络连接，点击下方按钮重试',
      action: '点击重试'
    }
  }
  
  if (error.includes('429') || error.includes('limit') || error.includes('quota')) {
    return {
      title: '让我休息一下',
      message: '访问量较高，请稍后再试或联系管理员',
      action: '稍后重试'
    }
  }
  
  if (error.includes('401') || error.includes('未授权') || error.includes('Unauthorized')) {
    return {
      title: '需要重新登录',
      message: '登录状态已过期，请刷新页面重新登录',
      action: '刷新页面'
    }
  }
  
  if (error.includes('模型') || error.includes('model')) {
    return {
      title: '模型暂时不可用',
      message: '当前AI模型可能在维护中，请稍后再试',
      action: '重新尝试'
    }
  }
  
  // 默认友好错误信息
  return {
    title: '出了点小问题',
    message: '别担心，我们正在努力解决中',
    action: '重试一下'
  }
}

// 错误状态组件 - 友好化
const ErrorState = React.memo<{ error: string; onRetry?: () => void }>(({ 
  error, 
  onRetry 
}) => {
  const friendlyError = getFriendlyErrorMessage(error)
  
  return (
    <div className="text-center py-8 max-w-sm mx-auto">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
        <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.1 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      
      <h3 className="text-lg font-semibold mb-2 text-foreground">{friendlyError.title}</h3>
      <p className="text-muted-foreground text-sm mb-6 leading-relaxed">{friendlyError.message}</p>
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {friendlyError.action}
        </button>
      )}
    </div>
  )
})

ErrorState.displayName = 'ErrorState'

// 消息列表组件
export const ChatMessages = forwardRef<HTMLDivElement, ChatMessagesProps>(({
  messages,
  isLoading,
  error,
  onRetryMessage
}, ref) => {
  // 优化：使用 useMemo 缓存渲染的消息列表
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const renderedMessages = useMemo(() => {
    return messages.map((message) => (
      <MessageItem
        key={message.id}
        message={message}
        onRetry={onRetryMessage ? () => onRetryMessage(message.id) : undefined}
      />
    ))
  }, [messages, onRetryMessage])

  // 如果有错误且没有消息，显示错误状态
  if (error && messages.length === 0) {
    return (
      <ScrollArea ref={ref} className="h-full w-full">
        <div className="p-4 max-w-[720px] mx-auto">
          <ErrorState error={error} />
        </div>
      </ScrollArea>
    )
  }

  // 如果正在加载且没有消息，显示加载状态
  if (isLoading && messages.length === 0) {
    return (
      <ScrollArea ref={ref} className="h-full w-full">
        <div className="p-4 max-w-[720px] mx-auto">
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              <span className="text-sm">加载消息中...</span>
            </div>
          </div>
        </div>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea ref={ref} className="h-full w-full">
      <div className="p-4 space-y-6 max-w-[720px] mx-auto min-h-full">

        {/* 如果没有消息，显示友好提示 */}
        {messages.length === 0 && !isLoading && !error && (
          <div className="text-center py-16">
            <h3 className="text-lg font-medium mb-2">开始新的对话</h3>
            <p className="text-muted-foreground text-sm">在下方输入框中输入您的问题，我会尽力为您解答</p>
          </div>
        )}

        {/* 消息列表 */}
        {renderedMessages}

        {/* 当前请求的错误提示 - 即使有历史消息也显示 */}
        {error && messages.length > 0 && (
          <div className="py-3">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center mt-0.5">
                  <span className="text-destructive text-xs">!</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-destructive mb-1">本次回复失败</h4>
                  <p className="text-xs text-muted-foreground">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 底部间距，确保最后一条消息不被输入框遮挡 */}
        <div className="h-4" />
      </div>
    </ScrollArea>
  )
})

ChatMessages.displayName = 'ChatMessages'
