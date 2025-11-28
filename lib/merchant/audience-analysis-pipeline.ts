/**
 * 商家客群分析 Pipeline
 * 聚合多个TOP视频的评论数据，分析客群画像
 *
 * 架构复用：
 * - 基于 lib/douyin/comments-pipeline.ts 的成熟架构
 * - 使用 TikHub API 实时获取评论（包含 ip_label 地域数据）
 * - SSE流式输出分析进度
 * - 结果持久化到 MerchantAudienceAnalysis 表
 */

import { prisma } from '@/lib/prisma'
import { getTikHubClient } from '@/lib/tikhub'
import type { DouyinComment } from '@/lib/tikhub/types'

// Pipeline 步骤定义
export const AUDIENCE_ANALYSIS_STEPS = [
  { key: 'select-videos', label: '选择TOP视频', description: '按评论数选择要分析的视频' },
  { key: 'fetch-comments', label: '采集评论', description: '从TikHub API获取评论数据' },
  { key: 'aggregate-data', label: '聚合数据', description: '统计地域分布和评论特征' },
  { key: 'analyze-audience', label: 'AI分析', description: 'LLM智能分析客群画像' },
  { key: 'save-result', label: '保存结果', description: '持久化到数据库' }
] as const

export type AudienceAnalysisStep = (typeof AUDIENCE_ANALYSIS_STEPS)[number]['key']
export type AudienceAnalysisStepStatus = 'pending' | 'active' | 'completed' | 'error'

export interface AudienceAnalysisProgress {
  step: AudienceAnalysisStep
  status: AudienceAnalysisStepStatus
  index: number
  total: number
  percentage: number
  detail?: string
  label: string
  description: string
}

export interface LocationStat {
  location: string
  count: number
  percentage: number
}

export interface CleanedComment {
  user: string
  text: string
  likes: number
  location: string
}

export interface VideoCommentStats {
  videoId: string
  title: string
  commentCount: number
  comments: CleanedComment[]
}

// Pipeline 事件类型
export interface AudienceAnalysisProgressEvent extends AudienceAnalysisProgress {
  type: 'progress'
}

export interface AudienceAnalysisInfoEvent {
  type: 'info'
  merchantId: string
  merchantName: string
  videosSelected: number
}

export interface AudienceAnalysisPartialEvent {
  type: 'partial'
  key: 'analysis'
  data: string
  append?: boolean
}

interface AudienceAnalysisStructuredFields {
  audienceProfile: Record<string, any> | null
  demographics: Record<string, any> | null
  behaviors: Record<string, any> | null
  interests: Record<string, any> | null
  painPoints: Record<string, any> | null
  suggestions: Record<string, any> | null
}

export interface AudienceAnalysisDoneEvent extends AudienceAnalysisStructuredFields {
  type: 'done'
  analysisId: string
  markdown: string
  videosAnalyzed: number
  commentsAnalyzed: number
  locationStats: LocationStat[]
  modelUsed: string  // ✅ 添加：使用的模型ID
  tokenUsed: number  // ✅ 添加：Token消耗
  analyzedAt: string  // ✅ 添加：分析时间 (ISO string)
}

export interface AudienceAnalysisErrorEvent {
  type: 'error'
  message: string
  step?: AudienceAnalysisStep
  cause?: unknown
}

export type AudienceAnalysisPipelineEvent =
  | AudienceAnalysisProgressEvent
  | AudienceAnalysisInfoEvent
  | AudienceAnalysisPartialEvent
  | AudienceAnalysisDoneEvent
  | AudienceAnalysisErrorEvent

export type AudienceAnalysisPipelineEmitter = (
  event: AudienceAnalysisPipelineEvent
) => void | Promise<void>

export interface AudienceAnalysisPipelineOptions {
  signal?: AbortSignal
  topN?: number               // 分析TOP N个视频，默认5
  maxCommentsPerVideo?: number // 每个视频最多采集评论数，默认100
  fastMode?: boolean          // 快速模式：使用更快的Haiku模型
}

export interface AudienceAnalysisPipelineResult {
  analysisId: string
  markdown: string
  videosAnalyzed: number
  commentsAnalyzed: number
  locationStats: LocationStat[]
}

class AudienceAnalysisPipelineAbortError extends Error {
  constructor() {
    super('Audience analysis pipeline aborted')
    this.name = 'AbortError'
  }
}

export class AudienceAnalysisPipelineStepError extends Error {
  constructor(
    message: string,
    public step: AudienceAnalysisStep,
    public cause?: unknown
  ) {
    super(message)
    this.name = 'AudienceAnalysisPipelineStepError'
  }
}

function ensureActive(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new AudienceAnalysisPipelineAbortError()
  }
}

async function emitProgress(
  emit: AudienceAnalysisPipelineEmitter,
  step: AudienceAnalysisStep,
  status: AudienceAnalysisStepStatus,
  detail?: string
) {
  const index = AUDIENCE_ANALYSIS_STEPS.findIndex((item) => item.key === step)

  if (index === -1) {
    return
  }

  const total = AUDIENCE_ANALYSIS_STEPS.length
  const completedSteps = status === 'completed' ? index + 1 : index
  const percentage = Math.max(
    0,
    Math.min(100, Math.round((completedSteps / total) * 100))
  )

  const progressEvent: AudienceAnalysisProgressEvent = {
    type: 'progress',
    step,
    status,
    index,
    total,
    percentage,
    detail,
    label: AUDIENCE_ANALYSIS_STEPS[index].label,
    description: AUDIENCE_ANALYSIS_STEPS[index].description
  }

  await emit(progressEvent)
}

/**
 * 清理评论文本中的表情符号
 */
function cleanCommentText(text: string): string {
  return text.replace(/\[.*?\]/g, '').trim()
}

/**
 * 调用 LLM 分析客群画像
 * 使用统一的 LLM 客户端
 */
async function analyzeAudienceWithLLM(
  merchantName: string,
  videoStats: VideoCommentStats[],
  locationStats: LocationStat[],
  allComments: CleanedComment[],
  modelId: string,
  emit: AudienceAnalysisPipelineEmitter,
  signal?: AbortSignal
): Promise<string> {
  const { callLLMStreamWithTimeout } = await import('@/lib/ai/llm-client')

  // 构建分析提示词
  const prompt = `请分析以下抖音商家的客群画像，基于多个热门视频的评论数据：

**商家信息**
- 商家名称: ${merchantName}
- 分析视频数: ${videoStats.length}个
- 评论样本总数: ${allComments.length}条

**TOP视频概览**
${videoStats.map((v, i) => `${i + 1}. ${v.title} - ${v.commentCount}条评论`).join('\n')}

**地域分布TOP10**
${locationStats.slice(0, 10).map(({ location, count, percentage }) =>
  `- ${location}: ${count}条 (${percentage.toFixed(1)}%)`
).join('\n')}

**评论样本（展示前50条代表性评论）**
${allComments.slice(0, 50).map((c, i) => {
  const location = c.location ? ` [${c.location}]` : ''
  return `${i + 1}. ${c.user}${location}: ${c.text}`
}).join('\n')}

请按以下维度进行深度分析：

## 1. 客群画像概览

- 核心客群特征（用2-3句话总结）
- 主要用户群体画像（简洁表格或分点说明）

## 2. 地域分布分析

- 地域集中度特征
- 不同地区用户的差异化特征
- 地域特点对内容策略的启示（不要列出具体渠道组合）

## 3. 用户需求分析

- 高频咨询问题（按优先级排序）
- 核心购买动机
- 决策关键因素

## 4. 用户行为特征

- 消费心理（价格敏感度、品质要求、风险偏好）
- 典型决策路径
- 互动偏好

## 5. 用户反馈的问题

- 常见疑虑和顾虑
- 产品/服务改进方向

## 6. 内容策略建议

- 内容主题和形式建议（避免过度细节的执行方案）
- 核心目标人群定位
- 内容优化方向（聚焦在内容本身，不要详细的转化话术、定价策略、渠道运营等执行细节）

**输出要求：**
- 使用Markdown格式，结构清晰
- 聚焦客群洞察，避免过度营销化的内容
- 不要输出具体的产品定价、转化话术、渠道运营细节、KPI指标监控等执行层面内容
- 保持分析的深度和专业性，数据和结论要有理有据`

  return callLLMStreamWithTimeout({
    prompt,
    modelId,
    maxTokens: 6000,
    signal,
    onChunk: async (delta) => {
      await emit({
        type: 'partial',
        key: 'analysis',
        data: delta,
        append: true
      })
    }
  }, 180000) // 180秒超时
}

/**
 * 构建 Markdown 格式的分析报告
 */
function buildMarkdown(
  merchantName: string,
  videoStats: VideoCommentStats[],
  locationStats: LocationStat[],
  analysisText: string,
  totalComments: number
): string {
  return [
    '## 商家客群分析报告',
    '',
    '## 基本信息',
    `- **商家**: ${merchantName}`,
    `- **分析视频数**: ${videoStats.length}个`,
    `- **评论样本总数**: ${totalComments}条`,
    '',
    '## TOP视频列表',
    ...videoStats.map((v, i) => `${i + 1}. ${v.title} - ${v.commentCount}条评论`),
    '',
    '## 地域分布TOP10',
    ...locationStats.slice(0, 10).map(({ location, count, percentage }) =>
      `- ${location}: ${count}条 (${percentage.toFixed(1)}%)`
    ),
    '',
    '---',
    '',
    analysisText,
    '',
    '---',
    '',
    '客群分析完成！'
  ].join('\n')
}

/**
 * Token估算（粗略）
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length * 1.5)
}

/**
 * 运行商家客群分析 Pipeline
 */
export async function runAudienceAnalysisPipeline(
  merchantId: string,
  emit: AudienceAnalysisPipelineEmitter,
  options: AudienceAnalysisPipelineOptions = {}
): Promise<AudienceAnalysisPipelineResult> {
  const signal = options.signal
  const topN = options.topN || 5
  const maxCommentsPerVideo = options.maxCommentsPerVideo || 100
  const fastMode = options.fastMode || false

  // 使用统一的配置模块
  const { validateAIConfig, selectModel } = await import('@/lib/config/ai-config')

  let modelId: string
  try {
    validateAIConfig()
    modelId = selectModel(fastMode)
  } catch (error) {
    const err = new AudienceAnalysisPipelineStepError(
      error instanceof Error ? error.message : '配置错误',
      'select-videos'
    )
    await emit({
      type: 'error',
      message: err.message,
      step: err.step
    })
    throw err
  }

  if (fastMode) {
    console.info('[AUDIENCE] 启用快速模式，使用 Haiku 模型')
  }

  try {
    ensureActive(signal)

    // 步骤1: 选择TOP视频
    await emitProgress(emit, 'select-videos', 'active', '正在选择评论数最高的视频...')

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { name: true, uid: true }
    })

    if (!merchant) {
      throw new AudienceAnalysisPipelineStepError(
        `Merchant not found: ${merchantId}`,
        'select-videos'
      )
    }

    // 选择评论数TOP N的视频
    const topVideos = await prisma.merchantContent.findMany({
      where: {
        merchantId,
        commentCount: { gt: 0 }  // 只选择有评论的视频
      },
      orderBy: {
        commentCount: 'desc'
      },
      take: topN,
      select: {
        id: true,
        externalId: true,
        title: true,
        commentCount: true
      }
    })

    if (topVideos.length === 0) {
      throw new AudienceAnalysisPipelineStepError(
        '商家暂无有效的评论数据，无法进行客群分析',
        'select-videos'
      )
    }

    await emit({
      type: 'info',
      merchantId,
      merchantName: merchant.name,
      videosSelected: topVideos.length
    })

    await emitProgress(
      emit,
      'select-videos',
      'completed',
      `已选择${topVideos.length}个热门视频`
    )

    // 步骤2: 采集评论
    await emitProgress(emit, 'fetch-comments', 'active', '正在从TikHub API采集评论...')

    // 显式传入API配置,确保在dotenv加载后正确获取环境变量
    const tikhubClient = getTikHubClient({
      apiKey: process.env.TIKHUB_API_KEY,
      baseURL: process.env.TIKHUB_API_BASE_URL
    })

    // 性能优化：并发采集所有视频的评论
    const fetchVideoComments = async (video: typeof topVideos[0], index: number): Promise<VideoCommentStats | null> => {
      try {
        // 调用 TikHub API 获取评论（包含 ip_label）
        const commentsResponse = await tikhubClient.getVideoComments({
          aweme_id: video.externalId,
          cursor: 0,
          count: Math.min(maxCommentsPerVideo, 20)
        })

        let allComments: DouyinComment[] = commentsResponse.comments || []

        // 分页获取更多评论
        // 注意：只看 has_more 和上限条件，不对 cursor 做布尔判断
        // 因为 cursor=0 是合法值，代表第一页后的游标
        let hasMore = commentsResponse.has_more
        let cursor = commentsResponse.cursor
        let pageCount = 1
        const maxPages = Math.ceil(maxCommentsPerVideo / 20)

        while (hasMore && pageCount < maxPages && allComments.length < maxCommentsPerVideo) {
            ensureActive(signal)

            try {
              const nextPage = await tikhubClient.getVideoComments({
                aweme_id: video.externalId,
                cursor: cursor,
                count: 20
              })

              if (nextPage.comments && nextPage.comments.length > 0) {
                allComments.push(...nextPage.comments)
                pageCount++
              }

              if (!nextPage.has_more) {
                hasMore = false
              } else {
                cursor = nextPage.cursor
              }

              // 减少请求间隔（从500ms降到200ms）
              await new Promise(resolve => setTimeout(resolve, 200))
            } catch (error) {
              console.warn(`采集视频 ${video.title} 的第${pageCount}页评论失败:`, error)
              break
            }
          }

        // 清理评论
        const cleanedComments: CleanedComment[] = allComments
          .slice(0, maxCommentsPerVideo)
          .map(c => {
            const cleanText = cleanCommentText(c.text)
            if (!cleanText || cleanText.length < 2) return null

            return {
              user: c.user.nickname,
              text: cleanText,
              likes: c.digg_count,
              location: c.ip_label || ''  // ⭐ 关键：保留地域信息
            }
          })
          .filter((c): c is CleanedComment => c !== null)

        // 发送单个视频的进度
        await emitProgress(
          emit,
          'fetch-comments',
          'active',
          `正在采集第${index + 1}/${topVideos.length}个视频的评论...`
        )

        return {
          videoId: video.externalId,
          title: video.title,
          commentCount: cleanedComments.length,
          comments: cleanedComments
        }

      } catch (error) {
        console.warn(`采集视频 ${video.title} 的评论失败:`, error)
        return null
      }
    }

    // 并发执行所有视频的评论采集
    const results = await Promise.all(
      topVideos.map((video, index) => fetchVideoComments(video, index))
    )

    // 过滤失败的结果
    const videoStatsArray: VideoCommentStats[] = results.filter((r): r is VideoCommentStats => r !== null)
    const totalCommentsFetched = videoStatsArray.reduce((sum, v) => sum + v.commentCount, 0)

    if (totalCommentsFetched === 0) {
      throw new AudienceAnalysisPipelineStepError(
        '未能采集到有效的评论数据',
        'fetch-comments'
      )
    }

    await emitProgress(
      emit,
      'fetch-comments',
      'completed',
      `共采集 ${totalCommentsFetched} 条有效评论`
    )

    // 步骤3: 聚合数据
    await emitProgress(emit, 'aggregate-data', 'active', '正在统计地域分布...')

    // 聚合所有评论
    const allComments: CleanedComment[] = []
    const locationMap = new Map<string, number>()

    for (const videoStats of videoStatsArray) {
      for (const comment of videoStats.comments) {
        allComments.push(comment)

        // 统计地域分布
        if (comment.location) {
          locationMap.set(comment.location, (locationMap.get(comment.location) || 0) + 1)
        }
      }
    }

    // 计算地域分布百分比
    const locationStats: LocationStat[] = Array.from(locationMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([location, count]) => ({
        location,
        count,
        percentage: (count / totalCommentsFetched) * 100
      }))

    await emitProgress(
      emit,
      'aggregate-data',
      'completed',
      `已识别${locationStats.length}个不同地域`
    )

    // 步骤4: AI分析
    await emitProgress(emit, 'analyze-audience', 'active', '正在使用AI分析客群画像...')

    let analysisText: string
    try {
      analysisText = await analyzeAudienceWithLLM(
        merchant.name,
        videoStatsArray,
        locationStats,
        allComments,
        modelId,
        emit,
        signal
      )
    } catch (error) {
      throw new AudienceAnalysisPipelineStepError(
        error instanceof Error ? error.message : 'AI分析失败',
        'analyze-audience',
        error
      )
    }

    ensureActive(signal)
    await emitProgress(emit, 'analyze-audience', 'completed')

    // 步骤5: 构建完整 Markdown（包含基本信息、TOP视频列表、地域分布和LLM分析）
    const fullMarkdown = buildMarkdown(
      merchant.name,
      videoStatsArray,
      locationStats,
      analysisText,
      totalCommentsFetched
    )

    // 步骤6: 保存完整结果到数据库
    await emitProgress(emit, 'save-result', 'active', '正在保存分析结果...')

    const analysis = await prisma.merchantAudienceAnalysis.upsert({
      where: { merchantId },
      create: {
        merchantId,
        videosAnalyzed: videoStatsArray.length,
        commentsAnalyzed: totalCommentsFetched,
        videoIds: JSON.stringify(topVideos.map(v => v.id)),
        locationStats: JSON.stringify(locationStats),
        rawMarkdown: fullMarkdown,  // ✅ 写入完整 markdown 而不是 analysisText
        modelUsed: modelId,
        tokenUsed: estimateTokens(fullMarkdown)  // ✅ 基于完整内容计算 token
      },
      update: {
        videosAnalyzed: videoStatsArray.length,
        commentsAnalyzed: totalCommentsFetched,
        videoIds: JSON.stringify(topVideos.map(v => v.id)),
        locationStats: JSON.stringify(locationStats),
        rawMarkdown: fullMarkdown,  // ✅ 写入完整 markdown 而不是 analysisText
        modelUsed: modelId,
        tokenUsed: estimateTokens(fullMarkdown),  // ✅ 基于完整内容计算 token
        analyzedAt: new Date()
      }
    })

    await emitProgress(emit, 'save-result', 'completed')

    const result: AudienceAnalysisPipelineResult = {
      analysisId: analysis.id,
      markdown: fullMarkdown,  // ✅ 使用完整 markdown
      videosAnalyzed: videoStatsArray.length,
      commentsAnalyzed: totalCommentsFetched,
      locationStats
    }

    // 发送完成事件（包含所有字段，与数据库结构一致）
    await emit({
      type: 'done',
      analysisId: analysis.id,
      markdown: fullMarkdown,  // ✅ 使用完整 markdown
      videosAnalyzed: videoStatsArray.length,
      commentsAnalyzed: totalCommentsFetched,
      locationStats,
      modelUsed: modelId,  // ✅ 添加模型信息
      tokenUsed: estimateTokens(fullMarkdown),  // ✅ 添加 token 消耗
      analyzedAt: analysis.analyzedAt.toISOString(),  // ✅ 添加分析时间
      audienceProfile: null,
      demographics: null,
      behaviors: null,
      interests: null,
      painPoints: null,
      suggestions: null
    })

    return result
  } catch (error) {
    if (error instanceof AudienceAnalysisPipelineAbortError) {
      await emit({
        type: 'error',
        message: '客群分析已取消',
        step: 'select-videos'
      })
      throw error
    }

    if (error instanceof AudienceAnalysisPipelineStepError) {
      await emit({
        type: 'error',
        message: error.message,
        step: error.step,
        cause: error.cause
      })
      throw error
    }

    const fallbackError = new AudienceAnalysisPipelineStepError(
      error instanceof Error ? error.message : '客群分析失败',
      'select-videos',
      error
    )

    await emit({
      type: 'error',
      message: fallbackError.message,
      step: fallbackError.step,
      cause: fallbackError.cause
    })

    throw fallbackError
  }
}
