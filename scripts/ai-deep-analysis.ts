/**
 * AI深度分析脚本
 * 基于商家的短视频转录文本，通过LLM生成详细的商家分析报告
 */

import type {
  AIAnalysisRequest,
  AIAnalysisResponse,
  AIDeepAnalysisReport,
} from '@/types/merchant-analysis'

type NormalizedAnalysisSections = Pick<
  AIDeepAnalysisReport,
  | 'basicInfo'
  | 'contentStrategy'
  | 'advantages'
  | 'marketingStrategy'
  | 'contentTechniques'
  | 'audience'
  | 'viralContentPatterns'
  | 'keyInsights'
  | 'dataSupport'
>

const DEFAULT_TEXT = 'N/A'
const DEFAULT_STRING_ARRAY = ['TBD']
const DEFAULT_TOP_CONTENT_TAKEAWAYS = ['High engagement']

function ensureString(value: unknown, fallback: string = DEFAULT_TEXT): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function ensureNumber(value: unknown, fallback: number = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function ensureStringArray(
  value: unknown,
  fallback: string[] = DEFAULT_STRING_ARRAY
): string[] {
  if (Array.isArray(value)) {
    const sanitized = value
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
    return sanitized.length > 0 ? sanitized : fallback
  }
  return fallback
}

function normalizeTopPerformingContents(
  contents: unknown
): AIDeepAnalysisReport['dataSupport']['topPerformingContents'] {
  if (!Array.isArray(contents)) return []

  return contents.map((item) => ({
    title: ensureString((item as any)?.title, 'Unknown content'),
    engagement: ensureNumber((item as any)?.engagement, 0),
    keyTakeaways: ensureStringArray(
      (item as any)?.keyTakeaways,
      DEFAULT_TOP_CONTENT_TAKEAWAYS
    ),
  }))
}

function normalizeViralPatterns(
  patterns: unknown
): AIDeepAnalysisReport['viralContentPatterns'] {
  if (!Array.isArray(patterns)) {
    return [
      {
        patternType: DEFAULT_TEXT,
        structure: { hook: DEFAULT_TEXT, coreContent: DEFAULT_TEXT, callToAction: DEFAULT_TEXT },
        examples: DEFAULT_STRING_ARRAY,
        effectiveness: DEFAULT_TEXT,
      },
    ]
  }

  const normalized = patterns.map((pattern) => {
    const structure = (pattern as any)?.structure ?? {}
    return {
      patternType: ensureString((pattern as any)?.patternType),
      structure: {
        hook: ensureString(structure?.hook),
        coreContent: ensureString(structure?.coreContent),
        callToAction: ensureString(structure?.callToAction),
      },
      examples: ensureStringArray((pattern as any)?.examples),
      effectiveness: ensureString((pattern as any)?.effectiveness),
    }
  })

  return normalized.length > 0
    ? normalized
    : [
        {
          patternType: DEFAULT_TEXT,
          structure: {
            hook: DEFAULT_TEXT,
            coreContent: DEFAULT_TEXT,
            callToAction: DEFAULT_TEXT,
          },
          examples: DEFAULT_STRING_ARRAY,
          effectiveness: DEFAULT_TEXT,
        },
      ]
}

function normalizeAnalysisResult(
  raw: any,
  request: AIAnalysisRequest
): NormalizedAnalysisSections {
  const basicInfo = raw?.basicInfo ?? {}
  const contentStrategy = raw?.contentStrategy ?? {}
  const advantages = raw?.advantages ?? {}
  const marketingStrategy = raw?.marketingStrategy ?? {}
  const contentTechniques = raw?.contentTechniques ?? {}
  const audience = raw?.audience ?? {}
  const keyInsights = raw?.keyInsights ?? {}
  const dataSupport = raw?.dataSupport ?? {}

  return {
    basicInfo: {
      merchantName: ensureString(basicInfo.merchantName, request.merchantName),
      mainBusiness: ensureString(basicInfo.mainBusiness),
      coreProducts: ensureStringArray(basicInfo.coreProducts),
      businessModel: ensureString(basicInfo.businessModel),
    },
    contentStrategy: {
      videoContentTypes: ensureStringArray(contentStrategy.videoContentTypes),
      publishFrequency: ensureString(contentStrategy.publishFrequency),
      presentationStyle: ensureStringArray(contentStrategy.presentationStyle),
      keyThemes: ensureStringArray(contentStrategy.keyThemes),
    },
    advantages: {
      costAdvantage: ensureString(advantages.costAdvantage),
      convenience: ensureStringArray(advantages.convenience),
      customization: ensureString(advantages.customization),
      qualityAssurance: ensureStringArray(advantages.qualityAssurance),
    },
    marketingStrategy: {
      trustBuilding: ensureStringArray(marketingStrategy.trustBuilding),
      differentiation: ensureStringArray(marketingStrategy.differentiation),
      conversionPath: ensureStringArray(marketingStrategy.conversionPath),
      promotionTactics: ensureStringArray(marketingStrategy.promotionTactics),
    },
    contentTechniques: {
      visualPresentation: ensureStringArray(contentTechniques.visualPresentation),
      languageStyle: ensureStringArray(contentTechniques.languageStyle),
      interactionDesign: ensureStringArray(contentTechniques.interactionDesign),
      emotionalAppeal: ensureStringArray(contentTechniques.emotionalAppeal),
    },
    audience: {
      primaryRegions: ensureStringArray(audience.primaryRegions),
      coreNeeds: ensureStringArray(audience.coreNeeds),
      consumerPsychology: ensureStringArray(audience.consumerPsychology),
      painPoints: ensureStringArray(audience.painPoints),
    },
    viralContentPatterns: normalizeViralPatterns(raw?.viralContentPatterns),
    keyInsights: {
      strengthsAnalysis: ensureStringArray(keyInsights.strengthsAnalysis),
      improvementSuggestions: ensureStringArray(keyInsights.improvementSuggestions),
      contentRecommendations: ensureStringArray(keyInsights.contentRecommendations),
      competitiveEdge: ensureStringArray(keyInsights.competitiveEdge),
    },
    dataSupport: {
      contentCount: ensureNumber(dataSupport.contentCount, request.transcripts.length),
      avgEngagement: ensureNumber(dataSupport.avgEngagement, 0),
      topPerformingContents: normalizeTopPerformingContents(
        dataSupport.topPerformingContents
      ),
    },
  }
}

function getTotalEngagement(transcript: AIAnalysisRequest['transcripts'][number]): number {
  return (
    transcript.engagement.diggCount +
    transcript.engagement.commentCount +
    transcript.engagement.collectCount +
    transcript.engagement.shareCount
  )
}

/**
 * 构建AI分析的Prompt
 */
function buildAnalysisPrompt(request: AIAnalysisRequest): string {
  const { merchantName, transcripts, basicStats, analysisDepth = 'comprehensive' } = request

  // 准备转录文本内容
  const transcriptsText = transcripts
    .map((t, idx) => {
      const engagement = t.engagement.diggCount + t.engagement.commentCount
      return `
【视频 ${idx + 1}】标题: ${t.title}
互动数据: 👍${t.engagement.diggCount} 💬${t.engagement.commentCount} ⭐${t.engagement.collectCount} 🔗${t.engagement.shareCount} (总互动: ${engagement})
文案内容:
${t.content || '(无转录文本)'}
---
`
    })
    .join('\n')

  const depthInstruction =
    analysisDepth === 'comprehensive'
      ? '请提供最详细、深入的分析，包含所有维度的洞察。'
      : analysisDepth === 'detailed'
        ? '请提供较为详细的分析，覆盖主要维度。'
        : '请提供基础分析，聚焦关键要点。'

  return `# 商家短视频内容分析任务

你是一位资深的短视频营销分析专家，擅长从短视频文案中提取商家信息、分析营销策略、洞察受众心理。

## 分析对象
- **商家名称**: ${merchantName}
- **分类**: ${basicStats.category || '未分类'}
- **地区**: ${basicStats.location || '未知'}
- **业务类型**: ${basicStats.businessType}
- **总内容数**: ${basicStats.totalContentCount}
- **总互动量**: ${basicStats.totalEngagement}

## 短视频文案数据
以下是该商家最近发布的${transcripts.length}条短视频的标题和文案内容：

${transcriptsText}

## 分析要求
${depthInstruction}

请按照以下结构生成JSON格式的分析报告（**只返回JSON，不要包含markdown代码块标记**）：

\`\`\`json
{
  "basicInfo": {
    "merchantName": "商家名称",
    "mainBusiness": "主营业务总结（如：系统门窗制造与安装）",
    "coreProducts": ["核心产品1", "核心产品2", "核心产品3"],
    "businessModel": "业务模式描述（如：工厂直供+上门测量+定制安装的一站式服务）"
  },
  "contentStrategy": {
    "videoContentTypes": ["产品展示", "工艺科普", "客户案例", "促销活动"],
    "publishFrequency": "发布频率估算",
    "presentationStyle": ["现场实拍", "对比演示", "数据展示"],
    "keyThemes": ["核心主题1", "核心主题2"]
  },
  "advantages": {
    "costAdvantage": "成本优势描述（如有）",
    "convenience": ["便捷性优势1", "便捷性优势2"],
    "customization": "定制化能力描述（如有）",
    "qualityAssurance": ["品质保障措施1", "品质保障措施2"]
  },
  "marketingStrategy": {
    "trustBuilding": ["建立信任的方式1", "建立信任的方式2"],
    "differentiation": ["差异化竞争点1", "差异化竞争点2"],
    "conversionPath": ["转化路径1", "转化路径2"],
    "promotionTactics": ["促销手段1", "促销手段2"]
  },
  "contentTechniques": {
    "visualPresentation": ["视觉呈现方式1", "视觉呈现方式2"],
    "languageStyle": ["语言风格特点1", "语言风格特点2"],
    "interactionDesign": ["互动设计方式1", "互动设计方式2"],
    "emotionalAppeal": ["情感诉求点1", "情感诉求点2"]
  },
  "audience": {
    "primaryRegions": ["主要地域1", "主要地域2"],
    "coreNeeds": ["核心需求1", "核心需求2"],
    "consumerPsychology": ["消费心理1", "消费心理2"],
    "painPoints": ["痛点1", "痛点2"]
  },
  "viralContentPatterns": [
    {
      "patternType": "文案类型名称（如：秀肌肉型、痛点解决型）",
      "structure": {
        "hook": "钩子内容（0-3秒如何吸引注意）",
        "coreContent": "核心内容（3-20秒传递什么信息）",
        "callToAction": "行动号召（结尾如何引导转化）"
      },
      "examples": ["实际案例1的标题或摘要", "实际案例2的标题或摘要"],
      "effectiveness": "效果评估（基于互动数据）"
    }
  ],
  "keyInsights": {
    "strengthsAnalysis": ["优势分析1", "优势分析2"],
    "improvementSuggestions": ["改进建议1", "改进建议2"],
    "contentRecommendations": ["内容创作建议1", "内容创作建议2"],
    "competitiveEdge": ["竞争优势1", "竞争优势2"]
  },
  "dataSupport": {
    "contentCount": ${transcripts.length},
    "avgEngagement": 0,
    "topPerformingContents": [
      {
        "title": "表现最好的内容标题",
        "engagement": 0,
        "keyTakeaways": ["关键要点1", "关键要点2"]
      }
    ]
  }
}
\`\`\`

## 重要提示
1. **只返回纯JSON格式**，不要用markdown代码块包裹（不要用\`\`\`json\`\`\`）
2. 基于实际文案内容提取信息，避免泛泛而谈
3. 对于爆款文案结构分析，请从实际视频中找出最有代表性的模式
4. 在dataSupport中计算平均互动量，并列出TOP 3表现最好的内容
5. 所有数组字段至少包含1-3个元素，避免空数组
6. 如果某个维度信息不足，可标注"（数据不足）"但仍需给出合理推测

现在开始分析，直接返回JSON：`
}

/**
 * 调用LLM API进行分析
 */
async function callLLMForAnalysis(
  prompt: string,
  modelId: string = 'claude-3-5-sonnet-20241022'
): Promise<{ content: string; tokensUsed: number }> {
  const apiBase = process.env.LLM_API_BASE || 'https://api.302.ai/v1'
  const apiKey = process.env.LLM_API_KEY

  if (!apiKey) {
    throw new Error('LLM_API_KEY环境变量未设置')
  }

  const startTime = Date.now()

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // 较低温度确保分析结果稳定
      max_tokens: 8000, // 详细分析需要较多token
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LLM API调用失败: ${response.status} ${error}`)
  }

  const data = await response.json()
  const endTime = Date.now()

  console.log(`⏱️  LLM响应耗时: ${((endTime - startTime) / 1000).toFixed(2)}秒`)

  return {
    content: data.choices[0]?.message?.content || '',
    tokensUsed: data.usage?.total_tokens || 0,
  }
}

/**
 * 解析LLM返回的JSON
 */
function parseLLMResponse(content: string): any {
  // 移除可能的markdown代码块标记
  let jsonStr = content.trim()
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '')
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '')
  }

  try {
    return JSON.parse(jsonStr)
  } catch (error) {
    console.error('❌ JSON解析失败，原始内容:', jsonStr.substring(0, 500))
    throw new Error(`LLM返回的JSON格式无效: ${error}`)
  }
}

/**
 * 执行AI深度分析
 */
export async function performAIDeepAnalysis(
  request: AIAnalysisRequest
): Promise<AIAnalysisResponse> {
  const startTime = Date.now()

  try {
    // 1. 验证输入
    if (request.transcripts.length === 0) {
      return {
        success: false,
        error: '没有可分析的转录文本',
        warnings: ['商家内容不足，无法进行分析'],
      }
    }

    console.log(`\n🤖 开始AI分析: ${request.merchantName}`)
    console.log(`📄 转录文本数量: ${request.transcripts.length}`)

    // 2. 构建Prompt
    const prompt = buildAnalysisPrompt(request)

    // 3. 调用LLM
    console.log('🔄 调用LLM API...')
    const { content, tokensUsed } = await callLLMForAnalysis(prompt)

    // 4. 解析响应
    console.log('📊 解析AI响应...')
    const rawAnalysisResult = parseLLMResponse(content)
    const normalizedResult = normalizeAnalysisResult(rawAnalysisResult, request)

    // 5. 计算数据支持
    const totalEngagement = request.transcripts.reduce(
      (sum, transcript) => sum + getTotalEngagement(transcript),
      0
    )
    const avgEngagement = Math.round(totalEngagement / request.transcripts.length)

    // 找出TOP 3内容
    const topContents = [...request.transcripts]
      .sort((a, b) => getTotalEngagement(b) - getTotalEngagement(a))
      .slice(0, 3)

    const existingTakeaways = new Map(
      normalizedResult.dataSupport.topPerformingContents.map((item) => [
        item.title,
        item.keyTakeaways.length > 0 ? item.keyTakeaways : DEFAULT_TOP_CONTENT_TAKEAWAYS,
      ])
    )

    const normalizedDataSupport: AIDeepAnalysisReport['dataSupport'] = {
      contentCount: request.transcripts.length,
      avgEngagement,
      topPerformingContents: topContents.map((transcript) => ({
        title: transcript.title,
        engagement: getTotalEngagement(transcript),
        keyTakeaways:
          existingTakeaways.get(transcript.title) ?? DEFAULT_TOP_CONTENT_TAKEAWAYS,
      })),
    }

    // 6. 构建完整报告
    const endTime = Date.now()
    const processingTime = (endTime - startTime) / 1000

    const report: AIDeepAnalysisReport = {
      merchantId: request.merchantId,
      merchantName: request.merchantName,
      analysisDate: new Date().toISOString(),
      basicInfo: normalizedResult.basicInfo,
      contentStrategy: normalizedResult.contentStrategy,
      advantages: normalizedResult.advantages,
      marketingStrategy: normalizedResult.marketingStrategy,
      contentTechniques: normalizedResult.contentTechniques,
      audience: normalizedResult.audience,
      viralContentPatterns: normalizedResult.viralContentPatterns,
      keyInsights: normalizedResult.keyInsights,
      dataSupport: normalizedDataSupport,
      aiMetadata: {
        model: 'claude-3-5-sonnet-20241022',
        analysisTokens: tokensUsed,
        confidence: 0.85, // 可根据实际情况调整
        processingTime,
      },
    }

    console.log(`✅ AI分析完成`)
    console.log(`   - 使用Token: ${tokensUsed}`)
    console.log(`   - 耗时: ${processingTime.toFixed(2)}秒`)

    return {
      success: true,
      report,
    }
  } catch (error) {
    console.error('❌ AI分析失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }
  }
}

/**
 * 批量AI分析（从导出的商家数据）
 */
export async function batchAIAnalysis(options: {
  merchants: Array<{
    id: string
    uid: string
    name: string
    category: string | null
    location: string | null
    businessType: string
    totalContentCount: number
    totalDiggCount: number
    totalCommentCount: number
    totalCollectCount: number
    totalShareCount: number
    recentContents: Array<{
      title: string
      transcript?: string | null
      diggCount: number
      commentCount: number
      collectCount: number
      shareCount: number
    }>
  }>
  analysisDepth?: 'basic' | 'detailed' | 'comprehensive'
  skipNoTranscript?: boolean // 跳过没有转录文本的商家
}): Promise<AIDeepAnalysisReport[]> {
  const { merchants, analysisDepth = 'comprehensive', skipNoTranscript = true } = options

  console.log(`\n📊 开始批量AI分析`)
  console.log(`   - 商家数量: ${merchants.length}`)
  console.log(`   - 分析深度: ${analysisDepth}`)

  const reports: AIDeepAnalysisReport[] = []
  let skippedCount = 0
  const failures: Array<{ merchantId: string; merchantName: string; reason: string }> = []

  for (let i = 0; i < merchants.length; i++) {
    const merchant = merchants[i]
    console.log(`\n[${i + 1}/${merchants.length}] ${merchant.name}`)

    // 过滤有转录文本的内容
    const transcripts = merchant.recentContents
      .filter((c) => c.transcript && c.transcript.trim().length > 0)
      .map((c) => ({
        title: c.title,
        content: c.transcript!,
        engagement: {
          diggCount: c.diggCount,
          commentCount: c.commentCount,
          collectCount: c.collectCount,
          shareCount: c.shareCount,
        },
      }))

    if (transcripts.length === 0) {
      const reason = '没有可分析的转录文本'
      if (skipNoTranscript) {
        console.log('⚠️  跳过: 没有转录文本')
        skippedCount++
      } else {
        console.warn('⚠️  无法分析: 没有转录文本')
        failures.push({ merchantId: merchant.id, merchantName: merchant.name, reason })
      }
      continue
    }

    // 构建请求
    const request: AIAnalysisRequest = {
      merchantId: merchant.id,
      merchantName: merchant.name,
      transcripts,
      basicStats: {
        category: merchant.category ?? undefined,
        location: merchant.location ?? undefined,
        businessType: merchant.businessType,
        totalContentCount: merchant.totalContentCount,
        totalEngagement:
          merchant.totalDiggCount +
          merchant.totalCommentCount +
          merchant.totalCollectCount +
          merchant.totalShareCount,
      },
      analysisDepth,
    }

    // 执行分析
    const response = await performAIDeepAnalysis(request)

    if (response.success && response.report) {
      reports.push(response.report)
    } else {
      console.error(`❌ 分析失败: ${response.error}`)
      failures.push({
        merchantId: merchant.id,
        merchantName: merchant.name,
        reason: response.error || '未知错误',
      })
    }

    // 避免API速率限制，延迟2秒
    if (i < merchants.length - 1) {
      console.log('⏳ 等待2秒...')
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  console.log(`\n✅ 批量分析完成`)
  console.log(`   - 成功: ${reports.length}`)
  console.log(`   - 跳过: ${skippedCount}`)
  if (failures.length > 0) {
    console.log(`   - 失败: ${failures.length}`)
    failures.forEach((failure) => {
      console.log(
        `     • ${failure.merchantName} (${failure.merchantId}): ${failure.reason}`
      )
    })
  } else {
    console.log('   - 失败: 0')
  }

  return reports
}
