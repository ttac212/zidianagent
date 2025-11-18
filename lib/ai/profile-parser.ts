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
  ProfileBrief
} from '@/types/merchant'

interface ParseResult {
  briefIntro: string | null
  briefSellingPoints: string | null
  briefUsageScenarios: string | null
  briefAudienceProfile: string | null
  briefBrandTone: string | null
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

  // 验证brief部分存在
  if (!data.brief) {
    console.warn('[Profile Parser] 缺少brief部分')
    return false
  }

  // 验证Brief结构
  const brief = data.brief
  if (!brief.intro || !Array.isArray(brief.sellingPoints) || !brief.audienceProfile) {
    console.warn('[Profile Parser] Brief结构不完整')
    return false
  }

  return true
}

/**
 * 将AI响应转换为数据库存储格式
 */
function convertToStorageFormat(data: AIProfileResponse): ParseResult {
  const { brief } = data

  return {
    // PART 1: Brief
    briefIntro: brief.intro || null,
    briefSellingPoints: JSON.stringify(brief.sellingPoints || []),
    briefUsageScenarios: JSON.stringify(brief.usageScenarios || []),
    briefAudienceProfile: JSON.stringify(brief.audienceProfile || null),
    briefBrandTone: brief.brandTone || null
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
    briefBrandTone: null
  }
}

/**
 * 前端使用:解析数据库中的JSON字符串
 */
export function parseStoredProfile(profile: any): {
  brief: ProfileBrief | null
  source: 'manual' | 'ai' | 'none'
} {
  try {
    // ✅ 显式校验 manualBrief 是对象类型（防止空字符串等无效值）
    const manualBrief: ProfileBrief | null =
      profile.manualBrief && typeof profile.manualBrief === 'object'
        ? profile.manualBrief as ProfileBrief
        : null

    if (manualBrief) {
      return { brief: manualBrief, source: 'manual' }
    }

    // Fallback 到 AI 生成的 brief
    const brief: ProfileBrief | null = profile.briefIntro ? {
      intro: profile.briefIntro,
      sellingPoints: JSON.parse(profile.briefSellingPoints || '[]'),
      usageScenarios: JSON.parse(profile.briefUsageScenarios || '[]'),
      audienceProfile: JSON.parse(profile.briefAudienceProfile || 'null'),
      brandTone: profile.briefBrandTone || ''
    } : null

    return { brief, source: brief ? 'ai' : 'none' }
  } catch (error) {
    console.error('[Profile Parser] 前端解析失败:', error)
    return { brief: null, source: 'none' }
  }
}
