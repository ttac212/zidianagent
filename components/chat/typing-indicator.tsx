/**
 * 生成过程指示器
 * 支持排队、整理、输出三个阶段的视觉反馈
 */

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { ResponsePhase } from '@/types/chat'

interface TypingIndicatorProps {
  isVisible: boolean
  phase?: ResponsePhase
  previewContent?: string
  maxPreviewLength?: number
}

const PHASE_MESSAGES: Record<Exclude<ResponsePhase, 'idle'>, string> = {
  queueing: '请求已进入队列，请稍候',
  organizing: '正在整理思路，请稍候',
  responding: '正在撰写回复中'
}

export const TypingIndicator = React.memo<TypingIndicatorProps>(({
  isVisible,
  phase = 'organizing',
  previewContent = '',
  maxPreviewLength = 50
}) => {
  const truncatedPreview = useMemo(() => {
    if (!previewContent || previewContent.length <= maxPreviewLength) {
      return previewContent
    }

    let truncated = previewContent.substring(0, maxPreviewLength)
    const lastSpaceIndex = truncated.lastIndexOf(' ')
    const lastChineseIndex = truncated.search(/[\u4e00-\u9fa5][^\u4e00-\u9fa5]*$/)

    if (lastSpaceIndex > maxPreviewLength * 0.7) {
      truncated = truncated.substring(0, lastSpaceIndex)
    } else if (lastChineseIndex > maxPreviewLength * 0.7) {
      truncated = truncated.substring(0, lastChineseIndex + 1)
    }

    return truncated + '...'
  }, [previewContent, maxPreviewLength])

  if (!isVisible || phase === 'idle') {
    return null
  }

  const showPreview = phase === 'responding'
  const message = PHASE_MESSAGES[phase as Exclude<ResponsePhase, 'idle'>]

  return (
    <div className="flex gap-4 justify-start animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div
        className={cn(
          'rounded-2xl px-6 py-4 max-w-[80%] relative overflow-hidden',
          'bg-muted/50 border border-muted/20 backdrop-blur-sm',
          'transition-all duration-300 ease-out'
        )}
      >
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-r from-transparent to-transparent -skew-x-12 opacity-60',
            phase === 'queueing'
              ? 'via-primary/20 animate-pulse'
              : phase === 'organizing'
                ? 'via-primary/30 animate-pulse'
                : 'via-primary/15 animate-pulse'
          )}
        />

        <div className="relative z-10 text-muted-foreground">
          {showPreview ? (
            <div className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-foreground/80">{message}</span>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <span>{truncatedPreview || '正在准备回复内容...'}</span>
                <span
                  className="inline-block w-0.5 h-4 bg-primary/60 animate-pulse"
                  style={{ animationDuration: '1s' }}
                />
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s`, animationDuration: '1.2s' }}
                  />
                ))}
              </div>
              <span className="text-sm font-medium transition-colors duration-300">{message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

TypingIndicator.displayName = 'TypingIndicator'
