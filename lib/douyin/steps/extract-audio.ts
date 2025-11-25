/**
 * Pipeline步骤：提取音频
 *
 * 职责：
 * - 从视频中提取音频轨
 * - 转换为MP3格式
 * - 标准化采样率和声道
 * - 检查音频大小限制（Vercel部署保护）
 *
 * 2025年重构：使用统一的 abort-utils 处理取消
 */

import { VideoProcessor } from '@/lib/video/video-processor'
import { DouyinPipelineStepError } from '@/lib/douyin/pipeline'
import {
  DOUYIN_PIPELINE_LIMITS,
  formatBytes
} from '@/lib/douyin/constants'
import { ensureNotAborted } from '@/lib/utils/abort-utils'

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
  ensureNotAborted(signal)

  try {
    const audioBuffer = await VideoProcessor.extractAudio(context.videoBuffer, {
      format: 'mp3',
      sampleRate: 16000,
      channels: 1,
      bitrate: '128k'
    })

    ensureNotAborted(signal)

    // 检查音频大小限制（Vercel部署保护）
    if (DOUYIN_PIPELINE_LIMITS.ENABLED) {
      const maxSize = DOUYIN_PIPELINE_LIMITS.MAX_AUDIO_SIZE_BYTES
      if (audioBuffer.length > maxSize) {
        throw new DouyinPipelineStepError(
          `音频文件过大：当前${formatBytes(audioBuffer.length)}，` +
          `最大支持${formatBytes(maxSize)}。` +
          `这通常是因为视频时长过长，请选择较短的视频。`,
          'extract-audio'
        )
      }
    }

    return {
      audioBuffer
    }
  } catch (error) {
    // 如果是我们自己抛出的错误，直接传递
    if (error instanceof DouyinPipelineStepError) {
      throw error
    }
    throw new DouyinPipelineStepError(
      error instanceof Error ? error.message : '音频提取失败',
      'extract-audio',
      error
    )
  }
}
