/**
 * 抖音处理策略表
 *
 * 设计原则（Linus风格）：
 * - 数据驱动替代if/else堆叠
 * - 消除特殊情况，统一处理流程
 * - 新增功能只需添加一行配置
 *
 * 使用方法：
 * ```typescript
 * const strategy = selectDouyinStrategy(userMessage)
 * if (strategy) {
 *   return handleDouyinPipeline({ ...strategy.config })
 * }
 * ```
 */

import { runDouyinPipeline } from '@/lib/douyin/pipeline'
import { runDouyinCommentsPipeline } from '@/lib/douyin/comments-pipeline'
import {
  isDouyinVideoExtractionRequest,
  isDouyinCommentsAnalysisRequest,
  isDouyinShareRequest
} from '@/lib/douyin/link-detector'
import { DOUYIN_ESTIMATED_TOKENS } from '@/lib/constants/douyin-quota'

/**
 * Pipeline函数类型
 */
export type DouyinPipelineFunction = typeof runDouyinPipeline | typeof runDouyinCommentsPipeline

/**
 * 策略配置接口
 */
export interface DouyinStrategy {
  /** 策略名称（用于日志） */
  name: string

  /** 检测函数：判断用户消息是否匹配此策略 */
  detect: (content: string) => boolean

  /** Pipeline处理函数 */
  pipeline: DouyinPipelineFunction

  /** SSE事件前缀 */
  eventPrefix: string

  /** Token配额估算 */
  getEstimatedTokens: () => number

  /** 优先级（数字越小优先级越高，用于解决冲突） */
  priority: number
}

/**
 * 抖音处理策略列表
 *
 * 重要：
 * - 策略按优先级排序（priority从小到大）
 * - 匹配第一个通过detect()的策略
 * - 新增功能时，在此数组添加新策略即可
 */
export const DOUYIN_STRATEGIES: DouyinStrategy[] = [
  // 策略1: 视频文案提取（高优先级，需要明确关键词）
  {
    name: 'VIDEO_EXTRACTION',
    detect: isDouyinVideoExtractionRequest,
    pipeline: runDouyinPipeline,
    eventPrefix: 'douyin',
    getEstimatedTokens: () => DOUYIN_ESTIMATED_TOKENS.VIDEO_EXTRACTION,
    priority: 1
  },

  // 策略2: 明确的评论分析请求（高优先级，用户明确说了"评论"）
  {
    name: 'COMMENTS_ANALYSIS_EXPLICIT',
    detect: isDouyinCommentsAnalysisRequest,
    pipeline: runDouyinCommentsPipeline,
    eventPrefix: 'comments',
    getEstimatedTokens: () => DOUYIN_ESTIMATED_TOKENS.COMMENTS_ANALYSIS,
    priority: 2
  },

  // 策略3: 默认评论分析（兜底策略，纯分享链接）
  {
    name: 'COMMENTS_ANALYSIS_DEFAULT',
    detect: isDouyinShareRequest,
    pipeline: runDouyinCommentsPipeline,
    eventPrefix: 'comments',
    getEstimatedTokens: () => DOUYIN_ESTIMATED_TOKENS.COMMENTS_ANALYSIS,
    priority: 3
  }

  // 未来扩展示例：
  // {
  //   name: 'ACCOUNT_ANALYSIS',
  //   detect: (content) => /账号|主页|博主/.test(content),
  //   pipeline: runDouyinAccountPipeline,
  //   eventPrefix: 'account',
  //   getEstimatedTokens: () => DOUYIN_ESTIMATED_TOKENS.ACCOUNT_ANALYSIS,
  //   priority: 4
  // }
]

/**
 * 选择匹配的抖音处理策略
 *
 * @param content - 用户消息内容
 * @returns 匹配的策略，如果没有匹配则返回null
 */
export function selectDouyinStrategy(content: string): DouyinStrategy | null {
  // 按优先级遍历，返回第一个匹配的策略
  for (const strategy of DOUYIN_STRATEGIES) {
    if (strategy.detect(content)) {
      console.info(`[Douyin Strategy] 选中策略: ${strategy.name}`)
      return strategy
    }
  }

  console.info('[Douyin Strategy] 无匹配策略')
  return null
}

/**
 * 获取所有可用策略的名称（用于调试和文档）
 */
export function getAvailableStrategies(): string[] {
  return DOUYIN_STRATEGIES.map(s => s.name)
}

/**
 * 验证策略配置的完整性（开发时检查）
 */
if (process.env.NODE_ENV === 'development') {
  // 检查优先级是否有重复
  const priorities = DOUYIN_STRATEGIES.map(s => s.priority)
  const uniquePriorities = new Set(priorities)

  if (priorities.length !== uniquePriorities.size) {
    console.warn(
      '[Douyin Strategy] 警告: 存在优先级重复的策略，可能导致不可预测的行为。\n' +
      `优先级列表: ${priorities.join(', ')}`
    )
  }

  // 检查策略是否按优先级排序
  for (let i = 1; i < DOUYIN_STRATEGIES.length; i++) {
    if (DOUYIN_STRATEGIES[i].priority < DOUYIN_STRATEGIES[i - 1].priority) {
      console.warn(
        '[Douyin Strategy] 警告: 策略列表未按优先级排序，可能影响匹配顺序。\n' +
        `建议按priority从小到大排列。`
      )
      break
    }
  }
}
