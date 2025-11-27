/**
 * ThinkingIndicator 组件
 * 显示 AI 推理过程，支持展开/折叠
 */

"use client"

import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface ThinkingIndicatorProps {
  reasoning?: string                    // 思考过程文本
  reasoningEffort?: 'low' | 'medium' | 'high'  // 推理强度
  thinkingTime?: number                 // 思考时长（秒）
  defaultExpanded?: boolean             // 默认展开状态
  isStreaming?: boolean                 // 是否正在思考
  className?: string
}

// 推理强度标签映射
const reasoningEffortLabels = {
  low: { label: '低', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  medium: { label: '中', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  high: { label: '高', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' }
} as const

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  reasoning,
  reasoningEffort,
  thinkingTime,
  defaultExpanded = true,
  isStreaming = false,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // 如果没有推理内容，不显示组件
  if (!reasoning) {
    return null
  }

  // 获取推理强度配置
  const effortConfig = reasoningEffort ? reasoningEffortLabels[reasoningEffort] : null

  return (
    <div className={cn("mb-6 space-y-2", className)}>
      {/* 标题栏（无边框，使用轻量化标记） */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between gap-3 px-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={cn(
            "h-2.5 w-2.5 rounded-full",
            isStreaming ? "bg-emerald-500 animate-pulse" : "bg-emerald-400/80"
          )} />
          <span className="font-medium text-foreground">推理过程</span>
          {thinkingTime && thinkingTime > 0 && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {thinkingTime.toFixed(1)}s
            </span>
          )}
          {effortConfig && (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              effortConfig.color
            )}>
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
              {effortConfig.label}
            </span>
          )}
        </div>

        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* 思考内容 - 左侧细线，无背景卡片 */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <div className="pl-3 border-l border-dashed border-border/60 text-sm leading-relaxed text-muted-foreground font-mono whitespace-pre-wrap">
              {reasoning}
              {isStreaming && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="h-2 w-2 rounded-full bg-emerald-500"
                  />
                  <span>深度思考中...</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

ThinkingIndicator.displayName = 'ThinkingIndicator'
