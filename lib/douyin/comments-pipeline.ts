/**
 * 抖音评论分析 Pipeline
 * 完整的评论数据采集和 LLM 智能分析流程
 */

import { parseDouyinVideoShare } from '@/lib/douyin/share-link'
import { getTikHubClient } from '@/lib/tikhub'
import type { DouyinComment } from '@/lib/tikhub/types'
import {
  DOUYIN_COMMENTS_PIPELINE_STEPS,
  type DouyinCommentsPipelineStep,
  type DouyinCommentsPipelineStepStatus,
  type DouyinCommentsProgress,
  type DouyinCommentsVideoInfo,
  type DouyinCommentsStatistics,
  type CleanedComment,
  type LocationStat,
  type DouyinCommentsAnalysisData
} from '@/lib/douyin/comments-pipeline-steps'

// Pipeline 事件类型
export interface DouyinCommentsProgressEvent extends DouyinCommentsProgress {
  type: 'progress'
}

export interface DouyinCommentsInfoEvent {
  type: 'info'
  videoInfo: DouyinCommentsVideoInfo
  statistics?: DouyinCommentsStatistics
}

export interface DouyinCommentsPartialEvent {
  type: 'partial'
  key: 'analysis'
  data: string
  append?: boolean
}

export interface DouyinCommentsDoneEvent {
  type: 'done'
  markdown: string
  videoInfo: DouyinCommentsVideoInfo
  statistics: DouyinCommentsStatistics
  analysis: {
    sentiment: any
    coreTopics: any
    userProfile: any
    suggestions: any
  }
}

export interface DouyinCommentsErrorEvent {
  type: 'error'
  message: string
  step?: DouyinCommentsPipelineStep
  cause?: unknown
}

export type DouyinCommentsPipelineEvent =
  | DouyinCommentsProgressEvent
  | DouyinCommentsInfoEvent
  | DouyinCommentsPartialEvent
  | DouyinCommentsDoneEvent
  | DouyinCommentsErrorEvent

export type DouyinCommentsPipelineEmitter = (
  event: DouyinCommentsPipelineEvent
) => void | Promise<void>

export interface DouyinCommentsPipelineOptions {
  signal?: AbortSignal
  maxComments?: number  // 最大采集评论数，默认100
  maxPages?: number     // 最大采集页数，默认5
  fastMode?: boolean    // 快速模式：使用更快的Haiku模型，分析更简洁
}

export interface DouyinCommentsPipelineResult {
  markdown: string
  videoInfo: DouyinCommentsVideoInfo
  statistics: DouyinCommentsStatistics
  analysis: any
}

class DouyinCommentsPipelineAbortError extends Error {
  constructor() {
    super('Douyin comments pipeline aborted')
    this.name = 'AbortError'
  }
}

export class DouyinCommentsPipelineStepError extends Error {
  constructor(
    message: string,
    public step: DouyinCommentsPipelineStep,
    public cause?: unknown
  ) {
    super(message)
    this.name = 'DouyinCommentsPipelineStepError'
  }
}

function ensureActive(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new DouyinCommentsPipelineAbortError()
  }
}

const STAT_KEYS: Array<keyof DouyinCommentsStatistics> = [
  'play_count',
  'digg_count',
  'comment_count',
  'share_count',
  'collect_count',
  'download_count'
]

type RawDouyinStatistics = Record<string, any> | null | undefined

function normalizeStatisticsValue(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0
  }
  const parsed = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeStatisticsData(raw: RawDouyinStatistics): DouyinCommentsStatistics | null {
  if (!raw) {
    return null
  }

  const hasValidField = STAT_KEYS.some((key) => raw[key] !== undefined && raw[key] !== null)
  if (!hasValidField) {
    return null
  }

  return STAT_KEYS.reduce((acc, key) => {
    acc[key] = normalizeStatisticsValue(raw[key])
    return acc
  }, {} as DouyinCommentsStatistics)
}

async function emitProgress(
  emit: DouyinCommentsPipelineEmitter,
  step: DouyinCommentsPipelineStep,
  status: DouyinCommentsPipelineStepStatus,
  detail?: string
) {
  const index = DOUYIN_COMMENTS_PIPELINE_STEPS.findIndex((item) => item.key === step)

  if (index === -1) {
    return
  }

  const total = DOUYIN_COMMENTS_PIPELINE_STEPS.length
  const completedSteps = status === 'completed' ? index + 1 : index
  const percentage = Math.max(
    0,
    Math.min(100, Math.round((completedSteps / total) * 100))
  )

  const progressEvent: DouyinCommentsProgressEvent = {
    type: 'progress',
    step,
    status,
    index,
    total,
    percentage,
    detail,
    label: DOUYIN_COMMENTS_PIPELINE_STEPS[index].label,
    description: DOUYIN_COMMENTS_PIPELINE_STEPS[index].description
  }

  await emit(progressEvent)
}

/**
 * 清理评论文本中的表情符号
 * 删除所有 [xxx] 格式的内容
 */
function cleanCommentText(text: string): string {
  return text.replace(/\[.*?\]/g, '').trim()
}

/**
 * 构建 Markdown 格式的分析报告
 */
function buildMarkdown(
  videoInfo: DouyinCommentsVideoInfo,
  statistics: DouyinCommentsStatistics,
  analysisText: string,
  comments: CleanedComment[],
  _locationStats: LocationStat[]
): string {
  return [
    '## 抖音视频评论分析报告',
    '',
    '## 视频信息',
    `- **标题**: ${videoInfo.title}`,
    `- **作者**: ${videoInfo.author}`,
    `- **播放量**: ${statistics.play_count.toLocaleString('zh-CN')}`,
    `- **点赞数**: ${statistics.digg_count.toLocaleString('zh-CN')}`,
    `- **评论数**: ${statistics.comment_count.toLocaleString('zh-CN')} (采集样本: ${comments.length}条)`,
    '',
    '---',
    '',
    analysisText,
    '',
    '---',
    '',
    '评论分析完成！你可以继续提问或深入讨论。'
  ].join('\n')
}

/**
 * 调用 LLM 分析评论数据
 * 使用统一的 LLM 客户端
 */
async function analyzeWithLLM(
  data: DouyinCommentsAnalysisData,
  modelId: string,
  emit: DouyinCommentsPipelineEmitter,
  signal?: AbortSignal
): Promise<string> {
  const { callLLMStreamWithTimeout } = await import('@/lib/ai/llm-client')

  // 构建分析提示词
  const prompt = `请分析以下抖音视频的评论数据，给出专业的洞察报告：

**视频信息**
- 标题: ${data.video.title}
- 作者: ${data.video.author}
- 播放量: ${data.statistics.play_count?.toLocaleString('zh-CN')}
- 点赞数: ${data.statistics.digg_count?.toLocaleString('zh-CN')}
- 评论总数: ${data.statistics.comment_count?.toLocaleString('zh-CN')}
- 评论样本: ${data.comments.length}条

**评论样本**
${data.comments.slice(0, 30).map((c, i) => {
  const location = c.location ? ` [${c.location}]` : ''
  return `${i + 1}. ${c.user}${location}: ${c.text}`
}).join('\n')}

${data.locationStats.length > 0 ? `**地域分布**
${data.locationStats.map(({ location, count }) => `- ${location}: ${count}条`).join('\n')}` : ''}

请按以下维度分析：



  ## 1. 具体需求分析

  - 用户询问的具体问题
  - 明确表达的需求

  ## 2. 用户画像

  - 地域分布特征及分析
  - 用户特征（身份、年龄层、消费能力推测）
  - 消费心理（价格敏感度、决策因素）

  ## 3. 用户反馈的问题

  - 用户反馈的问题

请用中文简洁地输出分析结果，使用markdown格式。`

  return callLLMStreamWithTimeout({
    prompt,
    modelId,
    maxTokens: 4000,
    signal,
    onChunk: async (delta) => {
      await emit({
        type: 'partial',
        key: 'analysis',
        data: delta,
        append: true
      })
    }
  }, 180000) // 180秒超时，与 audience-analysis-pipeline 保持一致
}

/**
 * 运行抖音评论分析 Pipeline
 */
export async function runDouyinCommentsPipeline(
  shareLink: string,
  emit: DouyinCommentsPipelineEmitter,
  options: DouyinCommentsPipelineOptions = {}
): Promise<DouyinCommentsPipelineResult> {
  const signal = options.signal
  const maxComments = options.maxComments || 100
  const maxPages = options.maxPages || 5
  const fastMode = options.fastMode || false

  // 使用统一的配置模块
  const { validateAIConfig, selectModel } = await import('@/lib/config/ai-config')

  let modelId: string
  try {
    validateAIConfig()
    modelId = selectModel(fastMode)
  } catch (error) {
    const err = new DouyinCommentsPipelineStepError(
      error instanceof Error ? error.message : '配置错误',
      'parse-link'
    )
    await emit({
      type: 'error',
      message: err.message,
      step: err.step
    })
    throw err
  }

  if (fastMode) {
    console.info('[COMMENTS] 启用快速模式，使用 Haiku 模型')
  }

  try {
    ensureActive(signal)

    // 步骤1: 解析链接
    await emitProgress(emit, 'parse-link', 'active')
    let shareResult
    try {
      shareResult = await parseDouyinVideoShare(shareLink)
    } catch (error) {
      throw new DouyinCommentsPipelineStepError(
        error instanceof Error ? error.message : '链接解析失败',
        'parse-link',
        error
      )
    }
    ensureActive(signal)

    if (!shareResult.videoId) {
      throw new DouyinCommentsPipelineStepError('无法从链接中提取视频ID', 'parse-link')
    }
    await emitProgress(emit, 'parse-link', 'completed')

    // 性能优化：步骤2和3并发执行（获取视频详情和统计数据）
    await emitProgress(emit, 'fetch-detail', 'active', '正在并发获取视频信息...')
    const tikhubClient = getTikHubClient()

    // 并发请求视频详情和统计数据
    const [videoDetailResult, statsResult] = await Promise.allSettled([
      tikhubClient.getVideoDetail({ aweme_id: shareResult.videoId }),
      tikhubClient.getVideoStatistics({ aweme_ids: shareResult.videoId })
    ])

    ensureActive(signal)

    // 处理视频详情结果
    if (videoDetailResult.status === 'rejected') {
      throw new DouyinCommentsPipelineStepError(
        videoDetailResult.reason instanceof Error ? videoDetailResult.reason.message : 'TikHub API调用失败',
        'fetch-detail',
        videoDetailResult.reason
      )
    }

    const videoDetail = videoDetailResult.value
    const awemeDetail = videoDetail?.aweme_detail
    if (!awemeDetail) {
      throw new DouyinCommentsPipelineStepError(
        'TikHub未返回视频详情数据',
        'fetch-detail'
      )
    }

    const videoInfo: DouyinCommentsVideoInfo = {
      videoId: shareResult.videoId,
      title: awemeDetail.desc || '未知标题',
      author: awemeDetail.author?.nickname || '未知作者',
      duration: awemeDetail.video?.duration ? awemeDetail.video.duration / 1000 : 0,
      coverUrl: awemeDetail.video?.cover?.url_list?.[0]
    }

    await emit({
      type: 'info',
      videoInfo
    })
    await emitProgress(emit, 'fetch-detail', 'completed')

    // 步骤3: 处理统计数据（已并发获取）
    await emitProgress(emit, 'fetch-statistics', 'active', '正在处理统计数据...')
    let statistics: DouyinCommentsStatistics | null = null
    let usedFallback = false

    // 处理统计数据结果
    if (statsResult.status === 'fulfilled') {
      const statsResponse = statsResult.value
      console.info('[COMMENTS_STATS] API响应:', JSON.stringify({
        hasStatisticsList: !!(statsResponse as any).statistics_list,
        hasStatistics: !!statsResponse.statistics,
      }, null, 2))

      const statisticsList =
        (statsResponse as { statistics_list?: typeof statsResponse.statistics } | undefined)
          ?.statistics_list ?? statsResponse.statistics

      if (statisticsList && statisticsList.length > 0) {
        const normalizedStats = normalizeStatisticsData(statisticsList[0])
        if (normalizedStats) {
          statistics = normalizedStats
          console.info('[COMMENTS_STATS] 统计数据处理成功')
        }
      }
    } else {
      console.warn('[COMMENTS_STATS] 获取统计数据失败，尝试降级方案:', statsResult.reason)
    }

    // 降级方案：使用视频详情中的统计数据
    if (!statistics) {
      const fallbackStatistics = normalizeStatisticsData(awemeDetail.statistics)
      if (fallbackStatistics) {
        statistics = fallbackStatistics
        usedFallback = true
        console.info('[COMMENTS_STATS] 成功使用降级数据源')
      } else {
        throw new DouyinCommentsPipelineStepError(
          '无法获取视频统计数据（主API和降级方案均失败）',
          'fetch-statistics'
        )
      }
    }
    ensureActive(signal)

    const completionDetail = usedFallback
      ? '已获取统计数据（使用降级数据源）'
      : '已获取统计数据'
    await emitProgress(emit, 'fetch-statistics', 'completed', completionDetail)

    await emit({
      type: 'info',
      videoInfo,
      statistics
    })

    // 步骤4: 采集评论
    await emitProgress(emit, 'fetch-comments', 'active', '正在采集第1页评论...')
    let allComments: DouyinComment[] = []
    try {
      // 获取第一页
      const commentsPage1 = await tikhubClient.getVideoComments({
        aweme_id: shareResult.videoId,
        cursor: 0,
        count: 20
      })

      if (commentsPage1.comments) {
        allComments = [...commentsPage1.comments]
      }

      // 继续获取更多评论
      // 注意：只看 has_more 和上限条件，不对 cursor 做布尔判断
      // 因为 cursor=0 是合法值，代表第一页后的游标
      let hasMore = commentsPage1.has_more
      let cursor = commentsPage1.cursor
      let pageCount = 1

      while (hasMore && pageCount < maxPages && allComments.length < maxComments) {
          ensureActive(signal)

          try {
            const nextPage = await tikhubClient.getVideoComments({
              aweme_id: shareResult.videoId,
              cursor: cursor,
              count: 20
            })

            if (nextPage.comments && nextPage.comments.length > 0) {
              allComments.push(...nextPage.comments)
              pageCount++

              await emitProgress(
                emit,
                'fetch-comments',
                'active',
                `已采集 ${allComments.length} 条评论 (第${pageCount}页)`
              )
            }

            if (!nextPage.has_more) {
              hasMore = false
            } else {
              cursor = nextPage.cursor
            }

            // 减少请求间隔（从500ms降到200ms）
            await new Promise(resolve => setTimeout(resolve, 200))
          } catch (error) {
            // 单页失败不中断整个流程
            console.warn('采集评论页失败:', error)
            break
          }
      }
    } catch (error) {
      throw new DouyinCommentsPipelineStepError(
        error instanceof Error ? error.message : '采集评论失败',
        'fetch-comments',
        error
      )
    }
    ensureActive(signal)

    await emitProgress(emit, 'fetch-comments', 'completed', `共采集 ${allComments.length} 条评论`)

    // 步骤5: 清理评论
    await emitProgress(emit, 'clean-comments', 'active')
    const locationMap = new Map<string, number>()
    const cleanedComments: CleanedComment[] = allComments
      .slice(0, maxComments)
      .map(c => {
        const cleanText = cleanCommentText(c.text)
        // 过滤掉清理后为空或太短的评论
        if (!cleanText || cleanText.length < 2) return null

        // 统计地域分布
        if (c.ip_label) {
          locationMap.set(c.ip_label, (locationMap.get(c.ip_label) || 0) + 1)
        }

        return {
          user: c.user.nickname,
          text: cleanText,
          likes: c.digg_count,
          location: c.ip_label || ''
        }
      })
      .filter((c): c is CleanedComment => c !== null)

    // 按地域统计排序
    const locationStats: LocationStat[] = Array.from(locationMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([location, count]) => ({ location, count }))

    await emitProgress(emit, 'clean-comments', 'completed', `清理后有效评论 ${cleanedComments.length} 条`)

    // 步骤6: LLM 分析
    await emitProgress(emit, 'analyze-comments', 'active', '正在使用 AI 分析评论...')
    const analysisData: DouyinCommentsAnalysisData = {
      video: {
        title: videoInfo.title,
        author: videoInfo.author
      },
      statistics,
      comments: cleanedComments,
      locationStats
    }

    let analysisText: string
    try {
      analysisText = await analyzeWithLLM(analysisData, modelId, emit, signal)
    } catch (error) {
      throw new DouyinCommentsPipelineStepError(
        error instanceof Error ? error.message : 'LLM 分析失败',
        'analyze-comments',
        error
      )
    }
    ensureActive(signal)

    await emitProgress(emit, 'analyze-comments', 'completed')

    // 构建最终的 Markdown 报告
    const markdown = buildMarkdown(
      videoInfo,
      statistics,
      analysisText,
      cleanedComments,
      locationStats
    )

    const result: DouyinCommentsPipelineResult = {
      markdown,
      videoInfo,
      statistics,
      analysis: {
        sentiment: null,
        coreTopics: null,
        userProfile: null,
        suggestions: null
      }
    }

    await emit({
      type: 'done',
      markdown,
      videoInfo,
      statistics,
      analysis: result.analysis
    })

    return result
  } catch (error) {
    if (error instanceof DouyinCommentsPipelineAbortError) {
      await emit({
        type: 'error',
        message: '评论分析已取消',
        step: 'parse-link'
      })
      throw error
    }

    if (error instanceof DouyinCommentsPipelineStepError) {
      await emit({
        type: 'error',
        message: error.message,
        step: error.step,
        cause: error.cause
      })
      throw error
    }

    const fallbackError = new DouyinCommentsPipelineStepError(
      error instanceof Error ? error.message : '评论分析失败',
      'parse-link',
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
