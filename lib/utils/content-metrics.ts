/**
 * 内容指标计算工具
 *
 * 提供内容互动率计算、质量权重评分、爆款识别等功能
 */

export interface ContentMetrics {
  likeRate: number | null      // 点赞率（%）
  commentRate: number | null   // 评论率（%）
  shareRate: number | null     // 分享率（%）
  collectRate: number | null   // 收藏率（%）
}

/**
 * 计算内容互动率指标
 *
 * @param content 内容基础数据（播放量、点赞数等）
 * @returns 各项互动率指标（百分比）
 */
export function calculateContentMetrics(content: {
  playCount: number
  diggCount: number
  commentCount: number
  shareCount: number
  collectCount: number
}): ContentMetrics {
  const { playCount, diggCount, commentCount, shareCount, collectCount } = content

  // 防止除零错误
  if (playCount === 0) {
    return {
      likeRate: null,
      commentRate: null,
      shareRate: null,
      collectRate: null
    }
  }

  return {
    likeRate: (diggCount / playCount) * 100,
    commentRate: (commentCount / playCount) * 100,
    shareRate: (shareCount / playCount) * 100,
    collectRate: (collectCount / playCount) * 100
  }
}

/**
 * 质量权重评分（基于真实互动价值）
 *
 * 权重设计理念：
 * - 评论率 x2：用户愿意停下来打字，说明内容有共鸣
 * - 分享率 x2.5：用户愿意给朋友看，说明内容有价值
 * - 点赞率 x0.5：刷量风险高，降权处理
 *
 * @param metrics 互动率指标
 * @returns 各项权重评分和总分
 */
export function calculateQualityWeight(metrics: ContentMetrics): {
  commentWeight: number
  shareWeight: number
  likeWeight: number
  totalScore: number
} {
  const { likeRate, commentRate, shareRate } = metrics

  // 如果没有数据，返回0分
  if (likeRate === null || commentRate === null || shareRate === null) {
    return {
      commentWeight: 0,
      shareWeight: 0,
      likeWeight: 0,
      totalScore: 0
    }
  }

  const commentWeight = commentRate * 2
  const shareWeight = shareRate * 2.5
  const likeWeight = likeRate * 0.5

  return {
    commentWeight,
    shareWeight,
    likeWeight,
    totalScore: commentWeight + shareWeight + likeWeight
  }
}

/**
 * 计算商家内容基准线（中位数）
 *
 * 用于识别相对于商家自身水平的爆款内容
 *
 * @param contents 商家的内容列表
 * @returns 各项指标的中位数
 */
export function calculateMerchantBaseline(
  contents: Array<{ likeRate: number | null; commentRate: number | null; shareRate: number | null }>
): {
  medianLikeRate: number
  medianCommentRate: number
  medianShareRate: number
} {
  const validLikeRates = contents.map(c => c.likeRate).filter((r): r is number => r !== null)
  const validCommentRates = contents.map(c => c.commentRate).filter((r): r is number => r !== null)
  const validShareRates = contents.map(c => c.shareRate).filter((r): r is number => r !== null)

  return {
    medianLikeRate: median(validLikeRates),
    medianCommentRate: median(validCommentRates),
    medianShareRate: median(validShareRates)
  }
}

/**
 * 识别爆款内容（超过商家自身基准）
 *
 * 爆款定义：至少2个指标超过商家基准的2倍
 *
 * @param content 单条内容的互动率
 * @param baseline 商家基准线
 * @returns 是否为爆款
 */
export function isViralContent(
  content: { likeRate: number | null; commentRate: number | null; shareRate: number | null },
  baseline: { medianLikeRate: number; medianCommentRate: number; medianShareRate: number }
): boolean {
  if (!content.likeRate || !content.commentRate || !content.shareRate) {
    return false
  }

  // 爆款定义：至少2个指标超过基准的2倍
  let aboveThreshold = 0

  if (content.likeRate > baseline.medianLikeRate * 2) aboveThreshold++
  if (content.commentRate > baseline.medianCommentRate * 2) aboveThreshold++
  if (content.shareRate > baseline.medianShareRate * 2) aboveThreshold++

  return aboveThreshold >= 2
}

/**
 * 判断内容质量等级
 *
 * 基于评论率和分享率的综合判断
 *
 * @param metrics 互动率指标
 * @returns 质量等级和描述
 */
export function getQualityLevel(metrics: ContentMetrics): {
  level: 'high' | 'medium' | 'low' | 'unknown'
  label: string
  description: string
} {
  const { commentRate, shareRate } = metrics

  if (commentRate === null || shareRate === null) {
    return {
      level: 'unknown',
      label: '数据不足',
      description: '播放量为0或数据缺失'
    }
  }

  // 高质量：评论率≥0.5% + 分享率≥0.3%
  if (commentRate >= 0.5 && shareRate >= 0.3) {
    return {
      level: 'high',
      label: '✅ 高质量',
      description: '评论和分享活跃，真实互动强'
    }
  }

  // 中等质量：评论率≥0.3% 或 分享率≥0.2%
  if (commentRate >= 0.3 || shareRate >= 0.2) {
    return {
      level: 'medium',
      label: '⚡ 中等质量',
      description: '互动率一般'
    }
  }

  // 低质量
  return {
    level: 'low',
    label: '⚠️ 低质量',
    description: '评论和分享率较低'
  }
}

// ========== 辅助函数 ==========

/**
 * 计算数组中位数
 */
function median(numbers: number[]): number {
  if (numbers.length === 0) return 0

  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  } else {
    return sorted[mid]
  }
}

/**
 * 计算数组平均值
 */
export function average(numbers: number[]): number {
  if (numbers.length === 0) return 0
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length
}

/**
 * 计算数组方差
 */
export function variance(numbers: number[]): number {
  if (numbers.length === 0) return 0

  const avg = average(numbers)
  return numbers.reduce((sum, n) => sum + Math.pow(n - avg, 2), 0) / numbers.length
}
