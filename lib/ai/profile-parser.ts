/**
 * 商家创作档案 - AI响应解析器
 *
 * 功能:
 * - 解析AI返回的JSON格式档案
 * - 验证JSON结构完整性
 * - 提供降级策略处理解析失败
 */

import type {
  AIProfileResponse,
  ProfileBrief,
  ProfileViralAnalysis,
  ProfileCreativeGuide
} from '@/types/merchant'

interface ParseResult {
  briefIntro: string | null
  briefSellingPoints: string | null
  briefUsageScenarios: string | null
  briefAudienceProfile: string | null
  briefBrandTone: string | null

  topContentAnalysis: string | null
  goldenThreeSeconds: string | null
  emotionalTriggers: string | null
  contentFormats: string | null

  trendingTopics: string | null
  tagStrategy: string | null
  publishingTips: string | null
}

/**
 * 解析AI响应文本为档案数据
 */
export function parseProfileResponse(aiResponse: string): ParseResult {
  try {
    // 尝试从响应中提取JSON
    const jsonText = extractJSON(aiResponse)

    if (!jsonText) {
      console.error('[Profile Parser] 无法提取JSON:', aiResponse.substring(0, 200))
      return createEmptyResult()
    }

    // 解析JSON
    const parsed: AIProfileResponse = JSON.parse(jsonText)

    // 验证结构
    if (!validateStructure(parsed)) {
      console.error('[Profile Parser] JSON结构验证失败')
      return createEmptyResult()
    }

    // 转换为数据库存储格式
    return convertToStorageFormat(parsed)

  } catch (error) {
    console.error('[Profile Parser] 解析失败:', error)
    return createEmptyResult()
  }
}

/**
 * 从AI响应中提取JSON文本
 * 处理AI可能返回的额外解释文字
 */
function extractJSON(text: string): string | null {
  // 尝试直接解析(如果AI只返回JSON)
  try {
    JSON.parse(text)
    return text
  } catch {
    // 继续尝试其他方法
  }

  // 尝试提取 ```json ... ``` 代码块
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }

  // 尝试提取第一个完整的JSON对象
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return jsonMatch[0]
  }

  return null
}

/**
 * 验证AI响应的JSON结构
 */
function validateStructure(data: any): data is AIProfileResponse {
  if (!data || typeof data !== 'object') return false

  // 验证三个主要部分存在
  if (!data.brief || !data.viralAnalysis || !data.creativeGuide) {
    console.warn('[Profile Parser] 缺少主要部分:', {
      hasBrief: !!data.brief,
      hasViralAnalysis: !!data.viralAnalysis,
      hasCreativeGuide: !!data.creativeGuide
    })
    return false
  }

  // 验证Brief结构
  const brief = data.brief
  if (!brief.intro || !Array.isArray(brief.sellingPoints) || !brief.audienceProfile) {
    console.warn('[Profile Parser] Brief结构不完整')
    return false
  }

  // 验证爆款分析结构
  const viral = data.viralAnalysis
  if (!Array.isArray(viral.goldenThreeSeconds) || !viral.emotionalTriggers) {
    console.warn('[Profile Parser] ViralAnalysis结构不完整')
    return false
  }

  // 验证创作指南结构
  const guide = data.creativeGuide
  if (!Array.isArray(guide.trendingTopics) || !guide.tagStrategy || !guide.publishingTips) {
    console.warn('[Profile Parser] CreativeGuide结构不完整')
    return false
  }

  return true
}

/**
 * 将AI响应转换为数据库存储格式
 */
function convertToStorageFormat(data: AIProfileResponse): ParseResult {
  const { brief, viralAnalysis, creativeGuide } = data

  return {
    // PART 1: Brief
    briefIntro: brief.intro || null,
    briefSellingPoints: JSON.stringify(brief.sellingPoints || []),
    briefUsageScenarios: JSON.stringify(brief.usageScenarios || []),
    briefAudienceProfile: JSON.stringify(brief.audienceProfile || null),
    briefBrandTone: brief.brandTone || null,

    // PART 2: 爆款分析
    topContentAnalysis: JSON.stringify(viralAnalysis.topContents || []),
    goldenThreeSeconds: JSON.stringify(viralAnalysis.goldenThreeSeconds || []),
    emotionalTriggers: JSON.stringify(viralAnalysis.emotionalTriggers || {}),
    contentFormats: JSON.stringify(viralAnalysis.contentFormats || {}),

    // PART 3: 创作指南
    trendingTopics: JSON.stringify(creativeGuide.trendingTopics || []),
    tagStrategy: typeof creativeGuide.tagStrategy === 'string'
      ? creativeGuide.tagStrategy
      : JSON.stringify(creativeGuide.tagStrategy),
    publishingTips: JSON.stringify(creativeGuide.publishingTips || {})
  }
}

/**
 * 创建空结果(解析失败时的降级策略)
 */
function createEmptyResult(): ParseResult {
  return {
    briefIntro: null,
    briefSellingPoints: null,
    briefUsageScenarios: null,
    briefAudienceProfile: null,
    briefBrandTone: null,

    topContentAnalysis: null,
    goldenThreeSeconds: null,
    emotionalTriggers: null,
    contentFormats: null,

    trendingTopics: null,
    tagStrategy: null,
    publishingTips: null
  }
}

/**
 * 前端使用:解析数据库中的JSON字符串
 */
export function parseStoredProfile(profile: any): {
  brief: ProfileBrief | null
  viralAnalysis: ProfileViralAnalysis | null
  creativeGuide: ProfileCreativeGuide | null
} {
  try {
    const brief: ProfileBrief | null = profile.briefIntro ? {
      intro: profile.briefIntro,
      sellingPoints: JSON.parse(profile.briefSellingPoints || '[]'),
      usageScenarios: JSON.parse(profile.briefUsageScenarios || '[]'),
      audienceProfile: JSON.parse(profile.briefAudienceProfile || 'null'),
      brandTone: profile.briefBrandTone || ''
    } : null

    const viralAnalysis: ProfileViralAnalysis | null = profile.topContentAnalysis ? {
      topContents: JSON.parse(profile.topContentAnalysis || '[]'),
      goldenThreeSeconds: JSON.parse(profile.goldenThreeSeconds || '[]'),
      emotionalTriggers: JSON.parse(profile.emotionalTriggers || '{}'),
      contentFormats: JSON.parse(profile.contentFormats || '{}')
    } : null

    const creativeGuide: ProfileCreativeGuide | null = profile.trendingTopics ? {
      trendingTopics: JSON.parse(profile.trendingTopics || '[]'),
      tagStrategy: profile.tagStrategy ?
        (profile.tagStrategy.startsWith('{') ? JSON.parse(profile.tagStrategy) : profile.tagStrategy)
        : '',
      publishingTips: JSON.parse(profile.publishingTips || '{}')
    } : null

    return { brief, viralAnalysis, creativeGuide }
  } catch (error) {
    console.error('[Profile Parser] 前端解析失败:', error)
    return { brief: null, viralAnalysis: null, creativeGuide: null }
  }
}
