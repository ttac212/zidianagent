import { parseDouyinVideoShare } from '@/lib/douyin/share-link'
import { getTikHubClient } from '@/lib/tikhub'
import { VideoProcessor } from '@/lib/video/video-processor'
import { DOUYIN_DEFAULT_HEADERS } from '@/lib/douyin/constants'
import {
  DOUYIN_PIPELINE_STEPS,
  type DouyinPipelineStep,
  type DouyinPipelineStepStatus,
  type DouyinPipelineProgress,
  type DouyinVideoInfo
} from '@/lib/douyin/pipeline-steps'

export interface DouyinPipelineProgressEvent extends DouyinPipelineProgress {
  type: 'progress'
}

export interface DouyinPipelineInfoEvent {
  type: 'info'
  videoInfo: DouyinVideoInfo
}

export interface DouyinPipelinePartialEvent {
  type: 'partial'
  key: 'transcript'
  data: string
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

function ensureActive(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new DouyinPipelineAbortError()
  }
}

async function emitProgress(
  emit: DouyinPipelineEmitter,
  step: DouyinPipelineStep,
  status: DouyinPipelineStepStatus,
  detail?: string
) {
  const index = DOUYIN_PIPELINE_STEPS.findIndex((item) => item.key === step)

  if (index === -1) {
    return
  }

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

function resolvePlayableVideoUrl(video: any): string | null {
  if (!video) return null

  const candidates: Array<string | undefined> = []

  if (Array.isArray(video?.video?.play_addr?.url_list)) {
    candidates.push(...video.video.play_addr.url_list)
  }

  if (Array.isArray(video?.video?.bit_rate)) {
    for (const item of video.video.bit_rate) {
      if (Array.isArray(item?.play_addr?.url_list)) {
        candidates.push(...item.play_addr.url_list)
      }
    }
  }

  if (Array.isArray(video?.video?.download_addr?.url_list)) {
    candidates.push(...video.video.download_addr.url_list)
  }

  if (Array.isArray(video?.video?.play_addr_lowbr?.url_list)) {
    candidates.push(...video.video.play_addr_lowbr.url_list)
  }

  const sanitized = candidates
    .map((url) => (url?.includes('playwm') ? url.replace('playwm', 'play') : url))
    .filter((url): url is string => Boolean(url))

  return sanitized.find((url) => url.includes('aweme')) || sanitized[0] || null
}

function normalizeDurationSeconds(duration?: number | null): number {
  if (!duration || Number.isNaN(duration)) return 0
  return duration >= 1000 ? duration / 1000 : duration
}

function optimizeTranscript(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

function buildMarkdown(info: DouyinVideoInfo, transcript: string): string {
  const durationText =
    info.duration > 0 ? `${info.duration.toFixed(1)}秒` : '未知时长'

  return [
    '📹 **抖音视频信息**',
    '',
    `**标题**: ${info.title}`,
    `**作者**: ${info.author}`,
    `**时长**: ${durationText}`,
    `**视频ID**: ${info.videoId}`,
    '',
    '---',
    '',
    '📝 **转录文案**',
    '',
    transcript,
    '',
    '---',
    '',
    '✅ 视频信息提取完成! 你可以继续提问或让我分析这个视频内容。'
  ].join('\n')
}

export async function runDouyinPipeline(
  shareLink: string,
  emit: DouyinPipelineEmitter,
  options: DouyinPipelineOptions = {}
): Promise<DouyinPipelineResult> {
  const signal = options.signal
  const apiKey = process.env.DOUBAO_ASR_API_KEY || process.env.LLM_API_KEY

  if (!apiKey) {
    const error = new DouyinPipelineStepError('未配置语音识别API密钥', 'parse-link')
    await emit({
      type: 'error',
      message: error.message,
      step: error.step
    })
    throw error
  }

  try {
    ensureActive(signal)

    await emitProgress(emit, 'parse-link', 'active')
    const shareResult = await parseDouyinVideoShare(shareLink)
    ensureActive(signal)

    if (!shareResult.videoId) {
      throw new DouyinPipelineStepError('无法从链接中提取视频ID', 'parse-link')
    }
    await emitProgress(emit, 'parse-link', 'completed')

    await emitProgress(emit, 'fetch-detail', 'active')
    const tikhubClient = getTikHubClient()
    const videoDetail = await tikhubClient.getVideoDetail({
      aweme_id: shareResult.videoId
    })
    ensureActive(signal)

    const awemeDetail = videoDetail?.aweme_detail
    if (!awemeDetail) {
      throw new DouyinPipelineStepError(
        'TikHub未返回视频详情数据',
        'fetch-detail'
      )
    }

    const playableUrl = resolvePlayableVideoUrl(awemeDetail)
    if (!playableUrl) {
      throw new DouyinPipelineStepError(
        '未能获取可用的视频播放地址',
        'fetch-detail'
      )
    }

    const videoInfo: DouyinVideoInfo = {
      title: awemeDetail.desc || '未知标题',
      author: awemeDetail.author?.nickname || '未知作者',
      duration: normalizeDurationSeconds(awemeDetail.video?.duration),
      videoId: shareResult.videoId,
      coverUrl: awemeDetail.video?.cover?.url_list?.[0]
    }

    await emit({
      type: 'info',
      videoInfo
    })
    await emitProgress(emit, 'fetch-detail', 'completed')

    await emitProgress(emit, 'download-video', 'active', '准备下载视频文件')
    const requestHeaders: Record<string, string> = {
      ...DOUYIN_DEFAULT_HEADERS
    }

    const headInfo = await VideoProcessor.getVideoInfo(playableUrl, {
      headers: requestHeaders
    })
    ensureActive(signal)

    const videoBuffer = await VideoProcessor.downloadChunk(
      playableUrl,
      0,
      headInfo.size - 1,
      { headers: requestHeaders }
    )
    ensureActive(signal)
    await emitProgress(emit, 'download-video', 'completed')

    await emitProgress(emit, 'extract-audio', 'active')
    const audioBuffer = await VideoProcessor.extractAudio(videoBuffer, {
      format: 'mp3',
      sampleRate: 16000,
      channels: 1,
      bitrate: '128k'
    })
    ensureActive(signal)
    await emitProgress(emit, 'extract-audio', 'completed')

    await emitProgress(emit, 'transcribe-audio', 'active')
    const base64Audio = audioBuffer.toString('base64')

    const asrResponse = await fetch('https://api.302.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-audio-preview',
        modalities: ['text'],
        max_tokens: 4000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '请转录这段音频的内容,只返回转录的文字,不要添加任何说明或解释。'
              },
              {
                type: 'input_audio',
                input_audio: {
                  data: base64Audio,
                  format: 'mp3'
                }
              }
            ]
          }
        ]
      }),
      signal
    })

    ensureActive(signal)

    if (!asrResponse.ok) {
      const errorText = await asrResponse.text()
      throw new DouyinPipelineStepError(
        `GPT-4o转录失败: ${asrResponse.status} - ${errorText}`,
        'transcribe-audio'
      )
    }

    const asrResult = await asrResponse.json()
    const transcript =
      asrResult?.choices?.[0]?.message?.content ||
      asrResult?.choices?.[0]?.delta?.content ||
      ''

    if (!transcript) {
      throw new DouyinPipelineStepError('转录失败,未返回文本', 'transcribe-audio')
    }

    await emit({
      type: 'partial',
      key: 'transcript',
      data: transcript
    })
    await emitProgress(emit, 'transcribe-audio', 'completed')

    await emitProgress(emit, 'optimize', 'active')
    const optimizedTranscript = optimizeTranscript(transcript)
    await emitProgress(emit, 'optimize', 'completed')

    await emitProgress(emit, 'summarize', 'active')
    const markdown = buildMarkdown(videoInfo, optimizedTranscript)
    await emitProgress(emit, 'summarize', 'completed')

    const result: DouyinPipelineResult = {
      markdown,
      videoInfo,
      transcript: optimizedTranscript
    }

    await emit({
      type: 'done',
      markdown,
      videoInfo,
      transcript: optimizedTranscript
    })

    return result
  } catch (error) {
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
