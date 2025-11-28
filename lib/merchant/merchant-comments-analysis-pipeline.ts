/**
 * 商家评论分析 Pipeline
 * 基于对话模块的 comments-pipeline.ts 改造，适配商家场景
 *
 * 关键改动：
 * 1. 输入从 shareLink 改为 contentId（数据库主键）
 * 2. 视频信息从数据库读取（而不是 TikHub）
 * 3. 评论数据优先数据库，必要时 TikHub 回退
 * 4. 分析结果保存到 MerchantContentAnalysis 表
 */

import { prisma } from '@/lib/prisma'
import {
  fetchCommentsForAnalysis,
  type CleanedComment,
  type CommentSource
} from './comments-source-manager'
import {
  MERCHANT_COMMENT_ANALYSIS_STEPS,
  type MerchantCommentAnalysisStep,
  type MerchantCommentAnalysisStepStatus,
  type MerchantCommentAnalysisProgress,
  type MerchantVideoInfo,
  type MerchantVideoStatistics,
  type MerchantCommentAnalysisData
} from './merchant-comments-analysis-steps'

// Pipeline 事件类型
export interface MerchantAnalysisProgressEvent extends MerchantCommentAnalysisProgress {
  type: 'progress'
}

export interface MerchantAnalysisInfoEvent {
  type: 'info'
  videoInfo: MerchantVideoInfo
  statistics?: MerchantVideoStatistics
}

export interface MerchantAnalysisPartialEvent {
  type: 'partial'
  key: 'analysis'
  data: string
  append?: boolean
}

export interface MerchantAnalysisDoneEvent {
  type: 'done'
  analysisId: string
  markdown: string
  videoInfo: MerchantVideoInfo
  statistics: MerchantVideoStatistics
  commentCount: number
  commentSource: 'db' | 'tikhub'
}

export interface MerchantAnalysisErrorEvent {
  type: 'error'
  message: string
  step?: MerchantCommentAnalysisStep
  cause?: unknown
}

export type MerchantAnalysisPipelineEvent =
  | MerchantAnalysisProgressEvent
  | MerchantAnalysisInfoEvent
  | MerchantAnalysisPartialEvent
  | MerchantAnalysisDoneEvent
  | MerchantAnalysisErrorEvent

export type MerchantAnalysisPipelineEmitter = (
  event: MerchantAnalysisPipelineEvent
) => void | Promise<void>

export interface MerchantAnalysisPipelineOptions {
  signal?: AbortSignal
  maxComments?: number    // 最大分析评论数，默认100
  fastMode?: boolean      // 快速模式：使用更快的Haiku模型
}

export interface MerchantAnalysisPipelineResult {
  analysisId: string
  markdown: string
  videoInfo: MerchantVideoInfo
  statistics: MerchantVideoStatistics
  commentCount: number
  commentSource: 'db' | 'tikhub'
}

class MerchantAnalysisPipelineAbortError extends Error {
  constructor() {
    super('Merchant comment analysis pipeline aborted')
    this.name = 'AbortError'
  }
}

export class MerchantAnalysisPipelineStepError extends Error {
  constructor(
    message: string,
    public step: MerchantCommentAnalysisStep,
    public cause?: unknown
  ) {
    super(message)
    this.name = 'MerchantAnalysisPipelineStepError'
  }
}

function ensureActive(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new MerchantAnalysisPipelineAbortError()
  }
}

async function emitProgress(
  emit: MerchantAnalysisPipelineEmitter,
  step: MerchantCommentAnalysisStep,
  status: MerchantCommentAnalysisStepStatus,
  detail?: string
) {
  const index = MERCHANT_COMMENT_ANALYSIS_STEPS.findIndex((item) => item.key === step)

  if (index === -1) {
    return
  }

  const total = MERCHANT_COMMENT_ANALYSIS_STEPS.length
  const completedSteps = status === 'completed' ? index + 1 : index
  const percentage = Math.max(
    0,
    Math.min(100, Math.round((completedSteps / total) * 100))
  )

  const progressEvent: MerchantAnalysisProgressEvent = {
    type: 'progress',
    step,
    status,
    index,
    total,
    percentage,
    detail,
    label: MERCHANT_COMMENT_ANALYSIS_STEPS[index].label,
    description: MERCHANT_COMMENT_ANALYSIS_STEPS[index].description
  }

  await emit(progressEvent)
}

/**
 * 构建 Markdown 格式的分析报告
 */
function buildMarkdown(
  videoInfo: MerchantVideoInfo,
  statistics: MerchantVideoStatistics,
  analysisText: string,
  comments: CleanedComment[],
  commentSource: 'db' | 'tikhub'
): string {
  return [
    '## 商家视频评论分析报告',
    '',
    '## 视频信息',
    `- **标题**: ${videoInfo.title}`,
    `- **商家**: ${videoInfo.author}`,
    `- **播放量**: ${statistics.play_count.toLocaleString('zh-CN')}`,
    `- **点赞数**: ${statistics.digg_count.toLocaleString('zh-CN')}`,
    `- **评论数**: ${statistics.comment_count.toLocaleString('zh-CN')} (分析样本: ${comments.length}条)`,
    `- **评论来源**: ${commentSource === 'db' ? '数据库' : 'TikHub实时抓取'}`,
    '',
    '---',
    '',
    analysisText,
    '',
    '---',
    '',
    '分析完成！'
  ].join('\n')
}

/**
 * 调用 LLM 分析评论数据
 * 使用统一的 LLM 客户端
 */
async function analyzeWithLLM(
  data: MerchantCommentAnalysisData,
  modelId: string,
  emit: MerchantAnalysisPipelineEmitter,
  signal?: AbortSignal
): Promise<string> {
  const { callLLMStreamWithTimeout } = await import('@/lib/ai/llm-client')

  // 构建分析提示词（适配商家场景）
  const prompt = `请分析以下商家视频的评论数据，给出专业的洞察报告：

**视频信息**
- 标题: ${data.video.title}
- 商家: ${data.video.author}
- 播放量: ${data.statistics.play_count?.toLocaleString('zh-CN')}
- 点赞数: ${data.statistics.digg_count?.toLocaleString('zh-CN')}
- 评论总数: ${data.statistics.comment_count?.toLocaleString('zh-CN')}
- 分析样本: ${data.comments.length}条

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
  }, 180000) // 180秒超时
}

/**
 * Token估算（粗略）
 */
function estimateTokens(text: string): number {
  // 中文：1个字符 ≈ 2 tokens
  // 英文：1个单词 ≈ 1.3 tokens
  // 粗略估算：总字符数 * 1.5
  return Math.ceil(text.length * 1.5)
}

/**
 * 运行商家评论分析 Pipeline
 */
export async function runMerchantCommentAnalysis(
  contentId: string,
  emit: MerchantAnalysisPipelineEmitter,
  options: MerchantAnalysisPipelineOptions = {}
): Promise<MerchantAnalysisPipelineResult> {
  const signal = options.signal
  const maxComments = options.maxComments || 100
  const fastMode = options.fastMode || false

  // 使用统一的配置模块
  const { validateAIConfig, selectModel } = await import('@/lib/config/ai-config')

  let modelId: string
  try {
    validateAIConfig()
    modelId = selectModel(fastMode)
  } catch (error) {
    const err = new MerchantAnalysisPipelineStepError(
      error instanceof Error ? error.message : '配置错误',
      'load-video'
    )
    await emit({
      type: 'error',
      message: err.message,
      step: err.step
    })
    throw err
  }

  if (fastMode) {
    console.info('[MERCHANT_COMMENTS] 启用快速模式，使用 Haiku 模型')
  }

  try {
    ensureActive(signal)

    // 步骤1: 加载视频信息
    await emitProgress(emit, 'load-video', 'active')
    const content = await prisma.merchantContent.findUnique({
      where: { id: contentId },
      include: {
        merchant: {
          select: {
            name: true,
            uid: true
          }
        }
      }
    })

    if (!content) {
      throw new MerchantAnalysisPipelineStepError(
        `Content not found: ${contentId}`,
        'load-video'
      )
    }

    const videoInfo: MerchantVideoInfo = {
      videoId: content.externalId,
      contentId: content.id,
      title: content.title,
      author: content.merchant.name,
      duration: content.duration ? parseInt(content.duration) : undefined,
      coverUrl: undefined
    }

    const statistics: MerchantVideoStatistics = {
      play_count: content.playCount,
      digg_count: content.diggCount,
      comment_count: content.commentCount,
      share_count: content.shareCount,
      collect_count: content.collectCount
    }

    await emit({
      type: 'info',
      videoInfo,
      statistics
    })
    await emitProgress(emit, 'load-video', 'completed')

    // 步骤2: 加载评论数据
    await emitProgress(emit, 'fetch-comments', 'active')
    let commentSource: CommentSource
    try {
      commentSource = await fetchCommentsForAnalysis(contentId, {
        maxComments,
        signal
      })
    } catch (error) {
      throw new MerchantAnalysisPipelineStepError(
        error instanceof Error ? error.message : '加载评论失败',
        'fetch-comments',
        error
      )
    }
    ensureActive(signal)

    await emitProgress(
      emit,
      'fetch-comments',
      'completed',
      `已加载 ${commentSource.total} 条评论（${commentSource.source === 'db' ? '数据库' : 'TikHub实时抓取'}）`
    )

    // 步骤3: 清理评论（已由 comments-source-manager 完成，这里只是标记进度）
    await emitProgress(emit, 'clean-comments', 'active')
    const cleanedComments = commentSource.comments
    await emitProgress(emit, 'clean-comments', 'completed', `有效评论 ${cleanedComments.length} 条`)

    // 步骤4: LLM 分析
    await emitProgress(emit, 'analyze-comments', 'active', '正在使用 AI 分析评论...')
    const analysisData: MerchantCommentAnalysisData = {
      video: {
        title: videoInfo.title,
        author: videoInfo.author
      },
      statistics,
      comments: cleanedComments,
      locationStats: [] // TODO: 从评论中提取地域统计
    }

    let analysisText: string
    try {
      analysisText = await analyzeWithLLM(analysisData, modelId, emit, signal)
    } catch (error) {
      throw new MerchantAnalysisPipelineStepError(
        error instanceof Error ? error.message : 'LLM 分析失败',
        'analyze-comments',
        error
      )
    }
    ensureActive(signal)

    await emitProgress(emit, 'analyze-comments', 'completed')

    // 步骤5: 保存结果到数据库
    await emitProgress(emit, 'save-result', 'active')
    const analysis = await prisma.merchantContentAnalysis.upsert({
      where: { contentId },
      create: {
        contentId,
        rawMarkdown: analysisText,
        commentCount: commentSource.total,
        commentSource: commentSource.source,
        modelUsed: modelId,
        tokenUsed: estimateTokens(analysisText)
      },
      update: {
        rawMarkdown: analysisText,
        commentCount: commentSource.total,
        commentSource: commentSource.source,
        modelUsed: modelId,
        tokenUsed: estimateTokens(analysisText),
        analyzedAt: new Date()
      }
    })
    await emitProgress(emit, 'save-result', 'completed')

    // 构建最终 Markdown
    const markdown = buildMarkdown(
      videoInfo,
      statistics,
      analysisText,
      cleanedComments,
      commentSource.source
    )

    const result: MerchantAnalysisPipelineResult = {
      analysisId: analysis.id,
      markdown,
      videoInfo,
      statistics,
      commentCount: commentSource.total,
      commentSource: commentSource.source
    }

    await emit({
      type: 'done',
      analysisId: analysis.id,
      markdown,
      videoInfo,
      statistics,
      commentCount: commentSource.total,
      commentSource: commentSource.source
    })

    return result
  } catch (error) {
    if (error instanceof MerchantAnalysisPipelineAbortError) {
      await emit({
        type: 'error',
        message: '评论分析已取消',
        step: 'load-video'
      })
      throw error
    }

    if (error instanceof MerchantAnalysisPipelineStepError) {
      await emit({
        type: 'error',
        message: error.message,
        step: error.step,
        cause: error.cause
      })
      throw error
    }

    const fallbackError = new MerchantAnalysisPipelineStepError(
      error instanceof Error ? error.message : '评论分析失败',
      'load-video',
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
