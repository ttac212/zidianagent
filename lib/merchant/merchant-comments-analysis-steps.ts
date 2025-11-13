/**
 * 商家评论分析 Pipeline 步骤定义
 * 简化版：移除了链接解析和视频详情获取步骤（从数据库直接读）
 */

export type MerchantCommentAnalysisStep =
  | 'load-video'         // 加载视频信息（从数据库）
  | 'fetch-comments'     // 加载评论数据（数据库/TikHub自动切换）
  | 'clean-comments'     // 清理评论（过滤无效评论）
  | 'analyze-comments'   // LLM 分析
  | 'save-result'        // 保存结果到数据库

export type MerchantCommentAnalysisStepStatus = 'pending' | 'active' | 'completed' | 'error'

export interface MerchantCommentAnalysisStepInfo {
  key: MerchantCommentAnalysisStep
  label: string
  description: string
}

export const MERCHANT_COMMENT_ANALYSIS_STEPS: MerchantCommentAnalysisStepInfo[] = [
  {
    key: 'load-video',
    label: '加载视频信息',
    description: '正在从数据库加载视频信息'
  },
  {
    key: 'fetch-comments',
    label: '加载评论数据',
    description: '正在加载评论数据（优先数据库，必要时TikHub抓取）'
  },
  {
    key: 'clean-comments',
    label: '清理评论',
    description: '正在清理评论文本，过滤无效内容'
  },
  {
    key: 'analyze-comments',
    label: 'AI 智能分析',
    description: '正在使用 AI 分析评论数据'
  },
  {
    key: 'save-result',
    label: '保存分析结果',
    description: '正在保存分析结果到数据库'
  }
]

// 视频信息
export interface MerchantVideoInfo {
  videoId: string
  contentId: string
  title: string
  author: string
  duration?: number
  coverUrl?: string
}

// 统计数据
export interface MerchantVideoStatistics {
  play_count: number
  digg_count: number
  comment_count: number
  share_count: number
  collect_count: number
}

// 进度事件
export interface MerchantCommentAnalysisProgress {
  step: MerchantCommentAnalysisStep
  status: MerchantCommentAnalysisStepStatus
  index: number
  total: number
  percentage: number
  detail?: string
  label: string
  description: string
}

// 评论数据（已清理）
export interface CleanedComment {
  user: string
  text: string
  likes: number
  location: string
}

// 地域统计
export interface LocationStat {
  location: string
  count: number
}

// 分析数据（传给 LLM 的输入）
export interface MerchantCommentAnalysisData {
  video: {
    title: string
    author: string
  }
  statistics: MerchantVideoStatistics
  comments: CleanedComment[]
  locationStats: LocationStat[]
}
