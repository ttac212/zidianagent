/**
 * 消息项组件
 * 显示单条消息，包含用户消息和助手消息
 */

import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Copy, Check, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast/toast'
import type { MessageItemProps } from '@/types/chat'
import { getModelDisplayName, getModelProvider } from '@/lib/model-utils'
import { SecureMarkdown } from '@/components/ui/secure-markdown'
import { MESSAGE_BUBBLE_MAX_WIDTH } from '@/lib/config/layout-config'
import { DouyinProgress } from './douyin-progress'
import { DouyinCommentsProgress } from './douyin-comments-progress'
import { usePipelineState } from '@/hooks/use-pipeline-handler'

export const MessageItem = React.memo<MessageItemProps>(({
  message,
  onRetry
}) => {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const hasError = message.metadata?.error
  const pipelineState = usePipelineState(message.metadata?.pipelineStateId)
  const isProgressCard = Boolean(pipelineState && message.metadata?.pipelineRole === 'progress')
  const videoProgress = pipelineState && pipelineState.source === 'douyin-video' ? pipelineState.progress : null
  const commentsProgress = pipelineState && pipelineState.source === 'douyin-comments' ? pipelineState.progress : null
  const isStreaming = message.status === 'streaming'
  const isPending = message.status === 'pending'
  const isCompleted = message.status === 'completed'

  // 微光闪烁状态 - 新回复时触发
  const [shouldGlow, setShouldGlow] = useState(false)
  const [isNewMessage, setIsNewMessage] = useState(false)

  // 复制状态
  const [copied, setCopied] = useState(false)

  // 字数统计
  const wordCount = isProgressCard ? 0 : message.content.length

  const reasoningLines = useMemo(() => {
    if (!message.reasoning) return []

    return message.reasoning
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0)
  }, [message.reasoning])

  const reasoningEffort = message.metadata?.reasoningEffort
  const reasoningEffortLabels = {
    low: '低强度',
    medium: '中强度',
    high: '高强度'
  } as const

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
        MESSAGE_BUBBLE_MAX_WIDTH,
        "group",
        isUser && "flex flex-col items-end"
      )}>
        <div className={cn(
          "text-sm leading-relaxed relative overflow-hidden transition-all duration-500",
          (isProgressCard)
            ? "border-none bg-transparent px-0 py-0"
            : isUser
              ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3"
              : hasError
                ? "bg-destructive/10 border border-destructive/30 text-destructive rounded-2xl px-6 py-4"
                : "bg-muted/50 dark:bg-muted/40 border border-border rounded-2xl rounded-bl-md px-6 py-4",
          isAssistant && shouldGlow && !isProgressCard && "shadow-lg ring-2 ring-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5"
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
          {isAssistant && !isProgressCard && (isPending || isStreaming) && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 mb-2 text-xs text-muted-foreground font-medium"
            >
              {isPending && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="rounded-full h-2 w-2 bg-amber-500"
                  />
                  <span>正在思考...</span>
                </>
              )}
              {isStreaming && (
                <>
                  <motion.div className="flex gap-1">
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                      className="rounded-full h-1.5 w-1.5 bg-emerald-500"
                    />
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }}
                      className="rounded-full h-1.5 w-1.5 bg-emerald-500"
                    />
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }}
                      className="rounded-full h-1.5 w-1.5 bg-emerald-500"
                    />
                  </motion.div>
                  <span>正在生成...</span>
                </>
              )}
            </motion.div>
          )}

          {/* 消息文本 */}
          <div className="relative z-10">
            {isProgressCard && pipelineState?.source === 'douyin-video' && videoProgress ? (
              <DouyinProgress progress={videoProgress} />
            ) : isProgressCard && pipelineState?.source === 'douyin-comments' && commentsProgress ? (
              <DouyinCommentsProgress progress={commentsProgress} />
            ) : isAssistant ? (
              <>
                {/* 推理过程显示（ZenMux 推理模型） */}
                {reasoningLines.length > 0 && (
                  <div className="mb-4 pb-4 border-b border-border/50">
                    <div className="flex items-center justify-between gap-2 mb-2 text-xs font-medium text-muted-foreground/70">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span>推理过程</span>
                      </div>
                      {reasoningEffort && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground/80">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                          {reasoningEffortLabels[reasoningEffort]}
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1.5 text-xs text-muted-foreground/80 leading-relaxed">
                      {reasoningLines.map((line, index) => {
                        const isLatest = index === reasoningLines.length - 1
                        const isActive = isLatest && (isStreaming || isPending)
                        const indicatorClass = cn(
                          'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors duration-200',
                          isActive
                            ? 'border-emerald-500 text-emerald-600 bg-emerald-500/15 animate-pulse'
                            : 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                        )

                        return (
                          <li key={`${line}-${index}`} className="flex items-start gap-2">
                            <span className={indicatorClass}>
                              {isActive ? '…' : '✓'}
                            </span>
                            <span className="flex-1 whitespace-pre-wrap">{line}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {/* 回复内容 */}
                <SecureMarkdown
                  content={message.content}
                  variant="compact"
                  className="leading-relaxed"
                />
              </>
            ) : (
              <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
            )}
          </div>

        </div>

        {isAssistant && !isProgressCard && onRetry && (isCompleted || hasError) && (
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5"
              onClick={_handleRetry}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {hasError ? '重新发送' : '重新生成'}
            </Button>
          </div>
        )}

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
                  <span className="text-muted-foreground">
                    {wordCount} 字
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 复制按钮 - 移动端友好化，增大触控面积 */}
          {isAssistant && !isProgressCard && (
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
