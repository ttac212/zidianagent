"use client"

import { memo, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { PipelineProgressConfig } from './pipeline-progress-config'
import { STEP_STATUS_TEXT } from './pipeline-progress-config'

/** 通用的Pipeline进度状态结构 */
interface BasePipelineProgressState {
  steps: Array<{
    key: string
    status: 'pending' | 'active' | 'completed' | 'error'
    detail?: string
    labelOverride?: string
    descriptionOverride?: string
  }>
  percentage: number
  status: 'running' | 'completed' | 'failed'
  error?: string
  updatedAt: number
}

export interface PreviewSlotStyles {
  container: string
  title: string
  content: string
}

interface PipelineProgressSkeletonProps {
  /** 平台配置 */
  config: PipelineProgressConfig
  /** 步骤静态文案 */
  stepCopy: Record<string, { label: string; description: string }>
  /** 进度状态 */
  progress: BasePipelineProgressState
  /** 视频信息slot（可选） */
  videoInfoSlot?: ReactNode
  /** 实时预览slot（可选） */
  previewSlot?: (styles: PreviewSlotStyles) => ReactNode
}

function StepBadge({
  index,
  status,
  activeColor
}: {
  index: number
  status: 'pending' | 'active' | 'completed' | 'error'
  activeColor: string
}) {
  const base = 'flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold'

  const tone = {
    pending: 'border-muted text-muted-foreground',
    active: activeColor,
    completed: 'border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-300',
    error: 'border-red-500 text-red-600 dark:border-red-400 dark:text-red-300'
  }[status]

  return (
    <motion.span
      className={cn(base, tone)}
      animate={{ scale: status === 'active' ? 1.05 : 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {index + 1}
    </motion.span>
  )
}

/**
 * Pipeline进度骨架组件 - 公共UI逻辑
 * 使用slot模式处理平台特定内容
 */
export const PipelineProgressSkeleton = memo(({
  config,
  stepCopy,
  progress,
  videoInfoSlot,
  previewSlot
}: PipelineProgressSkeletonProps) => {
  const statusTone = config.statusBadgeStyles[progress.status]
  const isCompleted = progress.status === 'completed'
  const isFailed = progress.status === 'failed'
  const previewTokens: PreviewSlotStyles = {
    container: cn(
      'mt-4 rounded-md border border-muted-foreground/20 bg-background/60 p-3',
      config.previewStyles?.border,
      config.previewStyles?.background
    ),
    title: 'text-xs font-semibold text-muted-foreground',
    content: 'mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90'
  }

  return (
    <motion.div
      layout
      className="rounded-lg border border-border bg-muted/40 p-4 shadow-sm"
      transition={{ type: 'spring', stiffness: 240, damping: 28 }}
    >
      {/* 头部：标题和进度百分比 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{config.title}</p>
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', statusTone)}>
            {config.statusText[progress.status]}
          </span>
        </div>
        {!isCompleted && (
          <div className="text-sm font-medium text-muted-foreground">
            进度 {Math.min(100, Math.round(progress.percentage))}%
          </div>
        )}
      </div>

      {/* 步骤列表 - 只在处理中或失败时显示 */}
      {!isCompleted && (
        <ol className="mt-4 space-y-3">
          <AnimatePresence initial={false}>
            {progress.steps.map((step, idx) => {
              const copy = stepCopy[step.key] ?? { label: step.key, description: '' }
              const label = step.labelOverride ?? copy.label
              const description = step.descriptionOverride ?? copy.description

              return (
                <motion.li
                  layout
                  key={step.key}
                  className={cn(
                    'flex items-start gap-3 rounded-md border border-transparent px-3 py-2 transition-colors',
                    step.status === 'active' && config.activeStepColor.background,
                    step.status === 'completed' && 'bg-emerald-500/5',
                    step.status === 'error' && 'border-red-400/40 bg-red-500/10'
                  )}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <StepBadge index={idx} status={step.status} activeColor={config.activeStepColor.badge} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <span className="text-xs text-muted-foreground">
                        {STEP_STATUS_TEXT[step.status]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                    {step.detail && (
                      <motion.p
                        layout
                        className="mt-1 text-xs text-foreground"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        {step.detail}
                      </motion.p>
                    )}
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ol>
      )}

      {/* 视频信息slot - 只在处理中显示 */}
      <AnimatePresence>
        {!isCompleted && videoInfoSlot && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            {videoInfoSlot}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 实时预览slot - 只在处理中显示 */}
      <AnimatePresence>
        {!isCompleted && previewSlot && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            {previewSlot(previewTokens)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 错误信息 */}
      <AnimatePresence>
        {isFailed && progress.error && (
          <motion.div
            layout
            role="alert"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-4 rounded-md border border-red-300/40 bg-red-500/10 p-3 text-xs text-red-600 dark:border-red-500/30 dark:text-red-200"
          >
            {progress.error}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})

PipelineProgressSkeleton.displayName = 'PipelineProgressSkeleton'
