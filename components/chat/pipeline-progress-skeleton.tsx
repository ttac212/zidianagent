"use client"

import { memo, type ReactNode } from 'react'
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
  const base = 'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ring-1 ring-inset ring-transparent transition-transform duration-150'

  const tone = {
    pending: 'bg-muted text-muted-foreground ring-border/60',
    active: activeColor,
    completed: 'bg-emerald-500/15 text-emerald-700 ring-emerald-200/70 dark:text-emerald-200 dark:ring-emerald-500/50',
    error: 'bg-red-500/10 text-red-600 ring-red-400/60 dark:text-red-200 dark:ring-red-400/50'
  }[status]

  return (
    <span
      className={cn(base, tone, status === 'active' && 'scale-105')}
    >
      {index + 1}
    </span>
  )
}

/**
 * Pipeline进度骨架组件 - 公共UI逻辑
 * 使用slot模式处理平台特定内容
 * 简化动画以减少主线程占用和布局抖动
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
      'mt-3 pl-3 border-l border-border/60 space-y-1',
      config.previewStyles?.border,
      config.previewStyles?.background
    ),
    title: 'text-xs font-semibold text-muted-foreground',
    content: 'mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90'
  }

  return (
    <div className="space-y-4 rounded-none border-0 bg-transparent p-0">
      {/* 头部：标题和进度百分比 */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <p>{config.title}</p>
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', statusTone)}>
            {config.statusText[progress.status]}
          </span>
        </div>
        {!isCompleted && (
          <div className="text-xs font-medium text-muted-foreground">
            进度 {Math.min(100, Math.round(progress.percentage))}%
          </div>
        )}
      </div>

      {/* 步骤列表 - 只在处理中或失败时显示 */}
      {!isCompleted && (
        <ol className="mt-3 space-y-2">
          {progress.steps.map((step, idx) => {
            const copy = stepCopy[step.key] ?? { label: step.key, description: '' }
            const label = step.labelOverride ?? copy.label
            const description = step.descriptionOverride ?? copy.description

            return (
              <li
                key={step.key}
                className={cn(
                  'flex items-start gap-3 rounded-md px-2 py-1.5 transition-colors duration-150',
                  step.status === 'active' && config.activeStepColor.background,
                  step.status === 'completed' && 'text-muted-foreground',
                  step.status === 'error' && 'border-l-2 border-red-400/50 bg-red-500/5 text-red-700 dark:text-red-200'
                )}
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
                    <p className="mt-1 text-xs text-foreground">
                      {step.detail}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {/* 视频信息slot - 只在处理中显示 */}
      {!isCompleted && videoInfoSlot && (
        <div>
          {videoInfoSlot}
        </div>
      )}

      {/* 实时预览slot - 只在处理中显示 */}
      {!isCompleted && previewSlot && (
        <div>
          {previewSlot(previewTokens)}
        </div>
      )}

      {/* 错误信息 */}
      {isFailed && progress.error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-red-300/40 bg-red-500/10 p-3 text-xs text-red-600 dark:border-red-500/30 dark:text-red-200"
        >
          {progress.error}
        </div>
      )}
    </div>
  )
})

PipelineProgressSkeleton.displayName = 'PipelineProgressSkeleton'
