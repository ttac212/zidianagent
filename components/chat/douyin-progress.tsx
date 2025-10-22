"use client"

import { memo } from 'react'
import type { DouyinProgressState } from '@/types/chat'
import { PipelineProgressSkeleton, type PreviewSlotStyles } from './pipeline-progress-skeleton'
import { PIPELINE_CONFIGS } from './pipeline-progress-config'
import { DOUYIN_PIPELINE_STEPS } from '@/lib/douyin/pipeline-steps'
import { cn } from '@/lib/utils'

interface DouyinProgressProps {
  progress: DouyinProgressState
}

const STEP_COPY = Object.fromEntries(
  DOUYIN_PIPELINE_STEPS.map(step => [
    step.key,
    { label: step.label, description: step.description }
  ])
) as Record<string, { label: string; description: string }>

/**
 * 抖音视频处理进度组件 - 使用骨架 + 平台专用slot
 */
export const DouyinProgress = memo(({ progress }: DouyinProgressProps) => {
  const config = PIPELINE_CONFIGS.video

  // 视频信息slot
  const videoInfoSlot = progress.videoInfo ? (
    <div className="mt-4 rounded-md border border-dashed border-muted-foreground/30 bg-background/60 p-3">
      <p className="text-xs font-semibold text-muted-foreground">视频信息</p>
      <p className="mt-1 text-sm font-medium text-foreground">{progress.videoInfo.title}</p>
      <p className="text-xs text-muted-foreground">作者 {progress.videoInfo.author}</p>
      <p className="text-xs text-muted-foreground">
        时长 {progress.videoInfo.duration ? `${progress.videoInfo.duration.toFixed(1)} 秒` : '未知'}
      </p>
    </div>
  ) : null

  // 实时预览slot（转录文本或Markdown）
  const previewSlot = progress.transcript || progress.markdownPreview
    ? (styles: PreviewSlotStyles) => {
        const sections = []

        if (progress.transcript) {
          sections.push(
            <div
              key="transcript"
              className={cn(styles.container, 'border-blue-300/40 bg-blue-500/5')}
            >
              <p className={styles.title}>转录文本（实时）</p>
              <div className={styles.content}>
                {progress.transcript}
              </div>
            </div>
          )
        }

        if (progress.markdownPreview) {
          sections.push(
            <div
              key="markdown-preview"
              className={cn(styles.container, 'border-muted-foreground/20 bg-background/60')}
            >
              <p className={styles.title}>实时生成中</p>
              <div className={styles.content}>
                {progress.markdownPreview}
              </div>
            </div>
          )
        }

        return <>{sections}</>
      }
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

DouyinProgress.displayName = 'DouyinProgress'
