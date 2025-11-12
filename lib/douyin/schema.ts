/**
 * 抖音Pipeline统一契约定义
 *
 * 这是所有Pipeline事件的单一数据源，确保：
 * 1. 前端Hook知道哪些key需要发送到结果消息
 * 2. 类型系统知道所有合法的key
 * 3. 后端代码发射的事件符合类型定义
 *
 * "Good programmers worry about data structures and their relationships."
 *                                                    -- Linus Torvalds
 */

/**
 * 所有Pipeline共享的Partial事件key
 *
 * 新增key时只需在这里添加，其他文件自动同步
 */
export const PIPELINE_PARTIAL_KEYS = [
  'transcript',   // 转录文本（视频Pipeline）
  'markdown',     // 最终Markdown（视频Pipeline）
  'analysis',     // 分析结果（评论Pipeline）
  'optimized',    // AI优化后文本（视频Pipeline）
  'warn'          // 警告信息（通用）
] as const

/**
 * Pipeline Partial事件key的联合类型
 * 自动从PIPELINE_PARTIAL_KEYS推导
 */
export type PipelinePartialKey = typeof PIPELINE_PARTIAL_KEYS[number]

/**
 * Pipeline事件前缀定义
 * 用于SSE事件命名空间
 */
export const PIPELINE_EVENT_PREFIXES = {
  VIDEO: 'douyin',
  COMMENTS: 'comments'
} as const

export type PipelineEventPrefix = typeof PIPELINE_EVENT_PREFIXES[keyof typeof PIPELINE_EVENT_PREFIXES]

/**
 * 结果消息应该接收的key集合
 * 排除中间状态（如transcript），只保留最终输出
 */
export const RESULT_MESSAGE_KEYS = PIPELINE_PARTIAL_KEYS.filter(
  k => k !== 'transcript'
) as PipelinePartialKey[]

/**
 * 类型守卫：检查是否为合法的Pipeline Partial key
 */
export function isPipelinePartialKey(key: string): key is PipelinePartialKey {
  return PIPELINE_PARTIAL_KEYS.includes(key as PipelinePartialKey)
}

/**
 * 类型守卫：检查是否为结果消息key
 */
export function isResultMessageKey(key: PipelinePartialKey): boolean {
  return RESULT_MESSAGE_KEYS.includes(key)
}
