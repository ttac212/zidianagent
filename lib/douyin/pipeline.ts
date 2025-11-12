/**
 * 抖音视频Pipeline主函数 - 重构版
 *
 * 重构目标：
 * 1. 将554行巨型函数拆解为步骤编排模式
 * 2. 消除5层嵌套，控制在2层以内
 * 3. 每个步骤职责单一，可独立测试
 *
 * 原554行函数已备份至 pipeline_legacy.ts
 */

import {
  DOUYIN_PIPELINE_STEPS,
  type DouyinPipelineStep,
  type DouyinPipelineStepStatus,
  type DouyinPipelineProgress,
  type DouyinVideoInfo
} from '@/lib/douyin/pipeline-steps'
import { selectApiKey } from '@/lib/ai/key-manager'

// 导入步骤函数
import {
  parseShareLink,
  fetchVideoDetail,
  downloadVideo,
  extractAudio,
  transcribeAudio,
  optimizeTranscriptStep,
  summarize
} from '@/lib/douyin/steps'

// ============================================================================
// 类型定义
// ============================================================================

export interface DouyinPipelineProgressEvent extends DouyinPipelineProgress {
  type: 'progress'
}

export interface DouyinPipelineInfoEvent {
  type: 'info'
  videoInfo: DouyinVideoInfo
}

export interface DouyinPipelinePartialEvent {
  type: 'partial'
  key: 'transcript' | 'markdown' | 'optimized' | 'warn'
  data: string
  append?: boolean
}

export interface DouyinPipelineDoneEvent {
  type: 'done'
  markdown: string
  videoInfo: DouyinVideoInfo
  transcript: string
}

export interface DouyinPipelineErrorEvent {
  type: 'error'
  message: string
  step?: DouyinPipelineStep
  cause?: unknown
}

export type DouyinPipelineEvent =
  | DouyinPipelineProgressEvent
  | DouyinPipelineInfoEvent
  | DouyinPipelinePartialEvent
  | DouyinPipelineDoneEvent
  | DouyinPipelineErrorEvent

export type DouyinPipelineEmitter = (
  event: DouyinPipelineEvent
) => void | Promise<void>

export interface DouyinPipelineOptions {
  signal?: AbortSignal
}

export interface DouyinPipelineResult {
  markdown: string
  videoInfo: DouyinVideoInfo
  transcript: string
}

// ============================================================================
// 错误类
// ============================================================================

class DouyinPipelineAbortError extends Error {
  constructor() {
    super('Douyin pipeline aborted')
    this.name = 'AbortError'
  }
}

export class DouyinPipelineStepError extends Error {
  constructor(
    message: string,
    public step: DouyinPipelineStep,
    public cause?: unknown
  ) {
    super(message)
    this.name = 'DouyinPipelineStepError'
  }
}

// ============================================================================
// 工具函数
// ============================================================================

async function emitProgress(
  emit: DouyinPipelineEmitter,
  step: DouyinPipelineStep,
  status: DouyinPipelineStepStatus,
  detail?: string
) {
  const index = DOUYIN_PIPELINE_STEPS.findIndex((item) => item.key === step)
  if (index === -1) return

  const total = DOUYIN_PIPELINE_STEPS.length
  const completedSteps = status === 'completed' ? index + 1 : index
  const percentage = Math.max(
    0,
    Math.min(100, Math.round((completedSteps / total) * 100))
  )

  await emit({
    type: 'progress',
    step,
    status,
    index,
    total,
    percentage,
    detail,
    label: DOUYIN_PIPELINE_STEPS[index].label,
    description: DOUYIN_PIPELINE_STEPS[index].description
  })
}

// ============================================================================
// Pipeline上下文接口
// ============================================================================

interface PipelineContext {
  shareLink: string
  videoId?: string
  videoInfo?: DouyinVideoInfo
  playUrl?: string
  awemeDetail?: any
  videoBuffer?: Buffer
  audioBuffer?: Buffer
  transcript?: string
  optimizedTranscript?: string
  markdown?: string
}

// ============================================================================
// 主函数 - 重构后仅约80行（从554行压缩）
// ============================================================================

/**
 * 运行抖音视频Pipeline
 *
 * 重构后的简洁版本：
 * - 步骤编排模式，易于理解和维护
 * - 消除5层嵌套，只有1层循环
 * - 每个步骤可独立测试
 */
export async function runDouyinPipeline(
  shareLink: string,
  emit: DouyinPipelineEmitter,
  options: DouyinPipelineOptions = {}
): Promise<DouyinPipelineResult> {
  const signal = options.signal

  // 获取API Key
  const asrApiKey = process.env.DOUBAO_ASR_API_KEY || process.env.LLM_API_KEY
  if (!asrApiKey) {
    const error = new DouyinPipelineStepError('未配置语音识别API密钥', 'parse-link')
    await emit({ type: 'error', message: error.message, step: error.step })
    throw error
  }

  const optimizeModelId = 'claude-sonnet-4-5-20250929'
  const { apiKey: optimizeApiKey } = selectApiKey(optimizeModelId)

  // 初始化上下文
  let context: PipelineContext = { shareLink }

  try {
    // ========== 步骤1: 解析链接 ==========
    await emitProgress(emit, 'parse-link', 'active')
    const parseResult = await parseShareLink({ shareLink: context.shareLink }, signal)
    context.videoId = parseResult.videoId
    await emitProgress(emit, 'parse-link', 'completed')

    // ========== 步骤2: 获取视频详情 ==========
    await emitProgress(emit, 'fetch-detail', 'active')
    const detailResult = await fetchVideoDetail(
      { videoId: context.videoId! },
      signal
    )
    context.videoInfo = detailResult.videoInfo
    context.playUrl = detailResult.playUrl
    context.awemeDetail = detailResult.awemeDetail

    await emit({ type: 'info', videoInfo: context.videoInfo })
    await emitProgress(emit, 'fetch-detail', 'completed')

    // ========== 步骤3: 下载视频 ==========
    await emitProgress(emit, 'download-video', 'active', '准备下载视频文件')
    const downloadResult = await downloadVideo(
      { playUrl: context.playUrl! },
      emit,
      signal
    )
    context.videoBuffer = downloadResult.videoBuffer
    await emitProgress(emit, 'download-video', 'completed', '下载完成')

    // ========== 步骤4: 提取音频 ==========
    await emitProgress(emit, 'extract-audio', 'active')
    const audioResult = await extractAudio(
      { videoBuffer: context.videoBuffer! },
      signal
    )
    context.audioBuffer = audioResult.audioBuffer
    await emitProgress(emit, 'extract-audio', 'completed')

    // ========== 步骤5: 转录音频 ==========
    await emitProgress(emit, 'transcribe-audio', 'active', '正在向ASR服务请求转录')
    const transcribeResult = await transcribeAudio(
      { audioBuffer: context.audioBuffer! },
      emit,
      asrApiKey,
      signal
    )
    context.transcript = transcribeResult.transcript
    await emitProgress(emit, 'transcribe-audio', 'completed', '转录完成')

    // ========== 步骤6: 优化文本 ==========
    await emitProgress(emit, 'optimize', 'active', '正在清理转录文本...')
    const optimizeResult = await optimizeTranscriptStep(
      {
        transcript: context.transcript!,
        videoInfo: context.videoInfo!,
        awemeDetail: context.awemeDetail
      },
      emit,
      optimizeApiKey,
      optimizeModelId,
      signal
    )
    context.optimizedTranscript = optimizeResult.optimizedTranscript
    await emitProgress(
      emit,
      'optimize',
      'completed',
      optimizeResult.optimizationUsed ? 'AI优化完成' : '基础清理完成'
    )

    // ========== 步骤7: 生成Markdown ==========
    await emitProgress(emit, 'summarize', 'active')
    const summarizeResult = await summarize(
      {
        videoInfo: context.videoInfo!,
        optimizedTranscript: context.optimizedTranscript!
      },
      emit,
      signal
    )
    context.markdown = summarizeResult.markdown
    await emitProgress(emit, 'summarize', 'completed')

    // ========== 完成 ==========
    const result: DouyinPipelineResult = {
      markdown: context.markdown!,
      videoInfo: context.videoInfo!,
      transcript: context.optimizedTranscript!
    }

    await emit({
      type: 'done',
      markdown: result.markdown,
      videoInfo: result.videoInfo,
      transcript: result.transcript
    })

    return result
  } catch (error) {
    // 统一错误处理
    if (error instanceof DouyinPipelineAbortError) {
      await emit({
        type: 'error',
        message: '抖音处理已取消',
        step: 'parse-link'
      })
      throw error
    }

    if (error instanceof DouyinPipelineStepError) {
      await emit({
        type: 'error',
        message: error.message,
        step: error.step,
        cause: error.cause
      })
      throw error
    }

    const fallbackError = new DouyinPipelineStepError(
      error instanceof Error ? error.message : '抖音处理失败',
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
