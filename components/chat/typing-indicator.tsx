/**
 * AI 思考与打字状态指示器组件
 * 支持两种状态：思考状态 + 实时打字预览
 * 极简设计，配合SSE流式响应提供丰富用户反馈
 */

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'

type TypingMode = 'thinking' | 'typing'

interface TypingIndicatorProps {
  isVisible: boolean
  mode?: TypingMode
  message?: string
  previewContent?: string
  maxPreviewLength?: number
}

export const TypingIndicator = React.memo<TypingIndicatorProps>(({
  isVisible,
  mode = 'thinking',
  message = 'AI 正在思考...',
  previewContent = '',
  maxPreviewLength = 50
}) => {
  // 智能内容截断 - 截断到完整词边界
  const truncatedPreview = useMemo(() => {
    if (!previewContent || previewContent.length <= maxPreviewLength) {
      return previewContent
    }
    
    let truncated = previewContent.substring(0, maxPreviewLength)
    
    // 尝试截断到完整词边界（中英文兼容）
    const lastSpaceIndex = truncated.lastIndexOf(' ')
    const lastChineseIndex = truncated.search(/[\u4e00-\u9fa5][^\u4e00-\u9fa5]*$/)
    
    if (lastSpaceIndex > maxPreviewLength * 0.7) {
      truncated = truncated.substring(0, lastSpaceIndex)
    } else if (lastChineseIndex > maxPreviewLength * 0.7) {
      truncated = truncated.substring(0, lastChineseIndex + 1)
    }
    
    return truncated + '...'
  }, [previewContent, maxPreviewLength])

  if (!isVisible) return null

  return (
    <div className="flex gap-4 justify-start animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      {/* AI 状态容器 - 支持双状态设计 */}
      <div className={cn(
        "rounded-2xl px-6 py-4 max-w-[80%] relative overflow-hidden",
        "bg-muted/50 border border-muted/20 backdrop-blur-sm",
        "transition-all duration-300 ease-out"
      )}>
        {/* 微光效果背景 - 根据模式调整强度 */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-r from-transparent to-transparent -skew-x-12 opacity-50",
          mode === 'thinking' 
            ? "via-primary/20 animate-pulse" 
            : "via-primary/10 animate-pulse"
        )} />
        
        <div className="flex items-center gap-3 text-muted-foreground relative z-10">
          {mode === 'thinking' ? (
            // 思考状态 - 跳动指示点
            <>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div 
                    key={i}
                    className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"
                    style={{
                      animationDelay: `${i * 0.15}s`,
                      animationDuration: '1.2s'
                    }}
                  />
                ))}
              </div>
              <span className="text-sm font-medium transition-colors duration-300">
                {message}
              </span>
            </>
          ) : (
            // 打字状态 - 实时预览 + 光标闪烁
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">正在输入:</span>
              <span className="text-sm">
                {truncatedPreview}
                <span className="inline-block w-0.5 h-4 bg-primary/60 ml-1 animate-pulse" 
                      style={{ animationDuration: '1s' }} />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

TypingIndicator.displayName = 'TypingIndicator'