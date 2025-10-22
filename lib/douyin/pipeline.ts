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

const ASR_ENDPOINT = 'https://api.302.ai/v1/chat/completions'
const DEFAULT_ASR_TIMEOUT_MS = 120_000
const ASR_MAX_RETRIES = 2

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}毫秒`
  }
  const seconds = ms / 1000
  if (seconds >= 10) {
    return `${Math.round(seconds)}秒`
  }
  return `${seconds.toFixed(1)}秒`
}

function createStepTimer() {
  const startedAt = new Map<DouyinPipelineStep, number>()

  return {
    markActive(step: DouyinPipelineStep) {
      if (!startedAt.has(step)) {
        startedAt.set(step, Date.now())
      }
    },
    getDetail(step: DouyinPipelineStep, detail?: string): string | undefined {
      const started = startedAt.get(step)
      if (!started) return detail
      const elapsed = Date.now() - started
      const durationText = `耗时 ${formatDuration(elapsed)}`
      return detail ? `${detail}，${durationText}` : durationText
    }
  }
}

function getAbortReason(signal: AbortSignal | undefined, fallback: string) {
  if (!signal) {
    return new Error(fallback)
  }
  const withReason = signal as AbortSignal & { reason?: unknown }
  return withReason.reason ?? new Error(fallback)
}

function createAbortableSignal(
  timeoutMs: number,
  timeoutMessage: string,
  external?: AbortSignal
) {
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(new Error(timeoutMessage))
    }, timeoutMs)
  }

  if (external) {
    if (external.aborted) {
      controller.abort(getAbortReason(external, '操作已取消'))
    } else {
      const handleAbort = () => {
        controller.abort(getAbortReason(external, '操作已取消'))
      }
      external.addEventListener('abort', handleAbort, { once: true })
      return {
        controller,
        signal: controller.signal,
        cleanup: () => {
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
          external.removeEventListener('abort', handleAbort)
        }
      }
    }
  }

  return {
    controller,
    signal: controller.signal,
    cleanup: () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }
}

export interface DouyinPipelineProgressEvent extends DouyinPipelineProgress {
  type: 'progress'
}

export interface DouyinPipelineInfoEvent {
  type: 'info'
  videoInfo: DouyinVideoInfo
}

export interface DouyinPipelinePartialEvent {
  type: 'partial'
  key: 'transcript' | 'markdown'
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

async function streamMarkdownChunks(
  emit: DouyinPipelineEmitter,
  markdown: string,
  signal: AbortSignal | undefined,
  chunkSize = 160
) {
  if (!markdown) return

  for (let offset = 0; offset < markdown.length; offset += chunkSize) {
    ensureActive(signal)
    const chunk = markdown.slice(offset, offset + chunkSize)
    await emit({
      type: 'partial',
      key: 'markdown',
      data: chunk,
      append: offset !== 0
    })
  }
}

function resolvePlayableVideoUrl(video: any): string | null {
  if (!video) return null

  type Candidate = { url: string; priority: number }

  const candidates: Candidate[] = []

  const pushUrls = (urls: unknown, priority: number) => {
    if (!Array.isArray(urls)) return
    for (const rawUrl of urls) {
      if (typeof rawUrl !== 'string' || !rawUrl) continue
      const sanitized = rawUrl.includes('playwm')
        ? rawUrl.replace('playwm', 'play')
        : rawUrl
      candidates.push({ url: sanitized, priority })
    }
  }

  const music = video?.music
  if (music) {
    pushUrls(music.play_url?.url_list, 0)
    pushUrls(music.play_url_lowbr?.url_list, 0)
  }

  pushUrls(video?.video?.play_addr_lowbr?.url_list, 1)

  if (Array.isArray(video?.video?.bit_rate)) {
    for (const item of video.video.bit_rate) {
      const bitrate = typeof item?.bit_rate === 'number' ? item.bit_rate : 0
      const dynamicPriority =
        bitrate > 0 ? Math.min(9, 2 + Math.round(bitrate / 1_000_000)) : 4
      pushUrls(item?.play_addr?.url_list, dynamicPriority)
    }
  }

  pushUrls(video?.video?.play_addr?.url_list, 8)
  pushUrls(video?.video?.download_addr?.url_list, 9)

  if (candidates.length === 0) {
    return null
  }

  const bestByUrl = new Map<string, Candidate>()
  for (const candidate of candidates) {
    const existing = bestByUrl.get(candidate.url)
    if (!existing || candidate.priority < existing.priority) {
      bestByUrl.set(candidate.url, candidate)
    }
  }

  const ordered = Array.from(bestByUrl.values()).sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority
    }
    const aIsAweme = a.url.includes('aweme')
    const bIsAweme = b.url.includes('aweme')
    if (aIsAweme !== bIsAweme) {
      return aIsAweme ? -1 : 1
    }
    return a.url.length - b.url.length
  })

  return ordered[0]?.url ?? null
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
  const stepTimer = createStepTimer()
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

    stepTimer.markActive('parse-link')
    await emitProgress(emit, 'parse-link', 'active')
    let shareResult
    try {
      shareResult = await parseDouyinVideoShare(shareLink)
    } catch (error) {
      throw new DouyinPipelineStepError(
        error instanceof Error ? error.message : '链接解析失败',
        'parse-link',
        error
      )
    }
    ensureActive(signal)

    if (!shareResult.videoId) {
      throw new DouyinPipelineStepError('无法从链接中提取视频ID', 'parse-link')
    }
    await emitProgress(
      emit,
      'parse-link',
      'completed',
      stepTimer.getDetail('parse-link')
    )

    stepTimer.markActive('fetch-detail')
    await emitProgress(emit, 'fetch-detail', 'active')
    const tikhubClient = getTikHubClient()
    let videoDetail
    try {
      videoDetail = await tikhubClient.getVideoDetail({
        aweme_id: shareResult.videoId
      })
    } catch (error) {
      throw new DouyinPipelineStepError(
        error instanceof Error ? error.message : 'TikHub API调用失败',
        'fetch-detail',
        error
      )
    }
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
    await emitProgress(
      emit,
      'fetch-detail',
      'completed',
      stepTimer.getDetail('fetch-detail')
    )

    stepTimer.markActive('download-video')
    await emitProgress(emit, 'download-video', 'active', '准备下载视频文件')
    const requestHeaders: Record<string, string> = {
      ...DOUYIN_DEFAULT_HEADERS
    }

    let headInfo
    let videoBuffer
    let lastDownloadPercent = -1
    try {
      headInfo = await VideoProcessor.getVideoInfo(playableUrl, {
        headers: requestHeaders
      })
      ensureActive(signal)

      const downloadResult = await VideoProcessor.downloadVideo(
        playableUrl,
        headInfo,
        {
          headers: requestHeaders,
          signal,
          onProgress: async (downloaded, total) => {
            const percent =
              total > 0 ? Math.floor((downloaded / total) * 100) : undefined
            if (
              typeof percent === 'number' &&
              percent !== lastDownloadPercent &&
              percent < 100
            ) {
              lastDownloadPercent = percent
              await emitProgress(
                emit,
                'download-video',
                'active',
                `下载进度 ${percent}%`
              )
            }
            ensureActive(signal)
          }
        }
      )
      videoBuffer = downloadResult.buffer
      ensureActive(signal)
    } catch (error) {
      throw new DouyinPipelineStepError(
        error instanceof Error ? error.message : '视频下载失败',
        'download-video',
        error
      )
    }
    await emitProgress(
      emit,
      'download-video',
      'completed',
      stepTimer.getDetail('download-video', '下载完成')
    )

    stepTimer.markActive('extract-audio')
    await emitProgress(emit, 'extract-audio', 'active')
    let audioBuffer
    try {
      audioBuffer = await VideoProcessor.extractAudio(videoBuffer, {
        format: 'mp3',
        sampleRate: 16000,
        channels: 1,
        bitrate: '128k'
      })
      ensureActive(signal)
    } catch (error) {
      throw new DouyinPipelineStepError(
        error instanceof Error ? error.message : '音频提取失败',
        'extract-audio',
        error
      )
    }
    await emitProgress(
      emit,
      'extract-audio',
      'completed',
      stepTimer.getDetail('extract-audio')
    )

    stepTimer.markActive('transcribe-audio')
    await emitProgress(
      emit,
      'transcribe-audio',
      'active',
      '正在向ASR服务请求转录'
    )
    const base64Audio = audioBuffer.toString('base64')

    const asrPayload = {
      model: 'gpt-4o-audio-preview',
      modalities: ['text'],
      max_tokens: 4000,
      temperature: 0.1,
      stream: true,
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
    }

    const asrBody = JSON.stringify(asrPayload)
    let asrResponse: Response | null = null
    let attempt = 0

    while (attempt <= ASR_MAX_RETRIES) {
      ensureActive(signal)
      const { controller, signal: asrSignal, cleanup } = createAbortableSignal(
        DEFAULT_ASR_TIMEOUT_MS,
        'ASR 请求超时',
        signal
      )

      try {
        const response = await fetch(ASR_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: asrBody,
          signal: asrSignal
        })
        cleanup()

        if (!response.ok) {
          const errorText = await response.text()
          const errorMessage = `GPT-4o转录失败: ${response.status} - ${errorText}`
          if (response.status >= 500 && attempt < ASR_MAX_RETRIES) {
            await emitProgress(
              emit,
              'transcribe-audio',
              'active',
              `ASR 服务响应异常 (${response.status})，准备重试 ${attempt + 2}/${ASR_MAX_RETRIES + 1}`
            )
            attempt += 1
            continue
          }
          throw new DouyinPipelineStepError(errorMessage, 'transcribe-audio')
        }

        asrResponse = response
        break
      } catch (error) {
        cleanup()

        if (controller.signal.aborted) {
          const reason = controller.signal.reason
          const reasonMessage =
            reason instanceof Error
              ? reason.message
              : typeof reason === 'string'
              ? reason
              : 'ASR 请求已取消'

          if (reasonMessage.includes('超时')) {
            if (attempt < ASR_MAX_RETRIES) {
              await emitProgress(
                emit,
                'transcribe-audio',
                'active',
                `ASR 请求超时，准备重试 ${attempt + 2}/${ASR_MAX_RETRIES + 1}`
              )
              attempt += 1
              continue
            }

            throw new DouyinPipelineStepError(
              reasonMessage,
              'transcribe-audio',
              reason
            )
          }

          ensureActive(signal)
          throw new DouyinPipelineAbortError()
        }

        if (error instanceof DouyinPipelineStepError) {
          throw error
        }

        if (attempt < ASR_MAX_RETRIES) {
          const message =
            error instanceof Error ? error.message : '未知错误（准备重试）'
          await emitProgress(
            emit,
            'transcribe-audio',
            'active',
            `ASR 请求失败（${message}），准备重试 ${attempt + 2}/${ASR_MAX_RETRIES + 1}`
          )
          attempt += 1
          continue
        }

        throw new DouyinPipelineStepError(
          error instanceof Error ? error.message : 'ASR API请求失败',
          'transcribe-audio',
          error
        )
      }
    }

    ensureActive(signal)

    if (!asrResponse) {
      throw new DouyinPipelineStepError(
        'ASR API请求失败',
        'transcribe-audio'
      )
    }

    // 处理流式响应
    const reader = asrResponse.body?.getReader()
    if (!reader) {
      throw new DouyinPipelineStepError('无法读取转录响应流', 'transcribe-audio')
    }

    const decoder = new TextDecoder()
    let transcript = ''
    let buffer = ''
    let receivedDone = false
    let readerClosed = false

    const processLine = async (rawLine: string): Promise<boolean> => {
      ensureActive(signal)
      const line = rawLine.trim()
      if (!line) return false
      if (line === 'data: [DONE]') {
        return true
      }

      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          const delta = data.choices?.[0]?.delta?.content

          if (delta) {
            transcript += delta
            await emit({
              type: 'partial',
              key: 'transcript',
              data: delta,
              append: true
            })
          }
        } catch {
          // 忽略解析错误，继续处理
        }
      }

      return false
    }

    try {
      while (!receivedDone) {
        ensureActive(signal)
        const { done, value } = await reader.read()

        if (done) {
          readerClosed = true
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const shouldStop = await processLine(line)
          if (shouldStop) {
            receivedDone = true
            break
          }
        }
      }

      if (!receivedDone && buffer) {
        receivedDone = await processLine(buffer)
      }
    } finally {
      if (!readerClosed && receivedDone) {
        try {
          await reader.cancel()
        } catch {
          // ignore cancel errors
        }
      }
      reader.releaseLock()
    }

    if (!transcript) {
      throw new DouyinPipelineStepError('转录失败,未返回文本', 'transcribe-audio')
    }

    await emitProgress(
      emit,
      'transcribe-audio',
      'completed',
      stepTimer.getDetail('transcribe-audio', '转录完成')
    )

    await emitProgress(emit, 'optimize', 'active')
    const optimizedTranscript = optimizeTranscript(transcript)
    await emitProgress(emit, 'optimize', 'completed')

    await emitProgress(emit, 'summarize', 'active')
    const markdown = buildMarkdown(videoInfo, optimizedTranscript)
    await streamMarkdownChunks(emit, markdown, signal)
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
