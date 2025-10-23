/**
 * 抖音评论分析 Pipeline
 * 完整的评论数据采集和 LLM 智能分析流程
 */

import { parseDouyinVideoShare } from '@/lib/douyin/share-link'
import { getTikHubClient } from '@/lib/tikhub'
import type { DouyinComment } from '@/lib/tikhub/types'
import { selectApiKey } from '@/lib/ai/key-manager'
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
  locationStats: LocationStat[]
): string {
  return [
    '📊 **抖音视频评论分析报告**',
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
 */
async function analyzeWithLLM(
  data: DouyinCommentsAnalysisData,
  apiKey: string,
  modelId: string,
  emit: DouyinCommentsPipelineEmitter,
  signal?: AbortSignal
): Promise<string> {
  const apiBase = process.env.LLM_API_BASE || 'https://api.302.ai/v1'

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

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,  // 使用上面定义的modelId
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 4000,
      temperature: 0.7,
      stream: true  // 启用流式输出
    }),
    signal
  })

  if (!response.ok) {
    let errorText = ''
    let errorDetail = ''

    try {
      errorText = await response.text()
      // 尝试解析JSON错误
      try {
        const errorJson = JSON.parse(errorText)
        errorDetail = errorJson.error?.message || errorJson.message || errorText
      } catch {
        errorDetail = errorText
      }
    } catch {
      errorDetail = '无法读取错误详情'
    }

    const errorMessage = errorDetail
      ? `LLM API错误: ${response.status} - ${errorDetail}`
      : `LLM API错误: HTTP ${response.status} ${response.statusText}`

    throw new Error(errorMessage)
  }

  // 处理流式响应
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('无法读取响应流')
  }

  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  try {
    while (true) {
      ensureActive(signal)
      const { done, value } = await reader.read()

      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim() || line.trim() === 'data: [DONE]') continue

        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            const delta = data.choices?.[0]?.delta?.content

            if (delta) {
              fullText += delta
              // 实时发送分析片段
              await emit({
                type: 'partial',
                key: 'analysis',
                data: delta,
                append: true
              })
            }
          } catch (parseError) {
            // 忽略解析错误
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!fullText) {
    throw new Error('LLM 分析失败，未返回文本')
  }

  return fullText
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

  // 使用Key Manager选择合适的API Key
  // 使用claude-sonnet-4-5（从MODEL_ALLOWLIST中选择可用模型）
  const modelId = 'claude-sonnet-4-5-20250929'
  const { apiKey } = selectApiKey(modelId)

  if (!apiKey) {
    const error = new DouyinCommentsPipelineStepError(
      `未配置 ${modelId} 模型的 API 密钥，请检查环境变量 LLM_CLAUDE_API_KEY 或 LLM_API_KEY`,
      'parse-link'
    )
    await emit({
      type: 'error',
      message: error.message,
      step: error.step
    })
    throw error
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

    // 步骤2: 获取视频详情
    await emitProgress(emit, 'fetch-detail', 'active')
    const tikhubClient = getTikHubClient()
    let videoDetail
    try {
      videoDetail = await tikhubClient.getVideoDetail({
        aweme_id: shareResult.videoId
      })
    } catch (error) {
      throw new DouyinCommentsPipelineStepError(
        error instanceof Error ? error.message : 'TikHub API调用失败',
        'fetch-detail',
        error
      )
    }
    ensureActive(signal)

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

    // 步骤3: 获取播放数据
    await emitProgress(emit, 'fetch-statistics', 'active')
    let statistics: DouyinCommentsStatistics
    try {
      const statsResponse = await tikhubClient.getVideoStatistics({
        aweme_ids: shareResult.videoId
      })

      const statisticsList =
        (statsResponse as { statistics_list?: typeof statsResponse.statistics } | undefined)
          ?.statistics_list ?? statsResponse.statistics

      if (!statisticsList || statisticsList.length === 0) {
        throw new Error('未获取到统计数据')
      }

      const stats = statisticsList[0]
      statistics = {
        play_count: stats.play_count || 0,
        digg_count: stats.digg_count || 0,
        comment_count: stats.comment_count || 0,
        share_count: stats.share_count || 0,
        collect_count: stats.collect_count || 0,
        download_count: stats.download_count || 0
      }
    } catch (error) {
      throw new DouyinCommentsPipelineStepError(
        error instanceof Error ? error.message : '获取统计数据失败',
        'fetch-statistics',
        error
      )
    }
    ensureActive(signal)

    await emit({
      type: 'info',
      videoInfo,
      statistics
    })
    await emitProgress(emit, 'fetch-statistics', 'completed')

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
      if (commentsPage1.has_more && allComments.length < maxComments) {
        let cursor = commentsPage1.cursor
        let pageCount = 1

        while (pageCount < maxPages && cursor && allComments.length < maxComments) {
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

            if (!nextPage.has_more) break
            cursor = nextPage.cursor

            // 避免请求过快
            await new Promise(resolve => setTimeout(resolve, 500))
          } catch (error) {
            // 单页失败不中断整个流程
            console.warn('采集评论页失败:', error)
            break
          }
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
      analysisText = await analyzeWithLLM(analysisData, apiKey, modelId, emit, signal)
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
