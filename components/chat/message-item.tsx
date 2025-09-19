/**
 * 消息项组件
 * 显示单条消息，包含用户消息和助手消息
 */

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { User, Copy, Check, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { MessageItemProps } from '@/types/chat'
import { getModelDisplayName, getModelProvider } from '@/lib/model-utils'

export const MessageItem = React.memo<MessageItemProps>(({
  message,
  onCopy,
  onRetry
}) => {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const hasError = message.metadata?.error
  
  // 微光闪烁状态 - 新回复时触发
  const [shouldGlow, setShouldGlow] = useState(false)
  const [isNewMessage, setIsNewMessage] = useState(false)
  
  // 复制状态
  const [copied, setCopied] = useState(false)
  
  // 字数统计
  const wordCount = message.content.length
  
  useEffect(() => {
    // 如果是助手消息且有内容，触发微光效果
    if (isAssistant && message.content && message.content.length > 10) {
      setIsNewMessage(true)
      setShouldGlow(true)
      
      // 3秒后停止微光效果
      const timer = setTimeout(() => {
        setShouldGlow(false)
      }, 3000)
      
      // 5秒后取消新消息标记
      const newTimer = setTimeout(() => {
        setIsNewMessage(false)
      }, 5000)
      
      return () => {
        clearTimeout(timer)
        clearTimeout(newTimer)
      }
    }
  }, [message.content, isAssistant])

  const handleCopy = async () => {
    try {
      // 调用父组件的复制函数
      onCopy(message.content)
      
      // 尝试使用浏览器 API 复制
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(message.content)
      }
      
      // 设置复制状态
      setCopied(true)
      
      // 显示成功提示
      toast.success('已复制到剪贴板', {
        duration: 2000,
        position: 'bottom-right',
        icon: <Check className="w-4 h-4" />,
        className: 'text-sm'
      })
      
      // 2秒后重置复制状态
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (err) {
      // 复制失败提示
      toast.error('复制失败，请手动选择文本', {
        duration: 3000,
        position: 'bottom-right'
      })
      console.error('复制失败:', err)
    }
  }

  const handleRetry = () => {
    if (onRetry) {
      onRetry()
    }
  }

  return (
    <div 
      data-message-id={message.id}
      className={cn(
        "flex gap-4 transition-all duration-300",
        isUser ? "justify-end" : "justify-start",
        isNewMessage && "animate-in slide-in-from-bottom-2 fade-in-0"
      )}
    >
      {/* 消息内容 */}
      <div className={cn(
        "max-w-[90%] group",
        isUser && "flex flex-col items-end"
      )}>
        <div className={cn(
          "rounded-2xl px-6 py-4 text-sm leading-relaxed relative overflow-hidden transition-all duration-500",
          isUser
            ? "bg-primary/90 text-primary-foreground rounded-2xl"
            : hasError
              ? "bg-destructive/10 border border-destructive/20 text-destructive"
              : "bg-black/5 dark:bg-white/5 border border-white/10",
          // 微光闪烁效果
          isAssistant && shouldGlow && "shadow-md ring-2 ring-primary/20 bg-gradient-to-r from-black/5 via-primary/5 to-black/5 dark:from-white/5 dark:via-primary/10 dark:to-white/5"
        )}>
          
          {/* 微光效果 - 仅对助手消息 */}
          {isAssistant && shouldGlow && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-pulse opacity-50" />
          )}
          
          
          {/* 错误标识 */}
          {hasError && (
            <div className="text-xs text-destructive mb-2 font-medium">
               {message.metadata?.error}
            </div>
          )}

          {/* 消息文本 */}
          <div className="whitespace-pre-wrap relative z-10">
            {message.content}
          </div>

        </div>

        {/* 消息元信息 */}
        <div className="flex items-center justify-between gap-2 mt-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {/* 时间戳 */}
            <span>
              {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>

            {/* 字数统计 - 新增 */}
            {wordCount > 0 && (
              <>
                <span>•</span>
                <span className={cn(
                  "transition-colors duration-300",
                  shouldGlow && isAssistant ? "text-primary font-medium" : ""
                )}>
                  {wordCount} 字
                </span>
              </>
            )}

            {/* 模型信息 - 优化显示，所有消息都显示 */}
            {message.metadata?.model && (() => {
              const provider = getModelProvider(message.metadata.model)
              return (
                <>
                  <span>•</span>
                  <span className={cn(
                    "transition-colors duration-300 px-1.5 py-0.5 rounded text-xs bg-muted/50 border border-muted/20",
                    shouldGlow && isAssistant ? "text-primary font-medium bg-primary/10 border-primary/20" : "text-muted-foreground"
                  )} title={`使用 ${provider.name} 模型`}>
                    {getModelDisplayName(message.metadata.model)}
                  </span>
                </>
              )
            })()}

            {/* Token 信息 */}
            {message.tokens && (
              <>
                <span>•</span>
                <span>{message.tokens} tokens</span>
              </>
            )}

            {/* 处理时间 */}
            {message.metadata?.processingTime && (
              <>
                <span>•</span>
                <span>{message.metadata.processingTime}ms</span>
              </>
            )}
          </div>

          {/* 复制按钮 - 只对助手消息显示，统一风格 */}
          {isAssistant && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-5 px-2 text-xs transition-all duration-200",
                copied 
                  ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
                  : "opacity-70 hover:opacity-100 text-muted-foreground hover:text-primary hover:bg-primary/10",
                "rounded"
              )}
              onClick={handleCopy}
              title={copied ? "已复制" : "复制消息内容"}
              disabled={copied}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1 animate-in zoom-in-0 duration-200" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  复制
                </>
              )}
            </Button>
          )}
        </div>
      </div>

    </div>
  )
})

MessageItem.displayName = 'MessageItem'
