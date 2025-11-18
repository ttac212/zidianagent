import { parseDouyinVideoShare } from '@/lib/douyin/share-link'
import { getTikHubClient } from '@/lib/tikhub'
import { VideoProcessor } from '@/lib/video/video-processor'
import { DOUYIN_DEFAULT_HEADERS } from '@/lib/douyin/constants'
import { selectApiKey } from '@/lib/ai/key-manager'
import {
  DOUYIN_PIPELINE_STEPS,
  type DouyinPipelineStep,
  type DouyinPipelineStepStatus,
  type DouyinPipelineProgress,
  type DouyinVideoInfo
} from '@/lib/douyin/pipeline-steps'
import { processSSEStream } from '@/lib/utils/sse-parser'

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

/**
 * 使用LLM优化转录文案（流式版本，支持取消和超时）
 *
 * @param text 原始转录文本
 * @param apiKey API密钥
 * @param modelId 模型ID
 * @param videoInfo 视频元数据
 * @param options 配置选项
 * @returns 优化后的文本，失败返回null
 */
async function optimizeTranscriptWithLLM(
  text: string,
  apiKey: string,
  modelId: string,
  videoInfo: {
    title: string
    author: string
    hashtags?: string[]
    videoTags?: string[]
  },
  options: {
    signal?: AbortSignal
    onProgress?: (chunk: string) => void | Promise<void>
    timeoutMs?: number
    maxRetries?: number
  } = {}
): Promise<string | null> {
  const {
    signal,
    onProgress,
    timeoutMs = 45000, // 45秒超时（LLM优化比ASR快）
    maxRetries = 1 // 失败自动重试1次
  } = options

  // 使用 ZenMux API 进行文案优化
  const apiBase = process.env.ZENMUX_API_BASE || 'https://zenmux.ai/api/v1'
  const optimizationModel = process.env.ZENMUX_DEFAULT_MODEL || 'anthropic/claude-sonnet-4.5'
  const zenmuxApiKey = process.env.ZENMUX_API_KEY || apiKey

  // 构建视频上下文信息
  const contextParts = [
    `视频标题：${videoInfo.title}`,
    `作者：${videoInfo.author}`
  ]

  if (videoInfo.hashtags && videoInfo.hashtags.length > 0) {
    contextParts.push(`话题标签：${videoInfo.hashtags.join('、')}`)
  }

  if (videoInfo.videoTags && videoInfo.videoTags.length > 0) {
    contextParts.push(`视频标签：${videoInfo.videoTags.join('、')}`)
  }

  const contextInfo = contextParts.join('\n')

  const requestBody = {
    model: optimizationModel,
    stream: true, // 启用流式输出
    messages: [
      {
        role: 'system',
        content: `你是一个专业的抖音视频文案编辑。你的核心任务是利用视频的标题、标签等上下文信息，修正语音转录中的同音字错误和识别错误。

**工作流程：**
1. **仔细阅读视频上下文信息**（标题、作者、标签），理解视频主题
2. **识别关键词**：从标题和标签中提取地名、人名、品牌、专业术语等关键信息
3. **逐句核对转录文本**：检查是否有与关键词发音相同但字形错误的内容
4. **修正错误**：
   - 地名错误：如"南京"→"南宁"（根据标题确认）
   - 人名错误：如"金姐"→"君姐"（根据作者名确认）
   - 品牌/术语错误：根据标签中的规范写法修正
5. **添加标点**：为文本添加适当的标点符号和段落
6. **保持原意**：只修正错误，不添加原文没有的内容

**重要原则：**
- **优先使用视频标题和标签中的词语**：如果转录文本中出现与标题/标签发音相似的词，必须以标题/标签为准
- **地名、人名必须严格核对**：这类错误最常见，必须仔细比对
- **专业术语以标签为准**：标签中的写法通常是规范的
- 直接输出优化后的文本，不要添加任何说明`,
      },
      {
        role: 'user',
        content: `【示例1：地名和人名纠错】
视频信息：
标题：君姐在南宁做旧房改造
作者：君姐改旧房

转录文本：
"金姐在南京做了15年旧房改造..."

正确修正：
"君姐在南宁做了15年旧房改造..."

---

【示例2：专业术语纠错】
视频信息：
标题：iPhone 15 Pro Max 开箱
话题标签：#苹果手机 #iPhone15ProMax

转录文本：
"今天给大家开箱爱疯15 Pro Max..."

正确修正：
"今天给大家开箱iPhone 15 Pro Max..."

---

现在请你修正以下视频的转录文本：`,
      },
      {
        role: 'user',
        content: `${contextInfo}

---

**转录文本：**
${text}

---

**修正要求：**
1. 检查转录文本中是否有与标题、作者、标签发音相同但写法不同的词语，如有则修正为标题/标签中的写法
2. 特别注意地名、人名、品牌名的正确性
3. 添加标点符号，使文本更易读
4. 直接返回修正后的文本，不要任何解释`,
      },
    ],
    max_tokens: 4000,
    temperature: 0.2,
  }

  // 重试逻辑
  let attempt = 0
  while (attempt <= maxRetries) {
    let cleanup: (() => void) | undefined

    try {
      // 创建带超时的AbortSignal
      const abortable = createAbortableSignal(
        timeoutMs,
        `LLM优化超时（${timeoutMs}ms）`,
        signal
      )
      cleanup = abortable.cleanup

      const response = await fetch(`${apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${zenmuxApiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: abortable.signal
      })

      cleanup()

      if (!response.ok) {
        const _errorText = await response.text()
        const statusCode = response.status

        // 5xx错误可以重试，4xx不重试
        if (statusCode >= 500 && attempt < maxRetries) {
          attempt += 1
          continue
        }

        return null
      }

      // 处理流式响应
      const reader = response.body?.getReader()
      if (!reader) {
        return null
      }

      try {
        let optimizedText = ''

        // 使用统一的 SSE 解析器 (支持 ZenMux 和标准格式)
        await processSSEStream(reader, {
          onContent: async (content) => {
            ensureActive(abortable.signal)
            optimizedText += content
            // 实时通知进度
            if (onProgress) {
              await onProgress(content)
            }
          },
          onError: (error) => {
            console.error('[优化文本] SSE错误:', error)
          }
        })

        return optimizedText || null
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      cleanup?.()

      // 如果是用户取消，直接抛出
      if (signal?.aborted) {
        throw new DouyinPipelineAbortError()
      }

      // 超时错误
      if (error instanceof Error && error.message.includes('超时')) {
        if (attempt < maxRetries) {
          attempt += 1
          continue
        }
        return null
      }

      // 其他错误
      if (attempt < maxRetries) {
        attempt += 1
        continue
      }

      return null
    }
  }

  return null
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
    '视频信息提取完成! 你可以继续提问或让我分析这个视频内容。'
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
              text: `这是一段抖音视频的音频转录任务。请仔细转录音频内容，注意以下要点：

1. **准确识别**：尽可能准确地识别每个字词，特别注意处理方言口音和不标准发音
2. **同音字辨析**：遇到同音字时，结合上下文语境选择正确的汉字
3. **专业术语**：遇到行业术语、品牌名称或网络用语时，使用最常见的规范写法
4. **保持原意**：完整转录说话内容，包括语气词（如"嗯"、"啊"、"哦"等）
5. **纯文本输出**：只返回转录的文字，不要添加任何说明、解释或格式标记

请开始转录：`
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

    let transcript = ''
    let readerClosed = false

    try {
      // 使用统一的 SSE 解析器 (支持 ZenMux 和标准格式)
      await processSSEStream(reader, {
        onContent: async (content) => {
          ensureActive(signal)
          transcript += content
          await emit({
            type: 'partial',
            key: 'transcript',
            data: content,
            append: true
          })
        },
        onError: (error) => {
          console.error('[转录] SSE错误:', error)
        },
        onFinish: () => {
          readerClosed = true
        }
      })
    } catch (streamError) {
      if (!readerClosed) {
        try {
          await reader.cancel()
        } catch {
          // ignore cancel errors
        }
      }
      reader.releaseLock()
      throw streamError
    }

    reader.releaseLock()

    if (!transcript) {
      throw new DouyinPipelineStepError('转录失败,未返回文本', 'transcribe-audio')
    }

    await emitProgress(
      emit,
      'transcribe-audio',
      'completed',
      stepTimer.getDetail('transcribe-audio', '转录完成')
    )

    // 先做基础清理
    stepTimer.markActive('optimize')
    await emitProgress(emit, 'optimize', 'active', '正在清理转录文本...')
    const cleanedTranscript = optimizeTranscript(transcript)

    // 提取视频元数据
    const hashtags = awemeDetail.text_extra
      ?.filter((item: any) => item.hashtag_name)
      .map((item: any) => item.hashtag_name) || []

    const videoTags = awemeDetail.video_tag
      ?.map((tag: any) => tag.tag_name)
      .filter(Boolean) || []

    // 选择优化模型的API Key
    const optimizeModelId = 'claude-sonnet-4-5-20250929'
    const { apiKey: optimizeApiKey } = selectApiKey(optimizeModelId)

    let optimizedTranscript = cleanedTranscript
    let optimizationUsed = false

    // 使用LLM优化（结合视频元数据智能纠错，支持流式输出）
    if (optimizeApiKey) {
      await emitProgress(emit, 'optimize', 'active', '正在使用AI优化文案...')

      try {
        // 心跳机制：定期更新进度，避免长时间无响应
        let lastHeartbeat = Date.now()
        const heartbeatInterval = setInterval(async () => {
          const elapsed = Math.floor((Date.now() - lastHeartbeat) / 1000)
          await emitProgress(
            emit,
            'optimize',
            'active',
            `AI正在优化文案... (已等待${elapsed}秒)`
          )
        }, 5000) // 每5秒发送一次心跳

        try {
          const llmOptimized = await optimizeTranscriptWithLLM(
            cleanedTranscript,
            optimizeApiKey,
            optimizeModelId,
            {
              title: videoInfo.title,
              author: videoInfo.author,
              hashtags,
              videoTags
            },
            {
              signal, // 传递取消信号
              timeoutMs: 45000, // 45秒超时
              maxRetries: 1, // 自动重试1次
              onProgress: async (chunk: string) => {
                // 实时发送优化后的文本片段
                lastHeartbeat = Date.now() // 更新心跳时间
                await emit({
                  type: 'partial',
                  key: 'optimized',
                  data: chunk,
                  append: true
                })
              }
            }
          )

          clearInterval(heartbeatInterval)

          if (llmOptimized) {
            optimizedTranscript = llmOptimized
            optimizationUsed = true
          } else {
            // 优化失败，降级到基础清理版本
            await emit({
              type: 'partial',
              key: 'warn',
              data: '[警告] AI优化失败，已降级使用基础清理版本',
              append: false
            })
          }
        } finally {
          clearInterval(heartbeatInterval)
        }
      } catch (_optimizeError) {
        // 优化步骤失败不应中断整个流程，降级到基础版本
        await emit({
          type: 'partial',
          key: 'warn',
          data: '[警告] AI优化过程出错，已降级使用基础清理版本',
          append: false
        })
      }
    } else {
      await emit({
        type: 'partial',
        key: 'warn',
        data: '[提示] 未配置AI优化密钥，使用基础清理版本',
        append: false
      })
    }

    await emitProgress(
      emit,
      'optimize',
      'completed',
      stepTimer.getDetail(
        'optimize',
        optimizationUsed ? 'AI优化完成' : '基础清理完成'
      )
    )

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
