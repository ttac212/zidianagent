"use client"

import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { DouyinCommentsProgressState } from '@/types/chat'

interface DouyinCommentsProgressProps {
  progress: DouyinCommentsProgressState
}

const statusTextMap: Record<DouyinCommentsProgressState['status'], string> = {
  running: '分析中',
  completed: '已完成',
  failed: '已失败'
}

const statusBadgeStyles: Record<DouyinCommentsProgressState['status'], string> = {
  running: 'bg-purple-100 text-purple-800 dark:bg-purple-500/10 dark:text-purple-200',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-200'
}

function StepBadge({
  index,
  status
}: {
  index: number
  status: DouyinCommentsProgressState['steps'][number]['status']
}) {
  const base = 'flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold'

  const tone = {
    pending: 'border-muted text-muted-foreground',
    active: 'border-purple-500 text-purple-600 dark:border-purple-400 dark:text-purple-300',
    completed: 'border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-300',
    error: 'border-red-500 text-red-600 dark:border-red-400 dark:text-red-300'
  }[status]

  return (
    <motion.span
      layout
      className={cn(base, tone)}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {index + 1}
    </motion.span>
  )
}

export const DouyinCommentsProgress = memo(({ progress }: DouyinCommentsProgressProps) => {
  const statusTone = statusBadgeStyles[progress.status]
  const isCompleted = progress.status === 'completed'
  const isFailed = progress.status === 'failed'

  return (
    <motion.div
      layout
      className="rounded-lg border border-border bg-muted/40 p-4 shadow-sm"
      transition={{ type: 'spring', stiffness: 240, damping: 28 }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">抖音评论分析</p>
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', statusTone)}>
            {statusTextMap[progress.status]}
          </span>
        </div>
        {!isCompleted && (
          <div className="text-sm font-medium text-muted-foreground">
            进度 {Math.min(100, Math.round(progress.percentage))}%
          </div>
        )}
      </div>

      {/* 只在处理中或失败时显示详细步骤 */}
      {!isCompleted && (
        <ol className="mt-4 space-y-3">
          <AnimatePresence initial={false}>
            {progress.steps.map((step, idx) => (
              <motion.li
                layout
                key={step.key}
                className={cn(
                  'flex items-start gap-3 rounded-md border border-transparent px-3 py-2 transition-colors',
                  step.status === 'active' && 'border-purple-400/40 bg-purple-500/5',
                  step.status === 'completed' && 'bg-emerald-500/5',
                  step.status === 'error' && 'border-red-400/40 bg-red-500/10'
                )}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <StepBadge index={idx} status={step.status} />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{step.label}</p>
                    <span className="text-xs text-muted-foreground">
                      {
                        {
                          pending: '等待中',
                          active: '进行中',
                          completed: '已完成',
                          error: '失败'
                        }[step.status]
                      }
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
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
            ))}
          </AnimatePresence>
        </ol>
      )}

      {/* 只在处理中显示视频信息（完成后正文已有） */}
      <AnimatePresence>
        {!isCompleted && progress.videoInfo && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-4 rounded-md border border-dashed border-muted-foreground/30 bg-background/60 p-3"
          >
            <p className="text-xs font-semibold text-muted-foreground">视频信息</p>
            <p className="mt-1 text-sm font-medium text-foreground">{progress.videoInfo.title}</p>
            <p className="text-xs text-muted-foreground">作者: {progress.videoInfo.author}</p>
            {progress.statistics && (
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">播放量:</span>
                  <span className="ml-1 font-medium text-foreground">
                    {progress.statistics.play_count?.toLocaleString('zh-CN') || 0}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">点赞:</span>
                  <span className="ml-1 font-medium text-foreground">
                    {progress.statistics.digg_count?.toLocaleString('zh-CN') || 0}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">评论:</span>
                  <span className="ml-1 font-medium text-foreground">
                    {progress.statistics.comment_count?.toLocaleString('zh-CN') || 0}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI分析实时预览 */}
      <AnimatePresence>
        {!isCompleted && progress.analysisPreview && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-4 rounded-md border border-purple-300/40 bg-purple-500/5 p-3"
          >
            <p className="text-xs font-semibold text-muted-foreground">AI 分析（实时）</p>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {progress.analysisPreview}
            </div>
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

DouyinCommentsProgress.displayName = 'DouyinCommentsProgress'
