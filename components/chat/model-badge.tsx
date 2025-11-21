/**
 * ModelBadge 组件
 * 显示当前使用的模型标识和状态
 */

"use client"

import React from 'react'
import { cn } from '@/lib/utils'
import { getModelDisplayName } from '@/lib/model-utils'
import { motion } from 'framer-motion'

interface ModelBadgeProps {
  modelId?: string                      // 模型ID
  provider?: string                     // 提供商名称（可选，自动从modelId推断）
  status?: 'idle' | 'thinking' | 'streaming' | 'done' | 'error'
  size?: 'sm' | 'md'
  className?: string
}

// 状态指示器配置
const statusConfig = {
  idle: {
    color: 'bg-gray-400 dark:bg-gray-600',
    label: '空闲',
    animate: false
  },
  thinking: {
    color: 'bg-amber-500 dark:bg-amber-400',
    label: '思考中',
    animate: true
  },
  streaming: {
    color: 'bg-emerald-500 dark:bg-emerald-400',
    label: '生成中',
    animate: true
  },
  done: {
    color: 'bg-blue-500 dark:bg-blue-400',
    label: '已完成',
    animate: false
  },
  error: {
    color: 'bg-red-500 dark:bg-red-400',
    label: '错误',
    animate: false
  }
} as const

export const ModelBadge: React.FC<ModelBadgeProps> = ({
  modelId,
  provider: _provider,
  status = 'idle',
  size = 'md',
  className
}) => {
  // 如果没有模型ID，不显示组件
  if (!modelId) {
    return null
  }

  // 获取模型友好名称
  const displayName = getModelDisplayName(modelId)

  // 获取状态配置
  const currentStatus = statusConfig[status]

  // 尺寸配置
  const sizeClasses = {
    sm: {
      container: 'text-xs gap-1.5',
      dot: 'w-1.5 h-1.5',
      text: 'text-xs'
    },
    md: {
      container: 'text-sm gap-2',
      dot: 'w-2 h-2',
      text: 'text-sm'
    }
  }

  const sizeClass = sizeClasses[size]

  return (
    <div className={cn(
      "inline-flex items-center font-medium text-gray-900 dark:text-gray-100",
      sizeClass.container,
      className
    )}>
      {/* 状态指示器圆点 */}
      {currentStatus.animate ? (
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.7, 1, 0.7]
          }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            ease: "easeInOut"
          }}
          className={cn(
            "rounded-full flex-shrink-0",
            sizeClass.dot,
            currentStatus.color
          )}
        />
      ) : (
        <div className={cn(
          "rounded-full flex-shrink-0",
          sizeClass.dot,
          currentStatus.color
        )} />
      )}

      {/* 模型名称 */}
      <span className={cn("font-medium", sizeClass.text)}>
        {displayName}
      </span>
    </div>
  )
}

ModelBadge.displayName = 'ModelBadge'
