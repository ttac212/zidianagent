"use client"

import { memo } from 'react'
import type { DouyinCommentsProgressState } from '@/types/chat'
import { PipelineProgressSkeleton, type PreviewSlotStyles } from './pipeline-progress-skeleton'
import { PIPELINE_CONFIGS } from './pipeline-progress-config'
import { DOUYIN_COMMENTS_PIPELINE_STEPS } from '@/lib/douyin/comments-pipeline-steps'

interface DouyinCommentsProgressProps {
  progress: DouyinCommentsProgressState
}

const STEP_COPY = Object.fromEntries(
  DOUYIN_COMMENTS_PIPELINE_STEPS.map(step => [
    step.key,
    { label: step.label, description: step.description }
  ])
) as Record<string, { label: string; description: string }>

/**
 * 抖音评论分析进度组件 - 使用骨架 + 平台专用slot
 */
export const DouyinCommentsProgress = memo(({ progress }: DouyinCommentsProgressProps) => {
  const config = PIPELINE_CONFIGS.comments

  // 视频信息slot（带统计数据）
  const videoInfoSlot = progress.videoInfo ? (
    <div className="mt-4 rounded-md border border-dashed border-muted-foreground/30 bg-background/60 p-3">
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
    </div>
  ) : null

  // AI分析实时预览slot
  const previewSlot = progress.analysisPreview
    ? (styles: PreviewSlotStyles) => (
        <div className={styles.container}>
          <p className={styles.title}>AI 分析（实时）</p>
          <div className={styles.content}>
            {progress.analysisPreview}
          </div>
        </div>
      )
    : undefined

  return (
    <PipelineProgressSkeleton
      config={config}
      stepCopy={STEP_COPY}
      progress={progress}
      videoInfoSlot={videoInfoSlot}
      previewSlot={previewSlot}
    />
  )
})

DouyinCommentsProgress.displayName = 'DouyinCommentsProgress'
