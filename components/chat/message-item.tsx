/**
 * 消息项组件
 * 显示单条消息，包含用户消息和助手消息
 */

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast/toast'
import type { MessageItemProps } from '@/types/chat'
import { getModelDisplayName, getModelProvider } from '@/lib/model-utils'
import { SecureMarkdown } from '@/components/ui/secure-markdown'

export const MessageItem = React.memo<MessageItemProps>(({
  message,
  onRetry
}) => {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const hasError = message.metadata?.error
  const isStreaming = message.status === 'streaming'
  const isPending = message.status === 'pending'
  const isCompleted = message.status === 'completed'

  // 微光闪烁状态 - 新回复时触发
  const [shouldGlow, setShouldGlow] = useState(false)
  const [isNewMessage, setIsNewMessage] = useState(false)

  // 复制状态
  const [copied, setCopied] = useState(false)

  // 字数统计
  const wordCount = message.content.length

  useEffect(() => {
    // 如果是助手消息且状态变为完成，触发微光效果
    if (isAssistant && isCompleted && message.content && message.content.length > 10) {
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
  }, [message.status, message.content, isAssistant, isCompleted])

  const handleCopy = async () => {
    try {
      // 直接使用浏览器 API 复制，移除重复操作
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
    } catch (_err) {
      // 复制失败提示
      toast.error('复制失败，请手动选择文本', {
        duration: 3000,
        position: 'bottom-right'
      })
    }
  }

  const _handleRetry = () => {
    if (onRetry) {
      onRetry()
    }
  }

  return (
    <div
      data-message-id={message.id}
      className={cn(
        "flex gap-2 sm:gap-4 transition-all duration-300",
        isUser ? "justify-end" : "justify-start",
        isNewMessage && "animate-in slide-in-from-bottom-2 fade-in-0"
      )}
    >
      {/* 消息内容 */}
      <div className={cn(
        "max-w-[95%] sm:max-w-[90%] md:max-w-[85%] group",
        isUser && "flex flex-col items-end"
      )}>
        <div className={cn(
          "text-sm leading-relaxed relative overflow-hidden transition-all duration-500",
          // 用户消息：紧凑型气泡设计
          isUser
            ? "bg-primary/90 text-primary-foreground rounded-2xl rounded-br-md px-4 py-3"
            : hasError
              ? "bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl px-6 py-4"
              // 助手消息：宽松型设计，更适合长内容
              : "bg-muted/30 dark:bg-muted/20 border border-border/50 rounded-2xl rounded-bl-md px-6 py-4",
          // 微光闪烁效果 - 增强视觉反馈
          isAssistant && shouldGlow && "shadow-lg ring-2 ring-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5"
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

          {/* 状态指示器 - 仅对助手消息显示 */}
          {isAssistant && (isPending || isStreaming) && (
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
              {isPending && (
                <>
                  <div className="animate-pulse rounded-full h-2 w-2 bg-yellow-500" />
                  <span>正在思考...</span>
                </>
              )}
              {isStreaming && (
                <>
                  <div className="flex gap-1">
                    <div className="animate-bounce rounded-full h-1.5 w-1.5 bg-green-500" style={{ animationDelay: '0ms' }} />
                    <div className="animate-bounce rounded-full h-1.5 w-1.5 bg-green-500" style={{ animationDelay: '150ms' }} />
                    <div className="animate-bounce rounded-full h-1.5 w-1.5 bg-green-500" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>正在生成...</span>
                </>
              )}
            </div>
          )}

          {/* 消息文本 */}
          <div className="relative z-10">
            {isAssistant ? (
              <SecureMarkdown
                content={message.content}
                variant="compact"
                className="leading-relaxed"
              />
            ) : (
              <div className="whitespace-pre-wrap leading-relaxed">
                {message.content}
              </div>
            )}
          </div>

        </div>

        {/* 消息元信息 - 渐进式信息披露，减少认知负荷 */}
        <div className="flex items-center justify-between gap-2 mt-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {/* 基础信息：时间戳 */}
            <span>
              {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>

            {/* 扩展信息：hover 时显示 */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-2">
              {/* 模型信息 - 仅在 hover 时显示 */}
              {message.metadata?.model && (
                <>
                  <span>•</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-xs bg-muted/50 border border-muted/20 transition-all duration-200",
                    shouldGlow && isAssistant ? "bg-primary/10 border-primary/20 text-primary" : "text-muted-foreground"
                  )} title={`使用 ${getModelProvider(message.metadata.model).name} 模型`}>
                    {getModelDisplayName(message.metadata.model).split(' ')[0]}
                  </span>
                </>
              )}

              {/* 字数 - hover 时显示 */}
              {wordCount > 0 && (
                <>
                  <span>•</span>
                  <span className="text-muted-foreground/70">
                    {wordCount} 字
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 复制按钮 - 移动端友好化，增大触控面积 */}
          {isAssistant && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "min-h-[32px] min-w-[60px] px-2 text-xs transition-all duration-200 touch-manipulation",
                copied
                  ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
                  : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary hover:bg-primary/10",
                "rounded-md"
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
