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
  low: { label: '低强度推理', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  medium: { label: '中强度推理', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  high: { label: '高强度推理', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' }
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
    <div className={cn("mb-6 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden", className)}>
      {/* 标题栏 */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {/* 思考图标 */}
          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>

          {/* 思考状态文字 */}
          <span>
            {isStreaming ? '正在思考...' : '推理过程'}
          </span>

          {/* 思考时长 */}
          {thinkingTime && thinkingTime > 0 && (
            <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">
              {thinkingTime.toFixed(1)}s
            </span>
          )}

          {/* 推理强度徽章 */}
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

        {/* 展开/折叠图标 */}
        <ChevronDown
          className={cn(
            "w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* 思考内容 */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <div className="px-4 py-3 bg-white dark:bg-gray-950">
              {/* 推理过程内容 - 连续文本展示 */}
              <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-mono">
                {reasoning}
              </div>

              {/* 正在思考的加载指示器 */}
              {isStreaming && (
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="rounded-full h-2 w-2 bg-emerald-500"
                  />
                  <span>AI 正在深度思考中...</span>
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
