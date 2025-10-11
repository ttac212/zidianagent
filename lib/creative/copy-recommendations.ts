/**
 * 文案推荐逻辑
 * 
 * Linus原则：简单规则优于复杂AI
 * 基于5种文案类型的固定规则推荐Top 3
 */

interface Copy {
  id: string
  sequence: number
  markdownContent: string
  state: string
}

interface Recommendation {
  sequence: number
  reason: string
  type: '痛点型' | '实力型' | '对比型' | '科普型' | '信任型'
  copyId: string
}

/**
 * 推荐Top 3文案
 * 
 * 规则：
 * - 第1推荐：痛点型（sequence 1）- 最抓人
 * - 第2推荐：实力型（sequence 2）- 最有说服力
 * - 第3推荐：信任型（sequence 5）- 最易转化
 */
export function getTop3Recommendations(copies: Copy[]): Recommendation[] {
  if (copies.length === 0) {
    return []
  }

  // 定义推荐规则
  const rules: Array<{
    sequence: number
    reason: string
    type: '痛点型' | '实力型' | '对比型' | '科普型' | '信任型'
  }> = [
    {
      sequence: 1,
      reason: '直击痛点，开场最抓人',
      type: '痛点型'
    },
    {
      sequence: 2,
      reason: '实力展示，最有说服力',
      type: '实力型'
    },
    {
      sequence: 5,
      reason: '降低门槛，最易转化',
      type: '信任型'
    }
  ]

  // 根据规则查找对应文案
  const recommendations: Recommendation[] = []

  for (const rule of rules) {
    const copy = copies.find(c => c.sequence === rule.sequence)
    if (copy) {
      recommendations.push({
        sequence: rule.sequence,
        reason: rule.reason,
        type: rule.type,
        copyId: copy.id
      })
    }
  }

  return recommendations
}

/**
 * 获取文案类型标签
 */
export function getCopyTypeLabel(sequence: number): string {
  const labels: Record<number, string> = {
    1: '痛点型',
    2: '实力型',
    3: '对比型',
    4: '科普型',
    5: '信任型'
  }
  return labels[sequence] || `文案${sequence}`
}

/**
 * 获取文案类型描述
 */
export function getCopyTypeDescription(sequence: number): string {
  const descriptions: Record<number, string> = {
    1: '用"你怕XX"句式，直击顾虑，开场抓人',
    2: '用"因为我们XX"句式，展示硬实力，建立信任',
    3: '用"为什么在我们这XX"句式，对比优势，突出差异',
    4: '用"你知道XX吗"句式，讲解专业知识，塑造专家形象',
    5: '用"为什么推荐我们"句式，降低合作门槛，促进转化'
  }
  return descriptions[sequence] || ''
}
