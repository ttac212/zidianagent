/**
 * AI内容质量分析服务（商家Brief生成的中间步骤）
 *
 * 用途: 分析商家TOP内容的质量特征，用于优化商家Brief生成
 * 注意: 分析结果不持久化，仅在生成档案时临时使用
 *
 * 使用Claude Sonnet 4.5分析短视频内容质量：
 * - 开头吸引力（前3秒）
 * - 情绪点（humor/pain/satisfaction等）
 * - 痛点和需求提取
 * - 内容节奏
 * - 综合质量评分
 */

import { buildLLMRequestAuto } from '@/lib/ai/request-builder'

// 使用与档案生成相同的模型配置
const MODEL_ID = 'anthropic/claude-sonnet-4.5'
const API_BASE = process.env.ZENMUX_API_BASE || 'https://zenmux.ai/api/v1'

/**
 * 内容质量分析结果
 */
export interface ContentQualityAnalysis {
  // 开头质量分析
  openingQuality: {
    score: number            // 评分 0-10
    level: 'high' | 'medium' | 'low'
    reason: string           // AI评价原因
    hasHook: boolean         // 是否有吸引力开头
  }

  // 情绪点分析
  emotionalTrigger: {
    primary: 'humor' | 'pain' | 'satisfaction' | 'knowledge' | 'curiosity' | 'other'
    intensity: number        // 情绪强度 0-10
    description: string      // 情绪点描述
  }

  // 痛点提取
  painPoints: string[]       // 识别到的用户痛点

  // 需求提取
  userNeeds: string[]        // 识别到的用户需求

  // 内容节奏
  contentRhythm: {
    pace: 'fast' | 'medium' | 'slow'
    variety: 'high' | 'medium' | 'low'  // 节奏变化
    description: string
  }

  // 综合评价
  overallQuality: {
    score: number            // 综合质量评分 0-100
    strengths: string[]      // 优点（最多3个）
    weaknesses: string[]     // 缺点（最多3个）
  }
}

/**
 * System Prompt - 定义AI分析角色
 */
const SYSTEM_PROMPT = `你是短视频内容质量分析专家，擅长从文案分析短视频的吸引力和传播潜力。

分析维度：
1. **开头质量**（前3秒/前50字）
   - 是否有疑问句、数字、冲突词
   - 是否直击痛点或制造悬念
   - 评分标准：高(8-10)、中(5-7)、低(0-4)

2. **情绪点识别**
   - humor（幽默搞笑）：有笑点、段子
   - pain（痛点共鸣）：戳中用户困扰
   - satisfaction（爽点满足）：解决问题的快感
   - knowledge（知识获得）：学到新东西
   - curiosity（好奇悬念）：想知道后续
   - other（其他）

3. **痛点和需求提取**
   - 痛点：用户遇到的问题、困扰、不满
   - 需求：用户想要的、期待的解决方案

4. **内容节奏**
   - fast（节奏快）：信息密集、转折多
   - medium（节奏中等）：叙述平稳
   - slow（节奏慢）：铺垫较多
   - variety（节奏变化）：高/中/低

输出要求：
- 必须严格按照JSON Schema格式输出
- 所有评价要具体，不要泛泛而谈
- 如果转录文本不完整或太短，标注"数据不足"
- 只输出JSON，不要额外解释`

/**
 * 分析单条内容质量
 *
 * @param content 内容数据（标题、转录文本）
 * @returns AI分析结果
 */
export async function analyzeContentQuality(content: {
  title: string
  transcript: string | null
}): Promise<ContentQualityAnalysis | null> {
  // 检查数据完整性
  if (!content.transcript || content.transcript.length < 10) {
    console.warn('[ContentAnalyzer] 转录文本过短或缺失，跳过分析')
    return null
  }

  try {
    // 构建用户Prompt
    const userPrompt = buildAnalysisPrompt(content)

    // 调用LLM API
    const response = await callLLMAPI(userPrompt)

    // 解析响应
    const analysis = parseAnalysisResponse(response.content)

    return analysis

  } catch (error) {
    console.error('[ContentAnalyzer] 分析失败:', error)
    return null
  }
}

/**
 * 批量分析内容质量（并发控制）
 *
 * @param contents 内容列表
 * @param concurrency 并发数（默认3）
 * @returns 分析结果Map（contentId -> analysis）
 */
export async function analyzeContentQualityBatch(
  contents: Array<{ id: string; title: string; transcript: string | null }>,
  concurrency = 3
): Promise<Map<string, ContentQualityAnalysis>> {
  const results = new Map<string, ContentQualityAnalysis>()

  // 过滤掉无效数据
  const validContents = contents.filter(c => c.transcript && c.transcript.length >= 10)

  console.info(`[ContentAnalyzer] 批量分析: ${validContents.length}/${contents.length} 条有效内容`)

  // 分批处理
  for (let i = 0; i < validContents.length; i += concurrency) {
    const batch = validContents.slice(i, i + concurrency)

    const batchResults = await Promise.allSettled(
      batch.map(async (content) => {
        const analysis = await analyzeContentQuality(content)
        return { id: content.id, analysis }
      })
    )

    batchResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.analysis) {
        results.set(result.value.id, result.value.analysis)
      }
    })

    console.info(`[ContentAnalyzer] 已处理 ${Math.min(i + concurrency, validContents.length)}/${validContents.length}`)

    // 避免过快请求，每批间隔1秒
    if (i + concurrency < validContents.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return results
}

/**
 * 构建分析Prompt
 */
function buildAnalysisPrompt(content: { title: string; transcript: string | null }): string {
  const transcriptText = content.transcript || '（无转录文本）'
  const first50 = transcriptText.substring(0, 50)

  return `请分析以下短视频内容的质量：

**标题**: ${content.title}

**完整转录文本**:
${transcriptText}

**前3秒文案**（重点分析）:
${first50}

请按以下维度分析：

1. 开头质量（0-10分）
   - 前3秒是否有吸引力？
   - 是否有疑问句、数字、冲突词、悬念？
   - 评价开头的有效性

2. 情绪点识别
   - 主要情绪类型：humor/pain/satisfaction/knowledge/curiosity/other
   - 情绪强度（0-10）
   - 具体描述情绪点在哪里

3. 痛点和需求
   - 提取用户痛点（问题、困扰）
   - 提取用户需求（想要什么）

4. 内容节奏
   - 节奏快慢：fast/medium/slow
   - 节奏变化：high/medium/low
   - 描述节奏特点

5. 综合评价
   - 综合质量评分（0-100）
   - 列出3个优点
   - 列出3个缺点（如果有）

输出JSON格式（严格遵循Schema）。`
}

/**
 * 调用LLM API
 */
async function callLLMAPI(userPrompt: string) {
  const apiKey = process.env.ZENMUX_API_KEY || ''

  if (!apiKey) {
    throw new Error('未配置ZENMUX_API_KEY')
  }

  // 使用统一的请求构建函数，自动处理ZenMux参数规范
  const requestBody = buildLLMRequestAuto({
    model: MODEL_ID,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    maxTokens: 2000,
    temperature: 0.3,  // 较低温度，保证分析稳定性
    // 使用简单的JSON模式，避免严格Schema导致字段命名问题
    responseFormat: {
      type: 'json_object'
    }
  });

  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[ContentAnalyzer] API错误:', response.status, errorText)
    throw new Error(`LLM API调用失败: ${response.status}`)
  }

  const data = await response.json()

  if (!data.choices || data.choices.length === 0) {
    throw new Error('LLM API返回格式错误')
  }

  return {
    content: data.choices[0].message.content,
    usage: data.usage || { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 }
  }
}

/**
 * 解析AI响应
 */
function parseAnalysisResponse(aiResponse: string): ContentQualityAnalysis {
  try {
    // 清理可能的markdown代码块包裹
    let cleanedResponse = aiResponse.trim()

    // 方法1: 移除 ```json 和 ``` 包裹，并提取第一个完整的JSON块
    if (cleanedResponse.includes('```json')) {
      const jsonBlockMatch = cleanedResponse.match(/```json\s*\n?([\s\S]*?)\n?```/)
      if (jsonBlockMatch && jsonBlockMatch[1]) {
        cleanedResponse = jsonBlockMatch[1].trim()
      } else {
        // fallback: 简单移除
        cleanedResponse = cleanedResponse.replace(/^```json\n?/, '').replace(/\n?```[\s\S]*$/, '')
      }
    } else if (cleanedResponse.includes('```')) {
      const codeBlockMatch = cleanedResponse.match(/```\s*\n?([\s\S]*?)\n?```/)
      if (codeBlockMatch && codeBlockMatch[1]) {
        cleanedResponse = codeBlockMatch[1].trim()
      } else {
        // fallback: 简单移除
        cleanedResponse = cleanedResponse.replace(/^```\n?/, '').replace(/\n?```[\s\S]*$/, '')
      }
    }

    // 方法2: 如果仍然包含非JSON内容，尝试提取第一个完整的JSON对象
    if (cleanedResponse.includes('{')) {
      const firstBrace = cleanedResponse.indexOf('{')
      let braceCount = 0
      let endIndex = -1

      for (let i = firstBrace; i < cleanedResponse.length; i++) {
        if (cleanedResponse[i] === '{') braceCount++
        if (cleanedResponse[i] === '}') braceCount--

        if (braceCount === 0) {
          endIndex = i + 1
          break
        }
      }

      if (endIndex > firstBrace) {
        cleanedResponse = cleanedResponse.substring(firstBrace, endIndex)
      }
    }

    const parsed = JSON.parse(cleanedResponse.trim())

    // 调试：输出AI返回的完整JSON结构（仅在警告模式下）
    if (process.env.DEBUG_CONTENT_ANALYZER) {
      console.log('[ContentAnalyzer] AI返回的完整JSON:', JSON.stringify(parsed, null, 2))
    }

    // 调试：输出AI返回的原始字段名
    console.log('[ContentAnalyzer] AI返回的顶层字段:', JSON.stringify(Object.keys(parsed)))

    // 转换下划线命名为驼峰命名（兼容不同API返回格式）
    const normalized = normalizeFieldNames(parsed)

    // 验证并补充缺失字段
    const result = validateAndFillDefaults(normalized)

    return result

  } catch (error) {
    console.error('[ContentAnalyzer] 解析失败:', error)
    // 输出更多调试信息
    console.error('[ContentAnalyzer] 响应长度:', aiResponse.length)
    console.error('[ContentAnalyzer] 原始响应（前1000字符）:', aiResponse.substring(0, 1000))
    console.error('[ContentAnalyzer] 原始响应（后200字符）:', aiResponse.substring(Math.max(0, aiResponse.length - 200)))
    throw error
  }
}

/**
 * 验证结构并填充默认值
 */
function validateAndFillDefaults(data: any): ContentQualityAnalysis {
  // 开头质量
  const openingQuality = data.openingQuality || {}
  if (!openingQuality.score && openingQuality.score !== 0) {
    console.warn('[ContentAnalyzer] 缺少 openingQuality.score，使用默认值5')
  }

  // 情绪点
  const emotionalTrigger = data.emotionalTrigger || {}
  if (!emotionalTrigger.primary) {
    console.warn('[ContentAnalyzer] 缺少 emotionalTrigger.primary，使用默认值"other"')
  }

  // 综合质量
  const overallQuality = data.overallQuality || {}
  if (!overallQuality.score && overallQuality.score !== 0) {
    console.warn('[ContentAnalyzer] 缺少 overallQuality.score，使用默认值50')
  }

  return {
    openingQuality: {
      score: openingQuality.score ?? 5,
      level: openingQuality.level || 'medium',
      reason: openingQuality.reason || '未提供原因',
      hasHook: openingQuality.hasHook ?? false
    },
    emotionalTrigger: {
      primary: emotionalTrigger.primary || 'other',
      intensity: emotionalTrigger.intensity ?? 5,
      description: emotionalTrigger.description || '未提供描述'
    },
    painPoints: Array.isArray(data.painPoints) ? data.painPoints : [],
    userNeeds: Array.isArray(data.userNeeds) ? data.userNeeds : [],
    contentRhythm: {
      pace: data.contentRhythm?.pace || 'medium',
      variety: data.contentRhythm?.variety || 'medium',
      description: data.contentRhythm?.description || '未提供描述'
    },
    overallQuality: {
      score: overallQuality.score ?? 50,
      strengths: Array.isArray(overallQuality.strengths) ? overallQuality.strengths : [],
      weaknesses: Array.isArray(overallQuality.weaknesses) ? overallQuality.weaknesses : []
    }
  }
}

/**
 * 将下划线命名转换为驼峰命名（兼容AI可能返回的不同格式）
 */
function normalizeFieldNames(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj

  // 字段名映射表（完整版，兼容多种AI返回格式）
  const fieldMap: Record<string, string> = {
    // 顶层字段
    'opening_quality': 'openingQuality',
    'emotional_trigger': 'emotionalTrigger',
    'emotional_points': 'emotionalTrigger',      // AI常用的变体
    'emotion_points': 'emotionalTrigger',        // 新增：AI实际返回的字段名
    'pain_points': 'painPoints',
    'user_needs': 'userNeeds',
    'content_rhythm': 'contentRhythm',
    'overall_quality': 'overallQuality',
    'overall_evaluation': 'overallQuality',      // AI有时返回这个
    'overall_assessment': 'overallQuality',      // 新增：AI实际返回的字段名

    // 嵌套字段 - openingQuality
    'has_hook': 'hasHook',
    'has_hook_elements': 'hasHook',              // AI返回的是has_hook_elements对象
    'hook_types': 'hookTypes',
    'hook_elements': 'hookElements',             // 保留原字段
    'evaluation': 'reason',
    'effectiveness_analysis': 'reason',          // AI有时返回这个
    'effectiveness': 'reason',                   // 新增：AI实际返回的字段名

    // 嵌套字段 - emotionalTrigger
    'primary_emotion': 'primary',
    'emotion_intensity': 'intensity',
    'type': 'primary',                           // 新增：emotion_points数组元素中使用type

    // 嵌套字段 - painPoints/userNeeds
    'user_pains': 'painPoints',

    // 嵌套字段 - contentRhythm
    'pace_variation': 'variety',
    'variation': 'variety',                      // 新增：AI实际返回的字段名

    // 嵌套字段 - overallQuality
    'overall_score': 'score',
    'quality_score': 'score',                    // 新增：AI实际返回的字段名
    'strengths': 'strengths',                    // 保持不变
    'weaknesses': 'weaknesses'                   // 保持不变
  }

  const result: any = {}

  for (const key in obj) {
    // 转换字段名
    const normalizedKey = fieldMap[key] || key
    const value = obj[key]

    // 特殊处理：emotion_points数组转换为单个对象
    if (key === 'emotion_points' && Array.isArray(value) && value.length > 0) {
      result[normalizedKey] = normalizeFieldNames(value[0])  // 取第一个情绪点
      continue
    }

    // 特殊处理：has_hook_elements对象转换为布尔值
    if (key === 'has_hook_elements' && typeof value === 'object') {
      // 检查是否有任何hook元素为true
      result[normalizedKey] = Object.values(value).some(v => v === true)
      continue
    }

    // 递归处理嵌套对象
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[normalizedKey] = normalizeFieldNames(value)
    } else if (Array.isArray(value)) {
      // 递归处理数组元素
      result[normalizedKey] = value.map(item =>
        item && typeof item === 'object' ? normalizeFieldNames(item) : item
      )
    } else {
      result[normalizedKey] = value
    }
  }

  return result
}
