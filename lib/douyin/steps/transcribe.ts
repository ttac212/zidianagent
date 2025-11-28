/**
 * Pipeline步骤：语音转录
 *
 * 职责：
 * - 调用ASR服务转录音频
 * - 支持流式输出
 * - 支持重试机制
 * - 支持直接从视频文件转录（Whisper API，无需提取音频）
 */

import { DouyinPipelineStepError } from '@/lib/douyin/pipeline'
import type { DouyinPipelineEmitter } from '@/lib/douyin/pipeline'
import { processSSEStream } from '@/lib/utils/sse-parser'

const ASR_ENDPOINT = 'https://api.302.ai/v1/chat/completions'
const WHISPER_ENDPOINT = 'https://api.302.ai/v1/audio/transcriptions'
const DEFAULT_ASR_TIMEOUT_MS = 120_000
const DEFAULT_WHISPER_TIMEOUT_MS = 180_000  // Whisper 处理视频需要更长时间
const ASR_MAX_RETRIES = 2

export interface TranscribeAudioContext {
  audioBuffer: Buffer
}

export interface TranscribeAudioResult {
  transcript: string
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
      controller.abort(new Error('操作已取消'))
    } else {
      const handleAbort = () => {
        controller.abort(new Error('操作已取消'))
      }
      external.addEventListener('abort', handleAbort, { once: true })

      return {
        controller,
        signal: controller.signal,
        cleanup: () => {
          if (timeoutId) clearTimeout(timeoutId)
          external.removeEventListener('abort', handleAbort)
        }
      }
    }
  }

  return {
    controller,
    signal: controller.signal,
    cleanup: () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }
}

/**
 * 转录音频步骤
 */
export async function transcribeAudio(
  context: TranscribeAudioContext,
  emit: DouyinPipelineEmitter,
  apiKey: string,
  signal?: AbortSignal
): Promise<TranscribeAudioResult> {
  if (signal?.aborted) {
    throw new Error('操作已取消')
  }

  const base64Audio = context.audioBuffer.toString('base64')

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

  // 重试循环
  while (attempt <= ASR_MAX_RETRIES) {
    if (signal?.aborted) {
      throw new Error('操作已取消')
    }

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
          await emit({
            type: 'progress',
            step: 'transcribe-audio',
            status: 'active',
            detail: `ASR 服务响应异常 (${response.status})，准备重试 ${attempt + 2}/${ASR_MAX_RETRIES + 1}`
          } as any)
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
            await emit({
              type: 'progress',
              step: 'transcribe-audio',
              status: 'active',
              detail: `ASR 请求超时，准备重试 ${attempt + 2}/${ASR_MAX_RETRIES + 1}`
            } as any)
            attempt += 1
            continue
          }

          throw new DouyinPipelineStepError(
            reasonMessage,
            'transcribe-audio',
            reason
          )
        }

        if (signal?.aborted) {
          throw new Error('操作已取消')
        }
      }

      if (error instanceof DouyinPipelineStepError) {
        throw error
      }

      if (attempt < ASR_MAX_RETRIES) {
        const message =
          error instanceof Error ? error.message : '未知错误（准备重试）'
        await emit({
          type: 'progress',
          step: 'transcribe-audio',
          status: 'active',
          detail: `ASR 请求失败（${message}），准备重试 ${attempt + 2}/${ASR_MAX_RETRIES + 1}`
        } as any)
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

  if (!asrResponse) {
    throw new DouyinPipelineStepError('ASR API请求失败', 'transcribe-audio')
  }

  // 处理流式响应
  const reader = asrResponse.body?.getReader()
  if (!reader) {
    throw new DouyinPipelineStepError('无法读取转录响应流', 'transcribe-audio')
  }

  let transcript = ''
  let readerClosed = false

  try {
    await processSSEStream(reader, {
      onContent: async (content) => {
        if (signal?.aborted) {
          throw new Error('操作已取消')
        }
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

  return {
    transcript
  }
}

/**
 * 使用 Whisper API 直接转录视频文件
 *
 * 302.AI 的 Whisper API 支持直接处理视频文件（MP4），
 * 无需本地 FFmpeg 提取音频，适合 Vercel 等 serverless 环境。
 *
 * 注意：这是非流式 API，会一次性返回完整转录结果
 */
export interface TranscribeVideoContext {
  videoBuffer: Buffer
}

export interface TranscribeVideoResult {
  transcript: string
}

export async function transcribeVideoWithWhisper(
  context: TranscribeVideoContext,
  emit: DouyinPipelineEmitter,
  apiKey: string,
  signal?: AbortSignal
): Promise<TranscribeVideoResult> {
  if (signal?.aborted) {
    throw new Error('操作已取消')
  }

  await emit({
    type: 'partial',
    key: 'transcript',
    data: '正在使用 Whisper 转录视频...',
    append: false
  })

  let attempt = 0

  while (attempt <= ASR_MAX_RETRIES) {
    if (signal?.aborted) {
      throw new Error('操作已取消')
    }

    const { signal: whisperSignal, cleanup } = createAbortableSignal(
      DEFAULT_WHISPER_TIMEOUT_MS,
      'Whisper 请求超时',
      signal
    )

    try {
      // 构建 FormData
      const formData = new FormData()
      // 将 Buffer 转换为 Uint8Array 以兼容 Blob
      const videoBlob = new Blob([new Uint8Array(context.videoBuffer)], { type: 'video/mp4' })
      formData.append('file', videoBlob, 'video.mp4')
      formData.append('model', 'whisper-1')
      formData.append('response_format', 'text')
      formData.append('language', 'zh')  // 指定中文提高识别准确率

      const response = await fetch(WHISPER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData,
        signal: whisperSignal
      })

      cleanup()

      if (!response.ok) {
        const errorText = await response.text()
        const errorMessage = `Whisper转录失败: ${response.status} - ${errorText}`

        if (response.status >= 500 && attempt < ASR_MAX_RETRIES) {
          await emit({
            type: 'progress',
            step: 'transcribe-audio',
            status: 'active',
            detail: `Whisper 服务响应异常 (${response.status})，准备重试 ${attempt + 2}/${ASR_MAX_RETRIES + 1}`
          } as any)
          attempt += 1
          continue
        }

        throw new DouyinPipelineStepError(errorMessage, 'transcribe-audio')
      }

      const transcript = await response.text()

      if (!transcript || transcript.trim().length === 0) {
        throw new DouyinPipelineStepError('Whisper转录失败,未返回文本', 'transcribe-audio')
      }

      // 输出转录结果
      await emit({
        type: 'partial',
        key: 'transcript',
        data: transcript.trim(),
        append: false
      })

      return {
        transcript: transcript.trim()
      }
    } catch (error) {
      cleanup()

      if (signal?.aborted) {
        throw new Error('操作已取消')
      }

      if (error instanceof DouyinPipelineStepError) {
        throw error
      }

      const errorMessage = error instanceof Error ? error.message : '未知错误'

      if (attempt < ASR_MAX_RETRIES) {
        await emit({
          type: 'progress',
          step: 'transcribe-audio',
          status: 'active',
          detail: `Whisper 请求失败（${errorMessage}），准备重试 ${attempt + 2}/${ASR_MAX_RETRIES + 1}`
        } as any)
        attempt += 1
        continue
      }

      throw new DouyinPipelineStepError(
        `Whisper转录失败: ${errorMessage}`,
        'transcribe-audio',
        error
      )
    }
  }

  throw new DouyinPipelineStepError('Whisper API请求失败', 'transcribe-audio')
}
