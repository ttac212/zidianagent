/**
 * 抖音处理流水线的步骤定义
 * 纯数据模块，可在服务端和客户端之间共享
 */

export type DouyinPipelineStep =
  | 'parse-link'
  | 'fetch-detail'
  | 'download-video'
  | 'extract-audio'
  | 'transcribe-audio'
  | 'optimize'
  | 'summarize'

export interface DouyinPipelineStepDefinition {
  key: DouyinPipelineStep
  label: string
  description: string
}

export type DouyinPipelineStepStatus = 'active' | 'completed'

export interface DouyinPipelineProgress {
  step: DouyinPipelineStep
  status: DouyinPipelineStepStatus
  index: number
  total: number
  percentage: number
  label: string
  description: string
  detail?: string
}

export interface DouyinVideoInfo {
  title: string
  author: string
  duration: number
  videoId: string
  coverUrl?: string
}

export const DOUYIN_PIPELINE_STEPS: DouyinPipelineStepDefinition[] = [
  {
    key: 'parse-link',
    label: '解析链接',
    description: '识别并还原抖音短链，提取作品ID'
  },
  {
    key: 'fetch-detail',
    label: '获取详情',
    description: '调用 TikHub 获取视频元数据'
  },
  {
    key: 'download-video',
    label: '下载视频',
    description: '根据播放地址下载原始视频'
  },
  {
    key: 'extract-audio',
    label: '提取音频',
    description: '使用 FFmpeg 从视频中分离音频轨'
  },
  {
    key: 'transcribe-audio',
    label: '转录',
    description: '调用语音识别服务生成文稿'
  },
  {
    key: 'optimize',
    label: '优化',
    description: '对转录文本进行清理、断句等整理'
  },
  {
    key: 'summarize',
    label: '汇总',
    description: '生成最终的 Markdown 回复'
  }
]
