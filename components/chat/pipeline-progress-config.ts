/**
 * Pipeline进度组件配置 - 平台特定的文案和样式
 * 遵循最小抽象原则，只提取真正重复的配置
 */

export type PipelineType = 'video' | 'comments'

export interface PipelineProgressConfig {
  /** 进度卡片标题 */
  title: string
  /** 状态文案映射 */
  statusText: {
    running: string
    completed: string
    failed: string
  }
  /** 状态badge颜色样式 */
  statusBadgeStyles: {
    running: string
    completed: string
    failed: string
  }
  /** 激活步骤的主题色 */
  activeStepColor: {
    badge: string
    background: string
  }
  /** 实时预览区域样式（可选） */
  previewStyles?: {
    border: string
    background?: string
  }
}

export const PIPELINE_CONFIGS: Record<PipelineType, PipelineProgressConfig> = {
  video: {
    title: '抖音视频处理',
    statusText: {
      running: '处理中',
      completed: '已完成',
      failed: '已失败'
    },
    statusBadgeStyles: {
      running: 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200',
      completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-200'
    },
    activeStepColor: {
      badge: 'bg-primary/10 text-primary ring-primary/40 dark:bg-primary/10',
      background: 'border-l-2 border-primary/60 bg-primary/5'
    },
    previewStyles: {
      border: 'border-l-2 border-blue-300/70'
    }
  },
  comments: {
    title: '抖音评论分析',
    statusText: {
      running: '分析中',
      completed: '已完成',
      failed: '已失败'
    },
    statusBadgeStyles: {
      running: 'bg-purple-100 text-purple-800 dark:bg-purple-500/10 dark:text-purple-200',
      completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-200'
    },
    activeStepColor: {
      badge: 'bg-purple-500/10 text-purple-700 ring-purple-300/60 dark:text-purple-200 dark:ring-purple-400/50',
      background: 'border-l-2 border-purple-400/60 bg-purple-500/5'
    },
    previewStyles: {
      border: 'border-l-2 border-purple-300/70'
    }
  }
}

/** 步骤状态文案 */
export const STEP_STATUS_TEXT = {
  pending: '等待中',
  active: '进行中',
  completed: '已完成',
  error: '失败'
} as const
