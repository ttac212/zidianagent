/**
 * Pipeline步骤：提取音频
 *
 * 职责：
 * - 从视频中提取音频轨
 * - 转换为MP3格式
 * - 标准化采样率和声道
 */

import { VideoProcessor } from '@/lib/video/video-processor'
import { DouyinPipelineStepError } from '@/lib/douyin/pipeline'

export interface ExtractAudioContext {
  videoBuffer: Buffer
}

export interface ExtractAudioResult {
  audioBuffer: Buffer
}

/**
 * 提取音频步骤
 */
export async function extractAudio(
  context: ExtractAudioContext,
  signal?: AbortSignal
): Promise<ExtractAudioResult> {
  if (signal?.aborted) {
    throw new Error('操作已取消')
  }

  try {
    const audioBuffer = await VideoProcessor.extractAudio(context.videoBuffer, {
      format: 'mp3',
      sampleRate: 16000,
      channels: 1,
      bitrate: '128k'
    })

    if (signal?.aborted) {
      throw new Error('操作已取消')
    }

    return {
      audioBuffer
    }
  } catch (error) {
    throw new DouyinPipelineStepError(
      error instanceof Error ? error.message : '音频提取失败',
      'extract-audio',
      error
    )
  }
}
