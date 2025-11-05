/**
 * 抖音功能Token配额估算
 *
 * 这些是保守估算值，用于配额预留。
 * 实际使用量可能更少，差额会在commitTokens时返还。
 */

export const DOUYIN_ESTIMATED_TOKENS = {
  /**
   * 视频文案提取
   * - TikHub API获取视频信息
   * - GPT-4o Audio转录（~2000 tokens）
   * - Claude优化文案（~3000 tokens）
   */
  VIDEO_EXTRACTION: 5000,

  /**
   * 评论分析
   * - TikHub API获取评论列表
   * - Claude分析评论（~3000 tokens）
   */
  COMMENTS_ANALYSIS: 3000
} as const

/**
 * 根据内容长度估算实际token使用量
 * 粗略估算：1个中文字符 ≈ 2 tokens，1个英文单词 ≈ 1.3 tokens
 *
 * @param content 内容文本
 * @returns 估算的token数量
 */
export function estimateTokensFromContent(content: string): number {
  if (!content) return 0

  // 统计中文字符（包括标点）
  const chineseChars = (content.match(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g) || []).length
  // 统计英文单词（简单按空格分割）
  const englishWords = content.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g, '').split(/\s+/).filter(w => w.length > 0).length

  // 保守估算
  const estimatedTokens = Math.ceil(chineseChars * 2 + englishWords * 1.3)

  return estimatedTokens
}

/**
 * 计算抖音功能的实际token消耗
 * promptTokens = 输入内容估算
 * completionTokens = 输出内容估算
 *
 * @param inputContent 输入内容（视频URL、评论等）
 * @param outputContent 输出内容（生成的Markdown）
 * @returns token使用详情
 */
export function calculateDouyinTokens(
  inputContent: string,
  outputContent: string
): { promptTokens: number; completionTokens: number } {
  return {
    promptTokens: estimateTokensFromContent(inputContent),
    completionTokens: estimateTokensFromContent(outputContent)
  }
}
