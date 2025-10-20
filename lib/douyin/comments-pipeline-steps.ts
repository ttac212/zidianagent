/**
 * 抖音评论分析 Pipeline 步骤定义
 * 定义评论分析流程的各个阶段
 */

export type DouyinCommentsPipelineStep =
  | 'parse-link'        // 解析链接
  | 'fetch-detail'      // 获取视频详情
  | 'fetch-statistics'  // 获取播放数据
  | 'fetch-comments'    // 采集评论
  | 'clean-comments'    // 清理评论
  | 'analyze-comments'  // LLM分析

export type DouyinCommentsPipelineStepStatus = 'pending' | 'active' | 'completed' | 'error'

export interface DouyinCommentsPipelineStepInfo {
  key: DouyinCommentsPipelineStep
  label: string
  description: string
}

export const DOUYIN_COMMENTS_PIPELINE_STEPS: DouyinCommentsPipelineStepInfo[] = [
  {
    key: 'parse-link',
    label: '解析链接',
    description: '正在解析抖音分享链接'
  },
  {
    key: 'fetch-detail',
    label: '获取视频信息',
    description: '正在获取视频详情'
  },
  {
    key: 'fetch-statistics',
    label: '获取播放数据',
    description: '正在获取播放量、点赞数等统计数据'
  },
  {
    key: 'fetch-comments',
    label: '采集评论',
    description: '正在采集评论数据（多页自动分页）'
  },
  {
    key: 'clean-comments',
    label: '清理评论',
    description: '正在清理评论文本、统计地域分布'
  },
  {
    key: 'analyze-comments',
    label: 'AI 智能分析',
    description: '正在使用 AI 分析评论数据'
  }
]

export interface DouyinCommentsVideoInfo {
  videoId: string
  title: string
  author: string
  duration: number
  coverUrl?: string
}

export interface DouyinCommentsStatistics {
  play_count: number
  digg_count: number
  comment_count: number
  share_count: number
  collect_count: number
  download_count: number
}

export interface DouyinCommentsProgress {
  step: DouyinCommentsPipelineStep
  status: DouyinCommentsPipelineStepStatus
  index: number
  total: number
  percentage: number
  detail?: string
  label: string
  description: string
}

export interface CleanedComment {
  user: string
  text: string
  likes: number
  location: string
}

export interface LocationStat {
  location: string
  count: number
}

export interface DouyinCommentsAnalysisData {
  video: {
    title: string
    author: string
  }
  statistics: DouyinCommentsStatistics
  comments: CleanedComment[]
  locationStats: LocationStat[]
}
