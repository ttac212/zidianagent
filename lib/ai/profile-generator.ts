/**
 * 商家创作档案 - AI生成核心逻辑
 *
 * 功能:
 * - 生成商家创作Brief(创作简报)
 * - 分析爆款内容特征
 * - 提供创作指南和建议
 *
 * 基于2025年抖音短视频创作真实需求设计
 */

import { prisma } from '@/lib/prisma'
import { parseProfileResponse } from '@/lib/ai/profile-parser'
import { calculateContentMetrics, getQualityLevel } from '@/lib/utils/content-metrics'
import { detectFraud } from '@/lib/utils/fraud-detection'
import { analyzeContentQualityBatch, type AnalysisProgressCallback } from '@/lib/ai/content-analyzer'
import { buildLLMRequestAuto } from '@/lib/ai/request-builder'
import { validateTranscriptsBatch, shouldTranscribeBeforeProfile } from '@/lib/utils/transcript-validator'
import { TranscriptionRequiredError } from '@/lib/errors/transcription-errors'

// 使用Claude Opus 4.5模型(ZenMux API)
const MODEL_ID = 'anthropic/claude-opus-4.5'

// AI分析缓存有效期（天）
const CACHE_VALID_DAYS = 7

/**
 * 检查AI分析缓存是否有效
 */
function isCacheValid(
  cachedAnalysis: string | null | undefined,
  cachedAt: Date | string | null | undefined,
  validDays = CACHE_VALID_DAYS
): boolean {
  if (!cachedAnalysis || !cachedAt) return false
  const threshold = new Date(Date.now() - validDays * 24 * 60 * 60 * 1000)
  return new Date(cachedAt) > threshold
}

// 注意：不在模块顶层读取环境变量，避免在模块加载时环境变量尚未初始化的问题
function getApiConfig() {
  return {
    apiBase: process.env.ZENMUX_API_BASE || 'https://zenmux.ai/api/v1',
    apiKey: process.env.ZENMUX_API_KEY || ''
  }
}

/**
 * 档案生成进度事件类型
 */
export type ProfileGenerateEvent =
  | { type: 'started'; data: { merchantId: string; merchantName: string; totalContents: number } }
  | { type: 'step'; data: { step: string; status: 'started' | 'completed'; message: string } }
  | { type: 'content_analysis'; data: { current: number; total: number; contentId: string; contentTitle: string; status: 'started' | 'completed' | 'failed' } }
  | { type: 'profile_generating'; data: { message: string } }
  | { type: 'done'; data: { profile: any; tokensUsed: number; model: string } }
  | { type: 'error'; data: { message: string; code?: string } }
  | { type: 'transcription_required'; data: { total: number; missingCount: number; missingPercentage: number; contentsToTranscribe: Array<{ id: string; title: string }> } }

/**
 * 进度回调函数类型
 */
export type ProfileProgressCallback = (event: ProfileGenerateEvent) => void

/**
 * System Prompt - 定义AI的角色和输出要求
 */
const SYSTEM_PROMPT = `你是抖音短视频文案创作专家。
任务：为创作者生成商家创作简报(Brief)，让他们快速了解商家并创作爆款脚本。

【数据理解规则】
1. 互动率质量判断：
   - 评论率≥0.5% + 分享率≥0.3% → 真实高质量内容，重点参考
   - 点赞率>10% + 评论率<0.3% → 疑似刷量，降低权重
   - 分享率高 → 用户认为内容有价值，值得传播
   - 标注"⚠️ 疑似刷量"的内容：明确指出但不完全排除参考

2. AI质量分析理解：
   - "开头质量：高"：有吸引力的开头，优先作为黄金3秒模板
   - "情绪点"：判断内容主打什么情绪（笑点/痛点/爽点/知识点）
   - "痛点"和"需求"：理解用户真正的需求
   - "综合评分"：AI对内容整体质量的评判

3. 爆款识别优先级：
   - 第一优先：AI质量评分高 + 评论率高 + 分享率高 + 无刷量嫌疑
   - 第二优先：互动率均衡，真实数据
   - 第三优先：单一指标突出但其他指标正常

输出要求：
1. 基于**真实互动率**（评论率+分享率）和**AI质量分析**识别爆款
2. 黄金3秒模板必须来自"开头质量：高"的内容
3. 如发现刷量内容，在分析中说明但不必完全排除
4. 如果数据不足(内容数<5)，明确指出并给有限建议
5. 必须严格按照JSON格式输出，便于程序解析
6. 只输出JSON，不要额外的解释文字`

/**
 * 生成商家档案的主函数（支持进度回调和中断）
 * @param merchantId 商家ID
 * @param onProgress 进度回调函数（可选，用于SSE流式输出）
 * @param signal 中断信号（可选，用于取消生成）
 */
export async function generateMerchantProfile(
  merchantId: string,
  onProgress?: ProfileProgressCallback,
  signal?: AbortSignal
) {
  try {
    console.info('[ProfileGenerator] 开始生成档案:', merchantId)

    // 检查是否已中断
    if (signal?.aborted) {
      throw new Error('生成被取消')
    }

    // 1. 获取商家和TOP10内容
    onProgress?.({ type: 'step', data: { step: 'fetch_merchant', status: 'started', message: '正在获取商家信息...' } })
    const merchant = await fetchMerchantWithContents(merchantId)

    if (!merchant) {
      throw new Error('商家不存在')
    }

    if (merchant.totalContentCount === 0) {
      throw new Error('商家暂无内容,无法生成档案')
    }

    onProgress?.({ type: 'started', data: { merchantId, merchantName: merchant.name, totalContents: merchant.contents?.length || 0 } })
    onProgress?.({ type: 'step', data: { step: 'fetch_merchant', status: 'completed', message: `已获取商家信息: ${merchant.name}` } })

    // 检查是否已中断
    if (signal?.aborted) {
      throw new Error('生成被取消')
    }

    // 1.5. 检查转录状态（新增）
    onProgress?.({ type: 'step', data: { step: 'validate_transcripts', status: 'started', message: '正在验证转录状态...' } })
    console.info('[ProfileGenerator] 检查转录状态...')
    const validationResult = validateTranscriptsBatch(
      (merchant.contents || []).map(c => ({
        id: c.id,
        title: c.title,
        transcript: c.transcript
      }))
    )

    console.info('[ProfileGenerator] 转录状态:', {
      total: validationResult.total,
      valid: validationResult.validCount,
      missing: validationResult.missingCount,
      invalid: validationResult.invalidCount,
      percentage: validationResult.missingPercentage.toFixed(1) + '%'
    })

    // 如果缺失比例≥30%，抛出TranscriptionRequiredError
    if (shouldTranscribeBeforeProfile(validationResult, 30)) {
      console.warn('[ProfileGenerator] 转录缺失过多，需要先转录')
      const transcriptionData = {
        total: validationResult.total,
        missingCount: validationResult.needsTranscriptionCount,
        missingPercentage: validationResult.missingPercentage,
        contentsToTranscribe: validationResult.needsTranscription
      }
      onProgress?.({ type: 'transcription_required', data: transcriptionData })
      throw new TranscriptionRequiredError(transcriptionData)
    }

    onProgress?.({ type: 'step', data: { step: 'validate_transcripts', status: 'completed', message: `转录验证完成，有效内容: ${validationResult.validCount}/${validationResult.total}` } })

    // 检查是否已中断
    if (signal?.aborted) {
      throw new Error('生成被取消')
    }

    // 2. AI分析TOP10内容质量（批量并发，带缓存优化）
    const cachedCount = (merchant.contents || []).filter((c: any) =>
      isCacheValid(c.cachedAIAnalysis, c.cachedAnalysisAt)
    ).length
    const totalCount = merchant.contents?.length || 0
    const needAnalysisCount = totalCount - cachedCount

    // 根据缓存情况调整提示消息
    const analysisMessage = cachedCount > 0
      ? `正在进行AI内容质量分析...（${cachedCount}条使用缓存，${needAnalysisCount}条需要分析）`
      : '正在进行AI内容质量分析...'
    onProgress?.({ type: 'step', data: { step: 'content_analysis', status: 'started', message: analysisMessage } })
    console.info('[ProfileGenerator] 开始AI内容质量分析...')

    // 创建内容分析进度回调
    const analysisProgressCallback: AnalysisProgressCallback = (progress) => {
      onProgress?.({
        type: 'content_analysis',
        data: {
          current: progress.current,
          total: progress.total,
          contentId: progress.contentId,
          contentTitle: progress.contentTitle,
          status: progress.status
        }
      })
    }

    const contentsWithAnalysis = await analyzeContentsQualityWithProgress(merchant.contents || [], analysisProgressCallback, signal)
    const successCount = contentsWithAnalysis.filter(c => c.aiAnalysis).length
    const completionMessage = cachedCount > 0
      ? `AI分析完成，${successCount}条内容（${cachedCount}条来自缓存）`
      : `AI分析完成，成功分析 ${successCount} 条内容`
    console.info('[ProfileGenerator] AI分析完成，成功分析:', successCount, '条')
    onProgress?.({ type: 'step', data: { step: 'content_analysis', status: 'completed', message: completionMessage } })

    // 检查是否已中断
    if (signal?.aborted) {
      throw new Error('生成被取消')
    }

    // 3. 构建Prompt（包含AI分析结果）
    onProgress?.({ type: 'profile_generating', data: { message: '正在生成商家创作简报...' } })
    const userPrompt = buildUserPrompt(merchant, contentsWithAnalysis)

    console.info('[ProfileGenerator] Prompt长度:', userPrompt.length)

    // 4. 调用LLM API生成档案
    const aiResponse = await callLLMAPI(userPrompt, signal)

    // 检查是否已中断
    if (signal?.aborted) {
      throw new Error('生成被取消')
    }

    console.info('[ProfileGenerator] AI响应长度:', aiResponse.content.length)
    console.info('[ProfileGenerator] Token使用:', aiResponse.usage)

    // 5. 解析响应
    const parsed = parseProfileResponse(aiResponse.content)

    // 6. 保存到数据库
    const profile = await prisma.merchantProfile.upsert({
      where: { merchantId },
      create: {
        merchantId,
        ...parsed,
        aiGeneratedAt: new Date(),
        aiModelUsed: MODEL_ID,
        aiTokenUsed: aiResponse.usage.total_tokens
      },
      update: {
        ...parsed,
        aiGeneratedAt: new Date(),
        aiModelUsed: MODEL_ID,
        aiTokenUsed: aiResponse.usage.total_tokens
        // 注意: 不更新 custom* 字段,保持用户编辑内容
      }
    })

    console.info('[ProfileGenerator] 档案已保存:', profile.id)

    const result = {
      profile,
      tokensUsed: aiResponse.usage.total_tokens,
      model: MODEL_ID
    }

    onProgress?.({ type: 'done', data: result })

    return result

  } catch (error) {
    console.error('[ProfileGenerator] 生成失败:', error)
    // 不在这里推送error事件，由调用方统一处理，避免重复推送
    throw error
  }
}

/**
 * AI分析内容质量（带进度回调、中断支持和缓存优化）
 *
 * 优化策略：
 * 1. 优先使用数据库缓存的分析结果（7天内有效）
 * 2. 只对缺失缓存或缓存过期的内容调用AI分析
 * 3. 分析完成后将结果写入缓存
 */
async function analyzeContentsQualityWithProgress(
  contents: any[],
  onProgress?: AnalysisProgressCallback,
  signal?: AbortSignal
) {
  if (contents.length === 0) return []

  const now = new Date()

  // 分离有缓存和需要分析的内容
  const cachedContents: any[] = []
  const needsAnalysis: any[] = []

  for (const c of contents) {
    if (isCacheValid(c.cachedAIAnalysis, c.cachedAnalysisAt)) {
      try {
        const cached = JSON.parse(c.cachedAIAnalysis)
        cachedContents.push({ ...c, aiAnalysis: cached })
        console.info(`[ProfileGenerator] 使用缓存分析: ${c.title.substring(0, 20)}...`)
      } catch {
        needsAnalysis.push(c)
      }
    } else {
      needsAnalysis.push(c)
    }
  }

  console.info(`[ProfileGenerator] 分析缓存命中: ${cachedContents.length}/${contents.length}，需分析: ${needsAnalysis.length}`)

  // 如果所有内容都有缓存，直接返回
  if (needsAnalysis.length === 0) {
    for (let i = 0; i < cachedContents.length; i++) {
      onProgress?.({
        current: i + 1,
        total: cachedContents.length,
        contentId: cachedContents[i].id,
        contentTitle: cachedContents[i].title,
        status: 'completed'
      })
    }
    return cachedContents
  }

  // 准备需要分析的数据
  const analysisInput = needsAnalysis.map(c => ({
    id: c.id,
    title: c.title,
    transcript: c.transcript
  }))

  // 批量调用AI分析（并发控制=10，带进度回调和中断支持）
  const analysisResults = await analyzeContentQualityBatch(analysisInput, 10, onProgress, signal)

  // 将分析结果写入数据库缓存（并发控制，最多3个同时写入）
  const writeCache = async (contentId: string, analysis: any) => {
    try {
      await prisma.merchantContent.update({
        where: { id: contentId },
        data: {
          cachedAIAnalysis: JSON.stringify(analysis),
          cachedAnalysisAt: now
        }
      })
      return { id: contentId, success: true }
    } catch (err) {
      console.warn(`[ProfileGenerator] 缓存写入失败: ${contentId}`, err)
      return { id: contentId, success: false, error: err }
    }
  }

  // 使用 Promise.allSettled 并发写入，收集失败结果
  const cacheWritePromises = needsAnalysis
    .filter(c => analysisResults.has(c.id))
    .map(c => writeCache(c.id, analysisResults.get(c.id)))

  // 异步执行缓存写入，但跟踪失败数量
  Promise.allSettled(cacheWritePromises).then(results => {
    const failed = results.filter(r =>
      r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
    )
    if (failed.length > 0) {
      console.warn(`[ProfileGenerator] ${failed.length}/${results.length} 条分析结果缓存写入失败`)
    }
  })

  // 合并分析结果（已缓存 + 新分析）
  const analyzedContents = needsAnalysis.map(c => ({
    ...c,
    aiAnalysis: analysisResults.get(c.id) || null
  }))

  return [...cachedContents, ...analyzedContents]
}

/**
 * 获取商家及其TOP10内容
 */
async function fetchMerchantWithContents(merchantId: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: {
      category: true,
      contents: {
        // 按互动评分排序: 点赞 + 评论*2 + 收藏*3 + 分享*4
        orderBy: [
          { diggCount: 'desc' },
          { commentCount: 'desc' },
          { collectCount: 'desc' }
        ],
        take: 10
      }
    }
  })

  return merchant
}

/**
 * 构建用户Prompt
 */
function buildUserPrompt(merchant: any, contentsWithAnalysis: any[]): string {
  const top10Contents = contentsWithAnalysis || []

  // 构建TOP10内容详细信息
  const contentsDetail = top10Contents.map((c: any, idx: number) => {
    // 解析tags
    let tags: string[] = []
    try {
      const parsedTags = JSON.parse(c.tags || '[]')
      tags = Array.isArray(parsedTags)
        ? parsedTags.map((t: any) => t.tag_name || t).filter(Boolean)
        : []
    } catch {
      // 忽略解析错误
    }

    // 获取前3秒文案
    const opening = c.transcript ? c.transcript.substring(0, 100) : '(无转录)'

    // ✅ 计算互动率
    const metrics = calculateContentMetrics({
      playCount: c.playCount || 0,
      diggCount: c.diggCount,
      commentCount: c.commentCount,
      shareCount: c.shareCount,
      collectCount: c.collectCount
    })

    const likeRate = metrics.likeRate !== null ? metrics.likeRate.toFixed(2) : 'N/A'
    const commentRate = metrics.commentRate !== null ? metrics.commentRate.toFixed(3) : 'N/A'
    const shareRate = metrics.shareRate !== null ? metrics.shareRate.toFixed(3) : 'N/A'

    // ✅ 质量等级判断
    const qualityLevel = getQualityLevel(metrics)

    // ✅ 刷量检测
    let fraudWarning = ''
    if (c.playCount > 0) {
      const fraudResult = detectFraud(
        {
          playCount: c.playCount,
          diggCount: c.diggCount,
          commentCount: c.commentCount,
          shareCount: c.shareCount,
          collectCount: c.collectCount
        },
        []
      )

      if (fraudResult.isSuspicious) {
        fraudWarning = `\n- ⚠️ 刷量警告: ${fraudResult.reason}`
      }
    }

    // ✅ AI质量分析结果
    let aiAnalysisText = ''
    if (c.aiAnalysis) {
      const analysis = c.aiAnalysis
      aiAnalysisText = `
- AI质量分析:
  * 开头质量: ${analysis.openingQuality.score}/10 (${analysis.openingQuality.level === 'high' ? '高' : analysis.openingQuality.level === 'medium' ? '中' : '低'}) - ${analysis.openingQuality.reason}
  * 情绪点: ${translateEmotionType(analysis.emotionalTrigger.primary)} (强度${analysis.emotionalTrigger.intensity}/10) - ${analysis.emotionalTrigger.description}
  * 痛点: ${analysis.painPoints.length > 0 ? analysis.painPoints.join('、') : '无'}
  * 用户需求: ${analysis.userNeeds.length > 0 ? analysis.userNeeds.join('、') : '无'}
  * 内容节奏: ${translatePace(analysis.contentRhythm.pace)}，节奏变化${translateVariety(analysis.contentRhythm.variety)}
  * 综合评分: ${analysis.overallQuality.score}/100
  * 优点: ${analysis.overallQuality.strengths.join('、')}
  ${analysis.overallQuality.weaknesses.length > 0 ? `* 缺点: ${analysis.overallQuality.weaknesses.join('、')}` : ''}`
    }

    return `[第${idx + 1}名]
- 标题: ${c.title}
- 前3秒文案: ${opening}
- 播放量: ${(c.playCount || 0).toLocaleString()}
- 互动率: 赞${likeRate}% | 评${commentRate}% | 转${shareRate}%
- 质量评估: ${qualityLevel.label} (${qualityLevel.description})${fraudWarning}${aiAnalysisText}
- 标签: ${tags.join(', ') || '无'}
- 时长: ${c.duration || '未知'}
- 发布时间: ${c.publishedAt ? new Date(c.publishedAt).toLocaleDateString() : '未知'}
- 内容类型: ${c.contentType}
`
  }).join('\n')

  return `请为以下商家生成创作简报(Brief)：

**商家基本信息**
- 名称：${merchant.name}
- 业务类型：${merchant.businessType}
- 地区：${merchant.location || '未知'}
- 分类：${merchant.category?.name || '未分类'}
- 总内容数：${merchant.totalContentCount}
- 总点赞：${merchant.totalDiggCount.toLocaleString()}
- 总评论：${merchant.totalCommentCount.toLocaleString()}
- 总分享：${merchant.totalShareCount.toLocaleString()}

**TOP10爆款内容（含AI质量分析）**
${contentsDetail}

请按以下结构分析：

## 数据分析注意事项
1. 优先参考"质量评估: ✅ 高质量"且"AI综合评分"高的内容
2. 对于标注"⚠️ 刷量警告"的内容，在分析中说明原因但不必完全排除
3. 利用AI分析的"痛点"和"用户需求"来完善使用场景

## 商家Brief（创作简报）
- intro: 3句话介绍(字符串格式,用空格连接。第1句:是谁;第2句:做什么;第3句:特点)
- sellingPoints: 核心卖点(字符串数组,3-5个)
- usageScenarios: 使用场景+解决的痛点(字符串数组,结合AI分析的痛点)
- audienceProfile: 目标用户画像(对象:{age,gender,interests[],behaviors})
- brandTone: 品牌调性(字符串)

输出JSON格式(严格遵循结构)：
{
  "brief": {
    "intro": "...",
    "sellingPoints": [...],
    "usageScenarios": [...],
    "audienceProfile": {...},
    "brandTone": "..."
  }
}

注意：
1. 数据不足时填null或空数组
2. 只输出JSON，不要其他文字`
}

// 辅助函数：翻译情绪类型
function translateEmotionType(type: string): string {
  const map: Record<string, string> = {
    'humor': '幽默搞笑',
    'pain': '痛点共鸣',
    'satisfaction': '爽点满足',
    'knowledge': '知识获得',
    'curiosity': '好奇悬念',
    'other': '其他'
  }
  return map[type] || type
}

// 辅助函数：翻译节奏
function translatePace(pace: string): string {
  const map: Record<string, string> = {
    'fast': '快节奏',
    'medium': '中等节奏',
    'slow': '慢节奏'
  }
  return map[pace] || pace
}

// 辅助函数：翻译节奏变化
function translateVariety(variety: string): string {
  const map: Record<string, string> = {
    'high': '丰富',
    'medium': '适中',
    'low': '单一'
  }
  return map[variety] || variety
}

/**
 * 调用LLM API (ZenMux) - 使用结构化输出
 */
async function callLLMAPI(userPrompt: string, signal?: AbortSignal) {
  const { apiBase, apiKey } = getApiConfig()

  if (!apiKey) {
    throw new Error('未配置ZENMUX_API_KEY')
  }

  // 超时控制：180秒（生成档案内容较多，需要更长时间）
  const TIMEOUT_MS = 180000
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => {
    console.warn('[ProfileGenerator] 请求超时，正在取消...')
    timeoutController.abort()
  }, TIMEOUT_MS)

  // 合并外部 signal 和超时 signal
  const abortHandler = () => {
    clearTimeout(timeoutId)
    timeoutController.abort()
  }
  if (signal) {
    signal.addEventListener('abort', abortHandler)
  }

  try {
    // 使用统一的请求构建函数，自动处理ZenMux参数规范
    const requestBody = buildLLMRequestAuto({
      model: MODEL_ID,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
    maxTokens: 30000,
    temperature: 0.7,
    // 使用结构化输出确保返回格式严格符合schema
    responseFormat: {
      type: 'json_schema',
      json_schema: {
        name: 'merchant_profile',
        description: '商家创作档案数据结构',
        schema: {
          type: 'object',
          properties: {
            brief: {
              type: 'object',
              properties: {
                intro: {
                  type: 'string',
                  description: '3句话商家介绍(合并为一个字符串)'
                },
                sellingPoints: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '核心卖点列表'
                },
                usageScenarios: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '使用场景列表'
                },
                audienceProfile: {
                  type: 'object',
                  properties: {
                    age: { type: 'string' },
                    gender: { type: 'string' },
                    interests: {
                      type: 'array',
                      items: { type: 'string' }
                    },
                    behaviors: { type: 'string' }
                  },
                  required: ['age', 'gender', 'interests', 'behaviors']
                },
                brandTone: { type: 'string' }
              },
              required: ['intro', 'sellingPoints', 'usageScenarios', 'audienceProfile', 'brandTone']
            }
          },
          required: ['brief'],
          additionalProperties: false
        }
      }
    }
  });

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: timeoutController.signal // 使用超时控制的 signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[ProfileGenerator] API错误:', response.status, errorText)
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
  } finally {
    clearTimeout(timeoutId)
    if (signal) {
      signal.removeEventListener('abort', abortHandler)
    }
  }
}
