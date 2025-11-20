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
import { analyzeContentQualityBatch } from '@/lib/ai/content-analyzer'
import { buildLLMRequestAuto } from '@/lib/ai/request-builder'

// 使用grok-4-fast模型(ZenMux API,速度快成本低)
const MODEL_ID = 'anthropic/claude-sonnet-4.5'
const API_BASE = process.env.ZENMUX_API_BASE || 'https://zenmux.ai/api/v1'
const API_KEY = process.env.ZENMUX_API_KEY || ''

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
 * 生成商家档案的主函数
 */
export async function generateMerchantProfile(merchantId: string) {
  try {
    console.info('[ProfileGenerator] 开始生成档案:', merchantId)

    // 1. 获取商家和TOP10内容
    const merchant = await fetchMerchantWithContents(merchantId)

    if (!merchant) {
      throw new Error('商家不存在')
    }

    if (merchant.totalContentCount === 0) {
      throw new Error('商家暂无内容,无法生成档案')
    }

    // 2. AI分析TOP10内容质量（批量并发）
    console.info('[ProfileGenerator] 开始AI内容质量分析...')
    const contentsWithAnalysis = await analyzeContentsQuality(merchant.contents || [])
    console.info('[ProfileGenerator] AI分析完成，成功分析:', contentsWithAnalysis.filter(c => c.aiAnalysis).length, '条')

    // 3. 构建Prompt（包含AI分析结果）
    const userPrompt = buildUserPrompt(merchant, contentsWithAnalysis)

    console.info('[ProfileGenerator] Prompt长度:', userPrompt.length)

    // 4. 调用LLM API生成档案
    const aiResponse = await callLLMAPI(userPrompt)

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

    return {
      profile,
      tokensUsed: aiResponse.usage.total_tokens,
      model: MODEL_ID
    }

  } catch (error) {
    console.error('[ProfileGenerator] 生成失败:', error)
    throw error
  }
}

/**
 * AI分析内容质量（批量）
 */
async function analyzeContentsQuality(contents: any[]) {
  if (contents.length === 0) return []

  // 准备分析数据
  const analysisInput = contents.map(c => ({
    id: c.id,
    title: c.title,
    transcript: c.transcript
  }))

  // 批量调用AI分析（并发控制=3）
  const analysisResults = await analyzeContentQualityBatch(analysisInput, 3)

  // 合并分析结果
  return contents.map(c => ({
    ...c,
    aiAnalysis: analysisResults.get(c.id) || null
  }))
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
async function callLLMAPI(userPrompt: string) {
  if (!API_KEY) {
    throw new Error('未配置ZENMUX_API_KEY')
  }

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

  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
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
}
