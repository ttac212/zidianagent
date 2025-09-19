"use client"

import React, { useState, useMemo, useCallback } from 'react'

// 导入现有的消息类型
import type { ChatMessage } from '@/types/chat'

// 时间轴数据点接口
interface TimelinePoint {
  messageId: string
  index: number
  percentage: number
  timestamp: number
  date: Date
  isAIMessage: boolean
}

// 组件 Props
interface TimelineScrollbarProps {
  messages: ChatMessage[]
  currentMessageId?: string | null
  onJumpToMessage: (messageId: string) => void
  containerHeight?: number
  className?: string
}

/**
 * 简化版时间轴滚动条组件
 * 只保留点击跳转功能，移除悬浮提示框
 */

// 对话轮次提取算法 - 基于user-assistant对话结构
const getConversationTurns = (messages: ChatMessage[], maxPoints: number) => {
  if (messages.length === 0 || maxPoints <= 0) return []
  if (messages.length === 1) return [messages[0]]
  
  const turns: ChatMessage[] = []
  let lastRole = ''
  
  // 识别对话轮次的转换点
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    
    // 角色切换点或第一条消息
    if (i === 0 || message.role !== lastRole) {
      turns.push(message)
    }
    
    lastRole = message.role
  }
  
  // 总是包含最后一条消息（避免重复）
  if (messages.length > 1) {
    const lastMessage = messages[messages.length - 1]
    if (!turns.some(t => t.id === lastMessage.id)) {
      turns.push(lastMessage)
    }
  }
  
  // 如果轮次数量超过限制，优先保留AI回复和开始/结束
  if (turns.length > maxPoints) {
    const prioritized: ChatMessage[] = []
    
    // 强制保留首尾（避免重复）
    const firstMessage = messages[0]
    const lastMessage = messages[messages.length - 1]
    
    prioritized.push(firstMessage)
    if (messages.length > 1 && lastMessage.id !== firstMessage.id) {
      prioritized.push(lastMessage)
    }
    
    // 优先选择AI回复（通常更重要）
    const aiTurns = turns.filter(m => 
      m.role === 'assistant' && 
      !prioritized.some(p => p.id === m.id)
    )
    const remainingSlots = maxPoints - prioritized.length
    
    for (let i = 0; i < Math.min(aiTurns.length, remainingSlots); i++) {
      prioritized.push(aiTurns[i])
    }
    
    // 优化排序：创建索引映射避免重复indexOf调用
    const messageIndexMap = new Map()
    messages.forEach((msg, index) => messageIndexMap.set(msg.id, index))
    
    return prioritized.sort((a, b) => 
      (messageIndexMap.get(a.id) || 0) - (messageIndexMap.get(b.id) || 0)
    )
  }
  
  return turns
}

// 关键消息点提取算法 - 基于内容和时间间隔
const getKeyMessagePoints = (messages: ChatMessage[], maxPoints: number) => {
  const keyPoints: ChatMessage[] = []
  const timeGaps: number[] = []
  
  // 计算时间间隔，寻找对话的自然分段
  for (let i = 1; i < messages.length; i++) {
    timeGaps.push(messages[i].timestamp - messages[i-1].timestamp)
  }
  
  const avgGap = timeGaps.reduce((a, b) => a + b, 0) / timeGaps.length
  const longGapThreshold = avgGap * 3 // 3倍平均间隔认为是长停顿
  
  // 总是包含首尾消息（避免重复）
  const firstMessage = messages[0]
  const lastMessage = messages[messages.length - 1]
  
  keyPoints.push(firstMessage)
  if (messages.length > 1 && lastMessage.id !== firstMessage.id) {
    keyPoints.push(lastMessage)
  }
  
  // 查找长停顿后的消息（对话重新开始点）
  for (let i = 1; i < messages.length && keyPoints.length < maxPoints; i++) {
    const gap = messages[i].timestamp - messages[i-1].timestamp
    if (gap > longGapThreshold) {
      const message = messages[i]
      // 避免添加重复的消息
      if (!keyPoints.some(p => p.id === message.id)) {
        keyPoints.push(message)
      }
    }
  }
  
  // 如果还有空间，均匀补充中间点
  while (keyPoints.length < maxPoints && keyPoints.length < messages.length) {
    const step = Math.floor(messages.length / (maxPoints - keyPoints.length + 1))
    const nextIndex = keyPoints.length * step
    if (nextIndex < messages.length) {
      const message = messages[nextIndex]
      if (!keyPoints.some(p => p.id === message.id)) {
        keyPoints.push(message)
      } else break
    } else break
  }
  
  // 按时间戳排序
  return keyPoints.sort((a, b) => a.timestamp - b.timestamp)
}

// 时间段分组算法
const getTimeBasedGroups = (messages: ChatMessage[], maxGroups: number) => {
  const groups: ChatMessage[] = []
  const totalDuration = messages[messages.length - 1].timestamp - messages[0].timestamp
  const groupDuration = totalDuration / maxGroups
  
  for (let i = 0; i < maxGroups; i++) {
    const groupStart = messages[0].timestamp + i * groupDuration
    const groupEnd = groupStart + groupDuration
    
    // 找到该时间段内的代表性消息（通常选择AI回复）
    const groupMessages = messages.filter(m => 
      m.timestamp >= groupStart && m.timestamp < groupEnd
    )
    
    if (groupMessages.length > 0) {
      // 优先选择AI助手的回复作为代表点
      const aiMessage = groupMessages.find(m => m.role === 'assistant')
      groups.push(aiMessage || groupMessages[Math.floor(groupMessages.length / 2)])
    }
  }
  
  return groups
}

// 超长对话的渐进式披露点
const getProgressiveDisclosurePoints = (messages: ChatMessage[], maxPoints: number) => {
  const points: ChatMessage[] = []
  
  // 始终包含开始和结束（避免重复）
  const firstMessage = messages[0]
  const lastMessage = messages[messages.length - 1]
  
  points.push(firstMessage)
  if (messages.length > 1 && lastMessage.id !== firstMessage.id) {
    points.push(lastMessage)
  }
  
  // 找到对话的"章节"分界点（基于长时间间隔）
  const timeGaps: {index: number, gap: number}[] = []
  for (let i = 1; i < messages.length; i++) {
    const gap = messages[i].timestamp - messages[i-1].timestamp
    timeGaps.push({index: i, gap})
  }
  
  // 按间隔时间排序，选择最大的几个间隔作为章节分界
  timeGaps.sort((a, b) => b.gap - a.gap)
  const chapterBreaks = timeGaps.slice(0, maxPoints - 2).sort((a, b) => a.index - b.index)
  
  chapterBreaks.forEach(breakPoint => {
    if (breakPoint.index < messages.length) {
      const message = messages[breakPoint.index]
      // 避免添加重复的消息
      if (!points.some(p => p.id === message.id)) {
        points.push(message)
      }
    }
  })
  
  return points.sort((a, b) => a.timestamp - b.timestamp)
}

export const TimelineScrollbar: React.FC<TimelineScrollbarProps> = ({
  messages,
  currentMessageId,
  onJumpToMessage,
  containerHeight = 400,
  className = ""
}) => {
  // 三级渐进式显示策略 - 基于UX研究的最佳实践
  const timelineData = useMemo((): TimelinePoint[] => {
    if (messages.length === 0) return []
    
    const firstTime = messages[0].timestamp
    const lastTime = messages[messages.length - 1].timestamp
    const totalDuration = lastTime - firstTime
    
    // 智能采样策略：基于对话结构和消息数量
    let samplesToShow: ChatMessage[] = []
    
    if (messages.length <= 17) {
      // ≤ 17条：智能选择关键对话轮次，避免过度拥挤
      samplesToShow = getConversationTurns(messages, Math.min(messages.length, 12))
    } else if (messages.length <= 50) {
      // 18-50条：关键点 + 时间段标记策略
      samplesToShow = getKeyMessagePoints(messages, 12) // 显示最多12个关键点
    } else if (messages.length <= 100) {
      // 51-100条：时间段分组 + 重要节点
      samplesToShow = getTimeBasedGroups(messages, 10) // 10个时间段代表点
    } else {
      // > 100条：超长对话的三级渐进披露
      samplesToShow = getProgressiveDisclosurePoints(messages, 8) // 8个主要节点
    }
    
    // 确保去重：按messageId去重，保持原始顺序
    const uniqueSamples = samplesToShow.filter((message, index, array) => 
      array.findIndex(m => m.id === message.id) === index
    )
    
    // 智能分布算法：混合时间和结构
    const timelinePoints = uniqueSamples.map((message, arrayIndex) => {
      const originalIndex = messages.findIndex(m => m.id === message.id)
      
      // 计算基于对话结构的位置（考虑消息序号）
      const structuralPercentage = uniqueSamples.length > 1 
        ? (arrayIndex / (uniqueSamples.length - 1)) * 100 
        : 0
      
      // 计算基于时间的位置
      const relativeTime = message.timestamp - firstTime
      const timePercentage = totalDuration > 0 
        ? (relativeTime / totalDuration) * 100 
        : structuralPercentage
      
      // 智能权重策略
      let finalPercentage = structuralPercentage
      
      if (totalDuration > 0) {
        // 分析时间分布的均匀程度
        const timeSpread = totalDuration / (1000 * 60) // 转换为分钟
        
        if (timeSpread > 60) {
          // >1小时的对话：时间权重70%，结构权重30%
          finalPercentage = timePercentage * 0.7 + structuralPercentage * 0.3
        } else if (timeSpread > 10) {
          // 10分钟-1小时：时间权重50%，结构权重50%
          finalPercentage = timePercentage * 0.5 + structuralPercentage * 0.5
        } else {
          // <10分钟（高频对话）：时间权重20%，结构权重80%
          finalPercentage = timePercentage * 0.2 + structuralPercentage * 0.8
        }
      }
      
      return {
        messageId: message.id,
        index: originalIndex,
        percentage: finalPercentage,
        timestamp: message.timestamp,
        date: new Date(message.timestamp),
        isAIMessage: message.role === 'assistant'
      }
    })
    
    // 间距过滤逻辑 - 根据消息数量调整策略
    const filteredPoints: TimelinePoint[] = []
    let lastPercentage = -10
    
    // 根据消息数量和时间跨度调整间距要求
    const timeSpread = totalDuration / (1000 * 60) // 分钟
    let minSpacing = 6 // 默认6%
    
    if (messages.length <= 17) {
      minSpacing = 2 // ≤17条消息：宽松间距，显示更多关键点
    } else if (messages.length <= 50) {
      minSpacing = 4 // 18-50条：中等间距
    }
    
    // 高频对话（<10分钟）需要更宽松的间距
    if (timeSpread < 10) {
      minSpacing = Math.max(1, minSpacing - 2)
    }
    
    for (const point of timelinePoints) {
      if (point.percentage - lastPercentage >= minSpacing || filteredPoints.length === 0) {
        filteredPoints.push(point)
        lastPercentage = point.percentage
      }
    }
    
    return filteredPoints
  }, [messages])

  // 优化双色系统 - 清晰的颜色对比
  const getMessageColor = (point: TimelinePoint, isActive: boolean) => {
    if (isActive) return 'bg-orange-500 shadow-xl ring-2 ring-orange-300/50'
    
    if (point.isAIMessage) {
      // AI消息：鲜明蓝色
      return 'bg-blue-500 hover:bg-blue-600 hover:shadow-md border border-blue-300/30 shadow-blue-200/10'
    } else {
      // 用户消息：深灰色
      return 'bg-slate-600 hover:bg-slate-700 hover:shadow-md border border-slate-400/30 shadow-slate-200/10'
    }
  }

  return (
    <div className={`relative w-10 flex items-center justify-center ${className}`}>
      {/* 时间轴轨道 */}
      <div
        className="relative w-8 cursor-pointer transition-all duration-200"
        style={{ 
          height: `${containerHeight - 60}px`,
          marginTop: '20px'
        }}
      >
        {/* 背景轨道 */}
        <div className="absolute left-1/2 top-0 w-1 h-full bg-muted/30 rounded-full transform -translate-x-1/2" />
        {/* 细线连接点 */}
        <div className="absolute left-1/2 top-0 w-px h-full bg-border/40 transform -translate-x-1/2" />
        
        {/* 智能圆点 */}
        {timelineData.map((point) => {
          const isActive = currentMessageId === point.messageId
          
          return (
            <div
              key={point.messageId}
              className={`absolute rounded-full cursor-pointer transform -translate-x-1/2 transition-all duration-300 ${
                getMessageColor(point, isActive)
              } ${
                isActive 
                  ? 'w-4 h-4 z-[25]' 
                  : 'w-2.5 h-2.5 hover:w-3.5 hover:h-3.5 hover:z-[15] hover:scale-110'
              }`}
              style={{
                top: `${point.percentage}%`,
                left: '50%'
              }}
              onClick={(e) => {
                e.stopPropagation()
                onJumpToMessage(point.messageId)
              }}
              title={`跳转到${point.isAIMessage ? 'AI' : '用户'}消息 (#${point.index + 1})`}
            >
              {/* 激活状态的光环效果 */}
              {isActive && (
                <div className="absolute inset-0 rounded-full animate-ping bg-orange-400/40" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

TimelineScrollbar.displayName = 'TimelineScrollbar'