/**
 * 抖音功能Token配额估算
 *
 * 重要：这些是保守的上限估算值，用于配额预留。
 * 设计原则：宁可多预留后返还，也不要低估导致超额不计费。
 *
 * 实际使用量通常远少于预估，差额会在流程完成时返还。
 * 如果实际使用超出预估且追加失败，用户至少按预估值计费。
 */

import { DOUYIN_PIPELINE_LIMITS } from '@/lib/douyin/constants'

/**
 * 根据视频时长动态计算预估 tokens
 *
 * 估算依据：
 * - 语速：平均 180 字/分钟（快语速可达 250 字/分钟）
 * - Token 换算：1 中文字 ≈ 2 tokens
 * - 安全系数：2x（覆盖 markdown 格式、元数据、提示词等）
 *
 * @param durationSeconds 视频时长（秒），如果未知传 0 使用默认值
 */
export function estimateVideoExtractionTokens(durationSeconds: number = 0): number {
  // 如果时长未知或无效，使用最大时长作为保守估计
  const effectiveDuration = durationSeconds > 0
    ? Math.min(durationSeconds, DOUYIN_PIPELINE_LIMITS.MAX_VIDEO_DURATION_SECONDS)
    : DOUYIN_PIPELINE_LIMITS.MAX_VIDEO_DURATION_SECONDS

  // 快语速 250 字/分钟 = 4.17 字/秒
  const maxWordsPerSecond = 4.2
  const estimatedWords = Math.ceil(effectiveDuration * maxWordsPerSecond)

  // 1 中文字 ≈ 2 tokens
  const baseTokens = estimatedWords * 2

  // 安全系数 2x（覆盖 markdown、元数据、提示词等）
  const safetyMultiplier = 2

  // 最低保底 5000 tokens
  const minTokens = 5000

  return Math.max(minTokens, Math.ceil(baseTokens * safetyMultiplier))
}

export const DOUYIN_ESTIMATED_TOKENS = {
  /**
   * 视频文案提取（最大时长场景）
   *
   * 计算依据（120秒视频）：
   * - 快语速转录：120s × 4.2字/s × 2tokens/字 = 1008 tokens
   * - 安全系数 2x = 2016 tokens
   * - 提示词 + markdown 格式 ≈ 3000 tokens
   * - 总计向上取整到 15000 tokens（覆盖极端情况）
   *
   * 注意：实际使用量通常 3000-5000 tokens，差额会返还
   */
  VIDEO_EXTRACTION: 15000,

  /**
   * 评论分析
   * - TikHub API获取评论列表
   * - Claude分析评论（输入 ~5000 tokens，输出 ~3000 tokens）
   * - 保守估计 10000 tokens
   */
  COMMENTS_ANALYSIS: 10000
} as const

/**
 * Token 估算配置
 * 可通过环境变量调整安全系数
 */
function readNumberEnv(keys: string[], fallback: number): number {
  for (const key of keys) {
    const value = process.env[key]
    if (value) {
      const parsed = parseFloat(value)
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed
      }
    }
  }
  return fallback
}

export const TOKEN_ESTIMATE_CONFIG = {
  /** 中文字符的 token 系数（默认 2） */
  CHINESE_CHAR_RATIO: readNumberEnv(['DOUYIN_TOKEN_CN_RATIO', 'TOKEN_CHINESE_RATIO'], 2),
  /** 英文单词的 token 系数（默认 1.5，比原来的 1.3 更保守） */
  ENGLISH_WORD_RATIO: readNumberEnv(['DOUYIN_TOKEN_EN_RATIO', 'TOKEN_ENGLISH_RATIO'], 1.5),
  /** 全局安全系数（默认 1.2，额外增加 20% 余量） */
  SAFETY_MULTIPLIER: readNumberEnv(['DOUYIN_TOKEN_SAFETY_MULTIPLIER', 'TOKEN_SAFETY_MULTIPLIER'], 1.2),
  /** 最小 token 数（避免过小的估算） */
  MIN_TOKENS: 100,
  /** 基于字符数的上限护栏系数（每字符最多 4 tokens，覆盖极端情况） */
  MAX_TOKENS_PER_CHAR: readNumberEnv(['DOUYIN_TOKEN_CHAR_CAP', 'TOKEN_CHAR_CAP'], 4)
} as const

/**
 * 根据内容长度估算实际token使用量
 *
 * 改进点（2025年重构）：
 * - 提高英文单词系数（1.3 → 1.5），更保守
 * - 增加全局安全系数（1.2x）
 * - 增加上限护栏（字符数 × 4），防止低估
 * - 支持可配置系数
 *
 * @param content 内容文本
 * @returns 估算的token数量
 */
export function estimateTokensFromContent(content: string): number {
  if (!content) return 0

  const totalChars = content.length

  // 统计中文字符（包括中文标点）
  const chineseChars = (content.match(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g) || []).length

  // 统计英文单词（改进：考虑连字符、撇号等）
  const nonChineseText = content.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g, ' ')
  const englishWords = nonChineseText
    .split(/[\s,;:!?()[\]{}]+/)
    .filter(w => w.length > 0 && /[a-zA-Z]/.test(w))
    .length

  // 统计数字和特殊字符（每个约 1 token）
  const otherChars = totalChars - chineseChars - nonChineseText.replace(/\s/g, '').length

  // 基础估算
  const baseEstimate = Math.ceil(
    chineseChars * TOKEN_ESTIMATE_CONFIG.CHINESE_CHAR_RATIO +
    englishWords * TOKEN_ESTIMATE_CONFIG.ENGLISH_WORD_RATIO +
    Math.max(0, otherChars) * 1
  )

  // 应用安全系数
  const withSafety = Math.ceil(baseEstimate * TOKEN_ESTIMATE_CONFIG.SAFETY_MULTIPLIER)

  // 上限护栏：基于总字符数，确保不会严重低估
  const upperBound = Math.ceil(totalChars * TOKEN_ESTIMATE_CONFIG.MAX_TOKENS_PER_CHAR)

  // 取两者的较小值（护栏只防止低估，不人为提高估算）
  // 但确保不低于最小值
  return Math.max(
    TOKEN_ESTIMATE_CONFIG.MIN_TOKENS,
    Math.min(withSafety, upperBound)
  )
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
