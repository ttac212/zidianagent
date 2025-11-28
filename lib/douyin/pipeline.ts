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
import { DOUYIN_DEFAULT_HEADERS, DOUYIN_PIPELINE_LIMITS } from '@/lib/douyin/constants'
import { withAbortableTimeout, TimeoutError } from '@/lib/utils/abort-utils'

// 导入步骤函数
import {
  parseShareLink,
  fetchVideoDetail,
  transcribeAudio,
  transcribeVideoWithWhisper,
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
  audioUrl?: string | null  // 音频直链
  playUrl?: string  // 视频播放URL（用于回退方案）
  awemeDetail?: any
  audioBuffer?: Buffer
  videoBuffer?: Buffer  // 视频文件（用于Whisper直接转录）
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

  // 优化步骤使用 302.AI 的 API Key
  const optimizeApiKey = process.env.LLM_API_KEY

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
    context.audioUrl = detailResult.audioUrl  // 音频直链
    context.playUrl = detailResult.playUrl    // 视频播放URL（用于回退）
    context.awemeDetail = detailResult.awemeDetail

    await emit({ type: 'info', videoInfo: context.videoInfo })
    await emitProgress(emit, 'fetch-detail', 'completed')

    // ========== 步骤3: 下载音频/视频 ==========
    // 优先使用音频直链，如果不可用则下载视频用于Whisper转录
    let useWhisperFallback = false

    if (context.audioUrl) {
      // 方案A: 音频直链可用，直接下载音频
      await emitProgress(emit, 'download-audio', 'active', '下载音频文件')

      try {
        const audioBuffer = await withAbortableTimeout(
          async (linkedSignal) => {
            const audioResponse = await fetch(context.audioUrl!, {
              headers: DOUYIN_DEFAULT_HEADERS,
              signal: linkedSignal
            })

            if (!audioResponse.ok) {
              throw new Error(`HTTP ${audioResponse.status}`)
            }

            return Buffer.from(await audioResponse.arrayBuffer())
          },
          {
            timeoutMs: DOUYIN_PIPELINE_LIMITS.DOWNLOAD_TIMEOUT_MS,
            timeoutMessage: '音频下载超时',
            signal
          }
        )

        context.audioBuffer = audioBuffer
        await emitProgress(emit, 'download-audio', 'completed', `音频下载完成 (${(audioBuffer.length / 1024).toFixed(0)} KB)`)
      } catch (error) {
        // 音频下载失败，尝试回退到视频方案
        const errorMessage = error instanceof Error ? error.message : String(error)

        // 用户主动取消不回退
        if (signal && signal.aborted) {
          throw new DouyinPipelineStepError('用户取消请求', 'download-audio', error)
        }

        console.warn(`[Pipeline] 音频下载失败 (${errorMessage})，尝试下载视频...`)
        await emit({
          type: 'partial',
          key: 'warn',
          data: `音频下载失败，正在切换到视频转录方案...`,
          append: false
        })
        useWhisperFallback = true
      }
    } else {
      // 方案B: 无音频直链，使用视频方案
      console.info('[Pipeline] 无音频直链，使用视频转录方案')
      await emit({
        type: 'partial',
        key: 'warn',
        data: '该视频无音频直链，正在使用视频转录方案...',
        append: false
      })
      useWhisperFallback = true
    }

    // 如果需要使用Whisper回退方案，下载视频
    if (useWhisperFallback) {
      if (!context.playUrl) {
        throw new DouyinPipelineStepError(
          '无法获取视频播放地址，转录失败',
          'download-audio'
        )
      }

      await emitProgress(emit, 'download-audio', 'active', '下载视频文件（Whisper方案）')

      try {
        const videoBuffer = await withAbortableTimeout(
          async (linkedSignal) => {
            const videoResponse = await fetch(context.playUrl!, {
              headers: DOUYIN_DEFAULT_HEADERS,
              signal: linkedSignal
            })

            if (!videoResponse.ok) {
              throw new Error(`HTTP ${videoResponse.status}`)
            }

            return Buffer.from(await videoResponse.arrayBuffer())
          },
          {
            timeoutMs: DOUYIN_PIPELINE_LIMITS.DOWNLOAD_TIMEOUT_MS * 2,  // 视频下载给更多时间
            timeoutMessage: '视频下载超时',
            signal
          }
        )

        context.videoBuffer = videoBuffer
        await emitProgress(emit, 'download-audio', 'completed', `视频下载完成 (${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB)`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (signal && signal.aborted) {
          throw new DouyinPipelineStepError('用户取消请求', 'download-audio', error)
        }

        const isTimeout = error instanceof TimeoutError
        throw new DouyinPipelineStepError(
          isTimeout ? '视频下载超时，请稍后重试' : `视频下载失败: ${errorMessage}`,
          'download-audio',
          error
        )
      }
    }

    // ========== 步骤4: 转录 ==========
    await emitProgress(emit, 'transcribe-audio', 'active', useWhisperFallback ? '使用Whisper转录视频' : '正在向ASR服务请求转录')

    if (useWhisperFallback && context.videoBuffer) {
      // 使用 Whisper API 直接转录视频
      const transcribeResult = await transcribeVideoWithWhisper(
        { videoBuffer: context.videoBuffer },
        emit,
        asrApiKey,
        signal
      )
      context.transcript = transcribeResult.transcript
    } else if (context.audioBuffer) {
      // 使用原有的音频转录方案
      const transcribeResult = await transcribeAudio(
        { audioBuffer: context.audioBuffer },
        emit,
        asrApiKey,
        signal
      )
      context.transcript = transcribeResult.transcript
    } else {
      throw new DouyinPipelineStepError('无可用的音频或视频数据', 'transcribe-audio')
    }

    await emitProgress(emit, 'transcribe-audio', 'completed', '转录完成')

    // ========== 步骤5: 优化文本 ==========
    await emitProgress(emit, 'optimize', 'active', '正在添加标点符号...')
    const optimizeResult = await optimizeTranscriptStep(
      {
        transcript: context.transcript!,
        videoInfo: context.videoInfo!,
        awemeDetail: context.awemeDetail
      },
      emit,
      optimizeApiKey,
      undefined,  // modelId 已废弃
      signal
    )
    context.optimizedTranscript = optimizeResult.optimizedTranscript
    await emitProgress(
      emit,
      'optimize',
      'completed',
      optimizeResult.optimizationUsed ? '标点符号添加完成' : '基础清理完成'
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
