/**
 * MessageItemV2 组件
 * 无气泡设计的助手消息展示组件
 * 提供开放式文档阅读体验
 */

"use client"

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Copy, Check, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast/toast'
import type { MessageItemProps } from '@/types/chat'
import { ThinkingIndicator } from './thinking-indicator'
import { ModelBadge } from './model-badge'
import { MessageSection, parseMessageSections } from './message-section'
import { DouyinProgress } from './douyin-progress'
import { DouyinCommentsProgress } from './douyin-comments-progress'
import { usePipelineState } from '@/hooks/use-pipeline-handler'

export const MessageItemV2 = React.memo<MessageItemProps>(({
  message,
  onRetry
}) => {
  const hasError = message.metadata?.error
  const pipelineState = usePipelineState(message.metadata?.pipelineStateId)
  const isProgressCard = Boolean(pipelineState && message.metadata?.pipelineRole === 'progress')
  const videoProgress = pipelineState && pipelineState.source === 'douyin-video' ? pipelineState.progress : null
  const commentsProgress = pipelineState && pipelineState.source === 'douyin-comments' ? pipelineState.progress : null
  const isStreaming = message.status === 'streaming'
  const isPending = message.status === 'pending'
  const isCompleted = message.status === 'completed'

  // 复制状态
  const [copied, setCopied] = useState(false)

  // 字数统计
  const wordCount = isProgressCard ? 0 : message.content.length

  // 解析消息章节
  const parsedSections = React.useMemo(() => {
    if (isProgressCard || !message.content) return []
    return parseMessageSections(message.content)
  }, [message.content, isProgressCard])

  // 复制功能
  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(message.content)
      }

      setCopied(true)

      toast.success('已复制到剪贴板', {
        duration: 2000,
        position: 'bottom-right',
        icon: <Check className="w-4 h-4" />,
        className: 'text-sm'
      })

      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (_err) {
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

  // 计算状态
  const badgeStatus = isPending ? 'thinking' : isStreaming ? 'streaming' : hasError ? 'error' : 'done'

  return (
    <div
      data-message-id={message.id}
      className="w-full transition-all duration-300"
    >
      {/* 主内容容器 - 无气泡设计 */}
      <div className="w-full py-8 group relative">
        <div className="relative z-10">
          {/* Pipeline 进度卡片 - 特殊处理 */}
          {isProgressCard && pipelineState?.source === 'douyin-video' && videoProgress ? (
            <DouyinProgress progress={videoProgress} />
          ) : isProgressCard && pipelineState?.source === 'douyin-comments' && commentsProgress ? (
            <DouyinCommentsProgress progress={commentsProgress} />
          ) : (
            <>
              {/* 模型标识 */}
              {message.metadata?.model && (
                <div className="mb-4">
                  <ModelBadge
                    modelId={message.metadata.model}
                    status={badgeStatus}
                    size="md"
                  />
                </div>
              )}

              {/* 状态指示器 - 仅在 pending/streaming 时显示 */}
              {(isPending || isStreaming) && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 mb-4 text-sm text-muted-foreground font-medium"
                >
                  {isPending && (
                    <>
                      <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="rounded-full h-2 w-2 bg-amber-500"
                      />
                      <span>AI 正在思考...</span>
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
                      <span>正在生成回复...</span>
                    </>
                  )}
                </motion.div>
              )}

              {/* 思考过程 */}
              {message.reasoning && (
                <ThinkingIndicator
                  reasoning={message.reasoning}
                  reasoningEffort={message.metadata?.reasoningEffort}
                  defaultExpanded={true}
                  isStreaming={isStreaming || isPending}
                />
              )}

              {/* 错误提示 */}
              {hasError && (
                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center mt-0.5">
                      <span className="text-destructive text-xs font-bold">!</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-destructive mb-1">回复失败</h4>
                      <p className="text-xs text-muted-foreground">{message.metadata?.error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 消息内容 - 章节化展示 */}
              {parsedSections.length > 0 && (
                <div className="space-y-6">
                  {parsedSections.map((section, idx) => (
                    <MessageSection
                      key={`section-${idx}`}
                      title={section.title}
                      content={section.content}
                      index={section.title ? section.index : undefined}
                    />
                  ))}
                </div>
              )}

              {/* 如果没有内容且不是进度卡片，显示空状态 */}
              {parsedSections.length === 0 && !message.content && !isPending && !isStreaming && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  暂无内容
                </div>
              )}
            </>
          )}
        </div>

        {/* 消息元信息 - 合并所有操作按钮 */}
        {!isProgressCard && (
          <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground relative z-10">
            <div className="flex items-center gap-2">
              {/* 时间戳 */}
              <span>
                {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>

              {/* 字数统计 - hover 显示 */}
              {wordCount > 0 && (
                <>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">•</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {wordCount} 字
                  </span>
                </>
              )}
            </div>

            {/* 操作按钮组 */}
            <div className="flex items-center gap-2">
              {/* 重试按钮 */}
              {onRetry && (isCompleted || hasError) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "min-h-[32px] px-2 text-xs gap-1.5 transition-all duration-200",
                    "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                  )}
                  onClick={_handleRetry}
                  title={hasError ? "重新发送" : "重新生成"}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {hasError ? '重新发送' : '重新生成'}
                </Button>
              )}

              {/* 复制按钮 */}
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "min-h-[32px] min-w-[60px] px-2 text-xs transition-all duration-200",
                  copied
                    ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
                    : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary hover:bg-primary/10",
                  "rounded-md"
                )}
                onClick={handleCopy}
                title={copied ? "已复制" : "复制消息内容"}
                disabled={copied || !message.content}
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

MessageItemV2.displayName = 'MessageItemV2'
