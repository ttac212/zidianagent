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

// 使用grok-4-fast模型(ZenMux API,速度快成本低)
const MODEL_ID = 'anthropic/claude-sonnet-4.5'
const API_BASE = process.env.ZENMUX_API_BASE || 'https://zenmux.ai/api/v1'
const API_KEY = process.env.ZENMUX_API_KEY || ''

/**
 * System Prompt - 定义AI的角色和输出要求
 */
const SYSTEM_PROMPT = `你是抖音短视频文案创作专家。
任务：为创作者生成商家创作简报(Brief)，让他们快速了解商家并创作爆款脚本。

输出要求：
1. 基于数据给出具体分析，不要泛泛而谈
2. 黄金3秒模板必须是可直接套用的完整句子
3. 如果数据不足(内容数<5)，明确指出并给有限建议
4. 必须严格按照JSON格式输出，便于程序解析
5. 只输出JSON，不要额外的解释文字`

/**
 * 生成商家档案的主函数
 */
export async function generateMerchantProfile(merchantId: string) {
  try {
    console.log('[ProfileGenerator] 开始生成档案:', merchantId)

    // 1. 获取商家和TOP10内容
    const merchant = await fetchMerchantWithContents(merchantId)

    if (!merchant) {
      throw new Error('商家不存在')
    }

    if (merchant.totalContentCount === 0) {
      throw new Error('商家暂无内容,无法生成档案')
    }

    // 2. 构建Prompt
    const userPrompt = buildUserPrompt(merchant)

    console.log('[ProfileGenerator] Prompt长度:', userPrompt.length)

    // 3. 调用LLM API
    const aiResponse = await callLLMAPI(userPrompt)

    console.log('[ProfileGenerator] AI响应长度:', aiResponse.content.length)
    console.log('[ProfileGenerator] Token使用:', aiResponse.usage)

    // 4. 解析响应
    const parsed = parseProfileResponse(aiResponse.content)

    // 5. 保存到数据库
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

    console.log('[ProfileGenerator] 档案已保存:', profile.id)

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
function buildUserPrompt(merchant: any): string {
  const top10Contents = merchant.contents || []

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

    // 计算互动总数
    const engagement = c.diggCount + c.commentCount + c.collectCount + c.shareCount

    return `[第${idx + 1}名]
- 标题: ${c.title}
- 前3秒文案: ${opening}
- 互动数据: 赞${c.diggCount} | 评${c.commentCount} | 藏${c.collectCount} | 转${c.shareCount}
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

**TOP10爆款内容**
${contentsDetail}

请按以下结构分析：

## 1. 商家Brief
- intro: 3句话介绍(字符串格式,用空格连接。第1句:是谁;第2句:做什么;第3句:特点)
- sellingPoints: 核心卖点(字符串数组,3-5个)
- usageScenarios: 使用场景+解决的痛点(字符串数组)
- audienceProfile: 目标用户画像(对象:{age,gender,interests[],behaviors})
- brandTone: 品牌调性(字符串)

## 2. 爆款分析
- topContents: TOP5内容分析(标题/开头/情绪点/形式/互动数)
- goldenThreeSeconds: 3个可直接套用的黄金开头模板
- emotionalTriggers: 情绪点分布(humor/pain/satisfaction/knowledge，百分比相加=100)
- contentFormats: 内容形式分布(monologue/drama/comparison/tutorial，百分比相加=100)

## 3. 创作指南
- trendingTopics: 当前适合的热点话题
- tagStrategy: 标签组合策略(说明原因)
- publishingTips: 发布策略(bestTime/frequency)

输出JSON格式(严格遵循结构)：
{
  "brief": { ... },
  "viralAnalysis": { ... },
  "creativeGuide": { ... }
}

注意：
1. 所有百分比相加必须=100
2. 黄金3秒模板必须是完整可用的句子
3. 数据不足时填null或空数组
4. 只输出JSON，不要其他文字`
}

/**
 * 调用LLM API (ZenMux) - 使用结构化输出
 */
async function callLLMAPI(userPrompt: string) {
  if (!API_KEY) {
    throw new Error('未配置ZENMUX_API_KEY')
  }

  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL_ID,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 30000,
      temperature: 0.7,
      // 使用结构化输出确保返回格式严格符合schema
      response_format: {
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
              },
              viralAnalysis: {
                type: 'object',
                properties: {
                  topContents: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        rank: { type: 'number' },
                        title: { type: 'string' },
                        opening: { type: 'string' },
                        emotionType: { type: 'string' },
                        format: { type: 'string' },
                        engagement: { type: 'number' }
                      },
                      required: ['rank', 'title', 'opening', 'emotionType', 'format', 'engagement']
                    }
                  },
                  goldenThreeSeconds: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '黄金3秒开头模板'
                  },
                  emotionalTriggers: {
                    type: 'object',
                    additionalProperties: { type: 'number' },
                    description: '情绪点百分比(humor/pain/satisfaction/knowledge)'
                  },
                  contentFormats: {
                    type: 'object',
                    additionalProperties: { type: 'number' },
                    description: '内容形式百分比(monologue/drama/comparison/tutorial)'
                  }
                },
                required: ['topContents', 'goldenThreeSeconds', 'emotionalTriggers', 'contentFormats']
              },
              creativeGuide: {
                type: 'object',
                properties: {
                  trendingTopics: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '热门话题列表'
                  },
                  tagStrategy: {
                    oneOf: [
                      { type: 'string' },
                      { type: 'object' }
                    ],
                    description: '标签组合策略(字符串或对象格式)'
                  },
                  publishingTips: {
                    type: 'object',
                    properties: {
                      bestTime: { type: 'string' },
                      frequency: { type: 'string' }
                    },
                    required: ['bestTime', 'frequency']
                  }
                },
                required: ['trendingTopics', 'tagStrategy', 'publishingTips']
              }
            },
            required: ['brief', 'viralAnalysis', 'creativeGuide'],
            additionalProperties: false
          }
        }
      }
    })
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
