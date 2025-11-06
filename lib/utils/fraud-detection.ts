/**
 * 刷量检测工具
 *
 * 基于多个指标检测疑似刷量的视频内容
 */

export interface VideoStatistics {
  playCount: number
  diggCount: number
  commentCount: number
  shareCount: number
  collectCount: number
}

export interface Comment {
  cid: string
  text: string
  digg_count: number
  create_time: number
  reply_comment_total: number
}

export interface FraudDetectionResult {
  isSuspicious: boolean
  reason: string | null
  confidence: number // 0-100，置信度
  flags: string[]
}

/**
 * 检测疑似刷量行为
 *
 * 检测规则：
 * 1. 点赞率异常高（>10%）但评论率很低（<0.3%）
 * 2. 评论内容质量低（空洞评论占比>60%）
 * 3. 互动集中在短时间内（前10%评论占总点赞数的80%+）
 * 4. 点赞率过高（>15%，自然流量很难超过）
 * 5. 播放量和互动不成比例
 */
export function detectFraud(
  stats: VideoStatistics,
  comments: Comment[]
): FraudDetectionResult {
  const flags: string[] = []
  let confidenceScore = 0

  // 防止除零错误
  if (stats.playCount === 0) {
    return {
      isSuspicious: false,
      reason: null,
      confidence: 0,
      flags: []
    }
  }

  // 计算基础指标
  const likeRate = (stats.diggCount / stats.playCount) * 100
  const commentRate = (stats.commentCount / stats.playCount) * 100
  const shareRate = (stats.shareCount / stats.playCount) * 100

  // 规则1: 点赞率异常高但评论率很低
  if (likeRate > 10 && commentRate < 0.3) {
    flags.push(`点赞率异常高(${likeRate.toFixed(2)}%)但评论率很低(${commentRate.toFixed(3)}%)`)
    confidenceScore += 30
  }

  // 规则2: 点赞率极高（>15%）
  if (likeRate > 15) {
    flags.push(`点赞率过高(${likeRate.toFixed(2)}%)，自然流量罕见`)
    confidenceScore += 35
  }

  // 规则3: 点赞数和播放量比例失衡
  // 正常情况：1000播放 → 30-50赞是合理的（3-5%）
  // 如果点赞率>8%但分享率<0.5%，可疑
  if (likeRate > 8 && shareRate < 0.5) {
    flags.push(`点赞率${likeRate.toFixed(2)}%但分享率仅${shareRate.toFixed(2)}%，互动不平衡`)
    confidenceScore += 20
  }

  // 评论质量分析（如果有评论数据）
  if (comments.length > 0) {
    // 规则4: 评论内容质量低
    const shallowComments = comments.filter(c =>
      isShallowComment(c.text)
    )
    const shallowRate = (shallowComments.length / comments.length) * 100

    if (shallowRate > 60 && comments.length >= 10) {
      flags.push(`空洞评论占比过高(${shallowRate.toFixed(1)}%)`)
      confidenceScore += 25
    }

    // 规则5: 互动过度集中
    const sortedComments = [...comments].sort((a, b) => b.digg_count - a.digg_count)
    const top10Percent = Math.max(1, Math.ceil(comments.length * 0.1))
    const top10Comments = sortedComments.slice(0, top10Percent)
    const top10Diggs = top10Comments.reduce((sum, c) => sum + c.digg_count, 0)
    const totalCommentDiggs = comments.reduce((sum, c) => sum + c.digg_count, 0)

    if (totalCommentDiggs > 0) {
      const top10Rate = (top10Diggs / totalCommentDiggs) * 100
      if (top10Rate > 80 && comments.length > 20) {
        flags.push(`互动过度集中(前${top10Percent}条评论占${top10Rate.toFixed(1)}%点赞)`)
        confidenceScore += 20
      }
    }

    // 规则6: 评论时间分布异常（所有评论在短时间内）
    if (comments.length >= 10) {
      const timestamps = comments.map(c => c.create_time).sort((a, b) => a - b)
      const timeSpan = timestamps[timestamps.length - 1] - timestamps[0]
      const hourSpan = timeSpan / 3600

      // 如果100条评论都在1小时内，可疑
      if (comments.length > 50 && hourSpan < 1) {
        flags.push(`${comments.length}条评论集中在${(hourSpan * 60).toFixed(0)}分钟内`)
        confidenceScore += 25
      }
    }
  }

  // 置信度归一化到0-100
  confidenceScore = Math.min(100, confidenceScore)

  return {
    isSuspicious: flags.length > 0 && confidenceScore >= 30,
    reason: flags.length > 0 ? flags.join('; ') : null,
    confidence: confidenceScore,
    flags
  }
}

/**
 * 判断是否为空洞评论
 *
 * 空洞评论特征：
 * - 纯数字/符号（666、!!!、👍👍👍）
 * - 单个词（赞、好、牛）
 * - 长度<3且不包含实质内容
 */
function isShallowComment(text: string): boolean {
  const trimmed = text.trim()

  // 空评论
  if (trimmed.length === 0) return true

  // 纯表情符号
  if (/^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+$/u.test(trimmed)) {
    return true
  }

  // 纯数字或符号
  if (/^[0-9\s!！.。]+$/.test(trimmed)) {
    return true
  }

  // 单字或双字常见空洞词
  const shallowWords = [
    '赞', '好', '牛', '棒', '强', '妙', '哇', '呀', '啊', '哦',
    '好棒', '真好', '不错', '很好', '太好', '真棒', '真牛',
    '666', '999', '6666', '9999'
  ]

  if (shallowWords.includes(trimmed)) {
    return true
  }

  // 长度<3且只有简单字符
  if (trimmed.length < 3 && !/[a-zA-Z\u4e00-\u9fa5]{3,}/.test(trimmed)) {
    return true
  }

  return false
}

/**
 * 批量检测多个视频
 */
export function batchDetectFraud(
  videos: Array<{
    id: string
    stats: VideoStatistics
    comments: Comment[]
  }>
): Map<string, FraudDetectionResult> {
  const results = new Map<string, FraudDetectionResult>()

  for (const video of videos) {
    const result = detectFraud(video.stats, video.comments)
    results.set(video.id, result)
  }

  return results
}

/**
 * 计算内容质量评分（0-100）
 *
 * 基于真实互动率和评论质量
 */
export function calculateQualityScore(
  stats: VideoStatistics,
  comments: Comment[]
): number {
  let score = 50 // 基础分

  if (stats.playCount === 0) return 0

  const likeRate = (stats.diggCount / stats.playCount) * 100
  const commentRate = (stats.commentCount / stats.playCount) * 100
  const shareRate = (stats.shareCount / stats.playCount) * 100

  // 点赞率评分（3-5%为最优）
  if (likeRate >= 3 && likeRate <= 5) {
    score += 20
  } else if (likeRate >= 2 && likeRate <= 7) {
    score += 10
  } else if (likeRate > 10) {
    score -= 20 // 过高可疑
  }

  // 评论率评分（0.5-1%为良好）
  if (commentRate >= 0.5 && commentRate <= 1) {
    score += 15
  } else if (commentRate >= 0.3 && commentRate <= 2) {
    score += 10
  }

  // 分享率评分（0.3-0.8%为良好）
  if (shareRate >= 0.3 && shareRate <= 0.8) {
    score += 15
  } else if (shareRate >= 0.1 && shareRate <= 1.5) {
    score += 8
  }

  // 评论质量评分
  if (comments.length > 0) {
    const shallowComments = comments.filter(c => isShallowComment(c.text))
    const shallowRate = (shallowComments.length / comments.length) * 100

    if (shallowRate < 20) {
      score += 10 // 评论质量高
    } else if (shallowRate > 60) {
      score -= 15 // 评论质量差
    }
  }

  return Math.max(0, Math.min(100, score))
}
