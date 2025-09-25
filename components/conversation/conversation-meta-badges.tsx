/**
 * 对话元信息徽章组件
 * 显示消息数量、时间、模型等信息
 */

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Pin, MessageSquare, Clock, Cpu } from 'lucide-react'
import type { DerivedConversation } from '@/lib/utils/conversation-list'

interface ConversationMetaBadgesProps {
  conversation: DerivedConversation
  variant?: 'default' | 'compact'
  showModel?: boolean
  showTime?: boolean
  showMessageCount?: boolean
  showPinned?: boolean
  className?: string
}

export function ConversationMetaBadges({
  conversation,
  variant = 'default',
  showModel = true,
  showTime = true,
  showMessageCount = true,
  showPinned = true,
  className = ''
}: ConversationMetaBadgesProps) {
  const isCompact = variant === 'compact'

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* 固定状态徽章 */}
      {showPinned && conversation.isPinned && (
        <Badge
          variant="secondary"
          className="h-5 px-1.5 text-[10px] bg-primary/10 text-primary border-primary/20"
        >
          <Pin className="w-2.5 h-2.5 mr-0.5" />
          {!isCompact && '已固定'}
        </Badge>
      )}

      {/* 消息数量徽章 */}
      {showMessageCount && (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          <MessageSquare className="w-2.5 h-2.5 mr-0.5" />
          {conversation.metadata?.messageCount || conversation.messages?.length || 0}
        </Badge>
      )}

      {/* 时间徽章 */}
      {showTime && (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          <Clock className="w-2.5 h-2.5 mr-0.5" />
          {conversation.lastUpdatedLabel}
        </Badge>
      )}

      {/* 模型徽章 */}
      {showModel && conversation.model && (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          <Cpu className="w-2.5 h-2.5 mr-0.5" />
          {isCompact
            ? conversation.model.split('-')[0] // 紧凑模式只显示模型名前缀
            : conversation.model.split('-').slice(0, 2).join('-') // 显示前两部分
          }
        </Badge>
      )}
    </div>
  )
}

// 专用的紧凑版本组件
export function ConversationMetaBadgesCompact(props: Omit<ConversationMetaBadgesProps, 'variant'>) {
  return <ConversationMetaBadges {...props} variant="compact" />
}

// 只显示关键信息的极简版本
export function ConversationMetaBadgesMinimal({
  conversation,
  className = ''
}: Pick<ConversationMetaBadgesProps, 'conversation' | 'className'>) {
  return (
    <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
      {conversation.isPinned && (
        <Pin className="w-3 h-3 text-primary" />
      )}
      <span>{conversation.metadata?.messageCount || conversation.messages?.length || 0} 条消息</span>
      <span>•</span>
      <span>{conversation.lastUpdatedLabel}</span>
      {conversation.model && (
        <>
          <span>•</span>
          <span className="px-1.5 py-0.5 rounded text-xs bg-muted/50">
            {conversation.model.split('-')[0]}
          </span>
        </>
      )}
    </div>
  )
}